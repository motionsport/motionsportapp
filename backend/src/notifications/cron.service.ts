import { Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { NotificationService } from './notification.service';
import { AnnouncementsService } from '../ai/announcements.service';
import { ClockService } from '../clock/clock.service';
import { EntitlementsService, inLockOrder } from '../purchases/entitlements.service';
import { trainingSlots, bookings, attendance, bookingGuests } from '../database/schema';
import { GROUP_TYPE, slotOverAt, slotStartsAt } from '../schedule/training-types';
import { slotOpensAt } from '../trainer-schedule/rules';
import { loadTrainerSchedule } from '../trainer-schedule/trainer-schedule.store';
import { getDefaultTrainerId } from '../schedule/default-trainer';
import { trainingDayOn } from '../schedule/training-day.store';

// cron-job.org runs booking-open every 15 minutes: each trainer's announcement is made one run before their opening
const ANNOUNCEMENT_LEAD_MINUTES = 15;

// Jobs behind /internal/cron/*; InternalCronController checks the secret
@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly notifications: NotificationService,
    private readonly announcementsService: AnnouncementsService,
    private readonly clock: ClockService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async bookingOpen() {
    const now = this.clock.now();
    const today = now.toISODate()!;
    const tomorrow = now.plus({ days: 1 }).toISODate()!;

    // What opens today at a trainer's opening time: today's group trainings after it, and tomorrow's at or before it
    // (a morning training opens the day before, slotOpensAt), so the push also comes on a day with no trainings
    const onToday = await this.groupTrainingsOn(today);
    const onTomorrow = await this.groupTrainingsOn(tomorrow);
    if (onToday.length === 0 && onTomorrow.length === 0) {
      return { ok: true, skipped: 'no group trainings today or tomorrow' };
    }
    const firstTrainerId = await getDefaultTrainerId(this.database.db);

    // Per trainer: from their opening until the first of those trainings starts. Runs every 15 min (cron-job.org);
    // the per-trainer-and-day dedupe key keeps it to one push
    const sent: string[] = [];
    for (const trainerId of [...new Set([...onToday, ...onTomorrow].map((t) => t.trainerId))]) {
      const { bookingOpensAt: opensAt } = await loadTrainerSchedule(this.database.db, trainerId);
      const own = (list: { trainerId: string; slotTime: string }[]) => list.filter((t) => t.trainerId === trainerId);
      const opening = [
        ...own(onToday)
          .filter((t) => t.slotTime > opensAt)
          .map((t) => ({ date: today, slotTime: t.slotTime })),
        ...own(onTomorrow)
          .filter((t) => t.slotTime <= opensAt)
          .map((t) => ({ date: tomorrow, slotTime: t.slotTime })),
      ].sort((a, b) => (a.date + a.slotTime).localeCompare(b.date + b.slotTime));
      const first = opening[0];
      if (!first || now >= slotStartsAt(first.date, first.slotTime)) continue;
      const openAt = slotOpensAt(first.date, first.slotTime, opensAt);
      const dates = [...new Set(opening.map((t) => t.date))];
      // Today's announcement one run before the opening, so it is ready with the push (a published one is left
      // alone; members see it only from the opening). Not for tomorrow's morning: it speaks of «сьогодні», so that
      // day's own opening makes it. A failure never stops the push
      if (dates.includes(today) && now >= openAt.minus({ minutes: ANNOUNCEMENT_LEAD_MINUTES })) {
        await this.announcementsService
          .autoGenerate(today, trainerId)
          .catch((e: unknown) => this.logger.error(`Announcement ${trainerId}: ${String(e)}`));
      }
      if (now < openAt) continue;
      await this.notifications.enqueueAndProcess('BOOKING_OPEN', `booking-open:${today}:${trainerId}`, {
        localDate: today,
        // The days whose trainings opened (tomorrow: its morning ones)
        dates,
        trainerIds: [trainerId],
        // Members without a trainer see the first trainer's group trainings
        includeUnassigned: trainerId === firstTrainerId,
      });
      sent.push(trainerId);
    }

    return { ok: true, localDate: today, trainerIds: sent };
  }

  // 22:00 Kyiv (23:00 in summer): marks unmarked bookings and guests of finished trainings PRESENT
  async autoConfirmAttendance() {
    const now = this.clock.now();
    const today = now.toISODate()!;

    const day = await trainingDayOn(this.database.db, today);

    if (!day || day.status === 'CANCELLED') {
      return { ok: true, skipped: 'no active day today' };
    }

    const slots = await this.database.db
      .select({ id: trainingSlots.id })
      .from(trainingSlots)
      .where(and(eq(trainingSlots.trainingDayId, day.id), eq(trainingSlots.status, 'ACTIVE')));

    const unmarked = await this.database.db
      .select({
        id: bookings.id,
        memberId: bookings.memberId,
        trainerId: trainingSlots.trainerId,
        slotTime: trainingSlots.slotTime,
      })
      .from(bookings)
      .innerJoin(trainingSlots, eq(trainingSlots.id, bookings.slotId))
      .leftJoin(attendance, eq(attendance.bookingId, bookings.id))
      .where(and(eq(trainingSlots.trainingDayId, day.id), eq(bookings.status, 'ACTIVE'), isNull(attendance.bookingId)));

    // Only finished trainings: the UTC cron shifts by an hour with DST and must not mark one still going on
    const unmarkedBookings = unmarked.filter((b) => now >= slotOverAt(today, b.slotTime));
    const guestsMarked = await this.markGuests(day.id, today, now);

    if (unmarkedBookings.length === 0) {
      return { ok: true, marked: 0, guestsMarked };
    }

    const markedAt = now.toJSDate();
    await this.database.db.transaction(async (tx) => {
      for (const booking of inLockOrder(unmarkedBookings)) {
        // In the trainer's name; spends like a manual mark
        await tx
          .insert(attendance)
          .values({ bookingId: booking.id, status: 'PRESENT', markedAt, markedByAdminId: booking.trainerId })
          .onConflictDoNothing();
        await this.entitlements.syncSpend(tx, booking.id);
      }
    });

    return { ok: true, marked: unmarkedBookings.length, guestsMarked, slots: slots.length };
  }

  private async markGuests(dayId: string, today: string, now: ReturnType<ClockService['now']>) {
    const guests = await this.database.db
      .select({ id: bookingGuests.id, trainerId: trainingSlots.trainerId, slotTime: trainingSlots.slotTime })
      .from(bookingGuests)
      .innerJoin(bookings, eq(bookings.id, bookingGuests.bookingId))
      .innerJoin(trainingSlots, eq(trainingSlots.id, bookings.slotId))
      .where(
        and(
          eq(trainingSlots.trainingDayId, dayId),
          eq(trainingSlots.status, 'ACTIVE'),
          eq(bookings.status, 'ACTIVE'),
          eq(bookingGuests.status, 'ACTIVE'),
          isNull(bookingGuests.attendance),
        ),
      );
    const over = guests.filter((g) => now >= slotOverAt(today, g.slotTime));
    for (const g of over) {
      await this.database.db
        .update(bookingGuests)
        .set({ attendance: 'PRESENT', markedAt: now.toJSDate(), markedByAdminId: g.trainerId })
        .where(and(eq(bookingGuests.id, g.id), isNull(bookingGuests.attendance)));
    }
    return over.length;
  }

  // Active group trainings of a scheduled day (none: no day or a cancelled one)
  private async groupTrainingsOn(localDate: string) {
    const day = await trainingDayOn(this.database.db, localDate);
    if (!day || day.status !== 'SCHEDULED') return [];
    return this.database.db
      .select({ trainerId: trainingSlots.trainerId, slotTime: trainingSlots.slotTime })
      .from(trainingSlots)
      .where(
        and(
          eq(trainingSlots.trainingDayId, day.id),
          eq(trainingSlots.trainingType, GROUP_TYPE),
          eq(trainingSlots.status, 'ACTIVE'),
        ),
      );
  }
}
