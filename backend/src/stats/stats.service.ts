import { Injectable } from '@nestjs/common';
import { and, asc, eq, lt, sql, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { DatabaseService } from '../database/database.service';
import { ClockService } from '../clock/clock.service';
import {
  admins,
  attendance,
  bookingGuests,
  bookings,
  priceItems,
  purchaseItems,
  purchases,
  trainingDays,
  trainingSlots,
} from '../database/schema';
import { KY_ZONE } from '../schedule/training-types';

const TOP_DAYS = 5;

export type Revenue = { clubCards: number; personal: number; split: number; group: number; total: number };

const emptyRevenue = (): Revenue => ({ clubCards: 0, personal: 0, split: 0, group: 0, total: 0 });

// Revenue column: price list section, split by type for trainer services
export function revenueKey(section: string, trainingType: string | null): keyof Omit<Revenue, 'total'> {
  if (section === 'club_card') return 'clubCards';
  if (section === 'group') return 'group';
  return trainingType === 'split' ? 'split' : 'personal';
}

type RevenueRow = { month: string; section: string; trainingType: string | null; amount: number };
export type RevenueSummary = { allTime: Revenue; months: ({ month: string } & Revenue)[] };

// Columns per Kyiv month and all time, newest month first
export function summarizeRevenue(rows: RevenueRow[]): RevenueSummary {
  const byMonth = new Map<string, Revenue>();
  const allTime = emptyRevenue();
  for (const r of rows) {
    const key = revenueKey(r.section, r.trainingType);
    const m = byMonth.get(r.month) ?? emptyRevenue();
    m[key] += r.amount;
    m.total += r.amount;
    byMonth.set(r.month, m);
    allTime[key] += r.amount;
    allTime.total += r.amount;
  }
  return {
    allTime,
    months: [...byMonth].sort(([a], [b]) => b.localeCompare(a)).map(([m, revenue]) => ({ month: m, ...revenue })),
  };
}

type GymTrainer = { id: string; username: string; disabledAt: Date | null };
type GymRevenueRow = RevenueRow & { payee: string | null };
type GymPresentRow = { trainerId: string; month: string; present: number };

// The owner's page: one entry per trainer (zeros included), and money no trainer is credited with
export function buildGymStats(trainers: GymTrainer[], revenueRows: GymRevenueRow[], presentRows: GymPresentRow[]) {
  const present = (trainerId: string) => {
    const byMonth = new Map<string, number>();
    for (const r of presentRows.filter((p) => p.trainerId === trainerId)) {
      byMonth.set(r.month, (byMonth.get(r.month) ?? 0) + r.present);
    }
    const months = [...byMonth].sort(([a], [b]) => b.localeCompare(a)).map(([month, n]) => ({ month, present: n }));
    return { allTime: months.reduce((sum, m) => sum + m.present, 0), months };
  };
  return {
    trainers: trainers.map((t) => ({
      id: t.id,
      username: t.username,
      disabledAt: t.disabledAt?.toISOString() ?? null,
      revenue: summarizeRevenue(revenueRows.filter((r) => r.payee === t.id)),
      present: present(t.id),
    })),
    unassigned: { revenue: summarizeRevenue(revenueRows.filter((r) => r.payee === null)) },
  };
}

// Whose money: the client's trainer, or (no trainer) who confirmed the cash. Null = online, no trainer
const payee = sql<string | null>`coalesce(${purchases.trainerId}, ${purchases.decidedBy})`;
// decided_at is the payment moment; created_at only for old rows without it
const paidMonth = sql<string>`to_char(coalesce(${purchases.decidedAt}, ${purchases.createdAt}) at time zone 'Europe/Kyiv', 'YYYY-MM')`;

// Revenue: PAID purchases, by Kyiv month paid, at the amounts copied at purchase.
// Load: people marked present on the trainer's trainings, guests included
@Injectable()
export class StatsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly clock: ClockService,
  ) {}

  async forTrainer(trainerId: string) {
    return {
      revenue: summarizeRevenue(await this.revenueRows(eq(payee, trainerId))),
      ...(await this.load(trainerId)),
    };
  }

  // Every trainer, disabled ones too (their money was real), first trainer first
  async forGym() {
    const trainers = await this.database.db
      .select({ id: admins.id, username: admins.username, disabledAt: admins.disabledAt })
      .from(admins)
      .orderBy(asc(admins.createdAt));
    return buildGymStats(trainers, await this.revenueRows(), await this.presentByMonth());
  }

  private revenueRows(only?: SQL) {
    return this.database.db
      .select({
        payee,
        month: paidMonth,
        section: priceItems.section,
        trainingType: priceItems.trainingType,
        amount: sql<number>`sum(${purchaseItems.amountUah})::int`,
      })
      .from(purchaseItems)
      .innerJoin(purchases, eq(purchases.id, purchaseItems.purchaseId))
      .innerJoin(priceItems, eq(priceItems.id, purchaseItems.priceItemId))
      .where(and(only, eq(purchases.status, 'PAID')))
      .groupBy(payee, paidMonth, priceItems.section, priceItems.trainingType);
  }

  // People marked ✓ (members and guests) per trainer and month, days before today, as in load()
  private async presentByMonth(): Promise<GymPresentRow[]> {
    const today = this.clock.now().toISODate()!;
    const month = sql<string>`substr(${trainingDays.localDate}::text, 1, 7)`;
    const past = and(eq(trainingSlots.status, 'ACTIVE'), lt(trainingDays.localDate, today));
    const members = await this.database.db
      .select({ trainerId: trainingSlots.trainerId, month, present: sql<number>`count(*)::int` })
      .from(attendance)
      .innerJoin(bookings, eq(bookings.id, attendance.bookingId))
      .innerJoin(trainingSlots, eq(trainingSlots.id, bookings.slotId))
      .innerJoin(trainingDays, eq(trainingDays.id, trainingSlots.trainingDayId))
      .where(and(past, eq(bookings.status, 'ACTIVE'), eq(attendance.status, 'PRESENT')))
      .groupBy(trainingSlots.trainerId, month);
    const guests = await this.database.db
      .select({ trainerId: trainingSlots.trainerId, month, present: sql<number>`count(*)::int` })
      .from(bookingGuests)
      .innerJoin(bookings, eq(bookings.id, bookingGuests.bookingId))
      .innerJoin(trainingSlots, eq(trainingSlots.id, bookings.slotId))
      .innerJoin(trainingDays, eq(trainingDays.id, trainingSlots.trainingDayId))
      .where(
        and(
          past,
          eq(bookings.status, 'ACTIVE'),
          eq(bookingGuests.status, 'ACTIVE'),
          eq(bookingGuests.attendance, 'PRESENT'),
        ),
      )
      .groupBy(trainingSlots.trainerId, month);
    return [...members, ...guests];
  }

  private async load(trainerId: string) {
    const today = this.clock.now().toISODate()!;
    // Past days only: today's trainings may not have happened yet
    const mine = and(
      eq(trainingSlots.trainerId, trainerId),
      eq(trainingSlots.status, 'ACTIVE'),
      lt(trainingDays.localDate, today),
    );
    const members = await this.database.db
      .select({ localDate: trainingDays.localDate, present: sql<number>`count(*)::int` })
      .from(attendance)
      .innerJoin(bookings, eq(bookings.id, attendance.bookingId))
      .innerJoin(trainingSlots, eq(trainingSlots.id, bookings.slotId))
      .innerJoin(trainingDays, eq(trainingDays.id, trainingSlots.trainingDayId))
      .where(and(mine, eq(bookings.status, 'ACTIVE'), eq(attendance.status, 'PRESENT')))
      .groupBy(trainingDays.localDate);
    const guests = await this.database.db
      .select({ localDate: trainingDays.localDate, present: sql<number>`count(*)::int` })
      .from(bookingGuests)
      .innerJoin(bookings, eq(bookings.id, bookingGuests.bookingId))
      .innerJoin(trainingSlots, eq(trainingSlots.id, bookings.slotId))
      .innerJoin(trainingDays, eq(trainingDays.id, trainingSlots.trainingDayId))
      .where(
        and(
          mine,
          eq(bookings.status, 'ACTIVE'),
          eq(bookingGuests.status, 'ACTIVE'),
          eq(bookingGuests.attendance, 'PRESENT'),
        ),
      )
      .groupBy(trainingDays.localDate);
    // So a day nobody came counts as 0 in the weekday average
    const days = await this.database.db
      .selectDistinct({ localDate: trainingDays.localDate })
      .from(trainingSlots)
      .innerJoin(trainingDays, eq(trainingDays.id, trainingSlots.trainingDayId))
      .where(mine);

    const present = new Map<string, number>(days.map((d) => [d.localDate, 0]));
    for (const r of [...members, ...guests]) present.set(r.localDate, (present.get(r.localDate) ?? 0) + r.present);
    return summarizeLoad(present);
  }
}

// Weekday: 1 = Monday ... 7 = Sunday
export function summarizeLoad(present: Map<string, number>) {
  const busiestDays = [...present]
    .filter(([, n]) => n > 0)
    .sort(([a, x], [b, y]) => y - x || b.localeCompare(a))
    .slice(0, TOP_DAYS)
    .map(([localDate, n]) => ({ localDate, present: n }));

  const perWeekday = new Map<number, { days: number; present: number }>();
  for (const [date, n] of present) {
    const weekday = DateTime.fromISO(date, { zone: KY_ZONE }).weekday;
    const w = perWeekday.get(weekday) ?? { days: 0, present: 0 };
    perWeekday.set(weekday, { days: w.days + 1, present: w.present + n });
  }
  const weekdays = [...perWeekday]
    .sort(([a], [b]) => a - b)
    .map(([weekday, w]) => ({ weekday, days: w.days, avgPresent: Math.round((w.present / w.days) * 10) / 10 }));

  return { busiestDays, weekdays };
}
