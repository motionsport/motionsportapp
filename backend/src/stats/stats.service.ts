import { Injectable } from '@nestjs/common';
import { and, asc, eq, gt, isNotNull, lt, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { DateTime } from 'luxon';
import { DatabaseService } from '../database/database.service';
import { ClockService } from '../clock/clock.service';
import {
  admins,
  attendance,
  bookingGuests,
  bookings,
  clubCards,
  priceItems,
  purchaseItems,
  purchases,
  reviewDiscounts,
  trainingDays,
  trainingSlots,
} from '../database/schema';
import { KY_ZONE } from '../schedule/training-types';

const TOP_DAYS = 5;

// total = money actually received (net of discounts); discount = what was knocked off, discounted = purchases with one
export type Revenue = {
  clubCards: number;
  personal: number;
  split: number;
  group: number;
  total: number;
  discount: number;
  discounted: number;
  // «Постійні знижки» and «Знижка іменинника» taken off (total is already net of them)
  permanentDiscount: number;
  // «Спеціальна пропозиція»: single gym visits given free (purchase_items.gift), not money
  gifts: number;
};
type RevenueColumn = 'clubCards' | 'personal' | 'split' | 'group';

const emptyRevenue = (): Revenue => ({
  clubCards: 0,
  personal: 0,
  split: 0,
  group: 0,
  total: 0,
  discount: 0,
  discounted: 0,
  permanentDiscount: 0,
  gifts: 0,
});

// Revenue column: price list section, split by type for trainer services
export function revenueKey(section: string, trainingType: string | null): RevenueColumn {
  if (section === 'club_card') return 'clubCards';
  if (section === 'group') return 'group';
  return trainingType === 'split' ? 'split' : 'personal';
}

type RevenueRow = {
  month: string;
  section: string;
  trainingType: string | null;
  amount: number;
  discount: number;
  discounted?: number;
  permanentDiscount?: number;
  gifts?: number;
};
export type RevenueSummary = { allTime: Revenue; months: ({ month: string } & Revenue)[] };

// Columns per Kyiv month and all time, newest month first
export function summarizeRevenue(rows: RevenueRow[]): RevenueSummary {
  const byMonth = new Map<string, Revenue>();
  const allTime = emptyRevenue();
  for (const r of rows) {
    const key = revenueKey(r.section, r.trainingType);
    const m = byMonth.get(r.month) ?? emptyRevenue();
    // discounted: the rows are grouped by column, so the query counts the items; a bare row is one item if it has a discount
    const discounted = r.discounted ?? (r.discount > 0 ? 1 : 0);
    for (const t of [m, allTime]) {
      t[key] += r.amount;
      t.total += r.amount;
      t.discount += r.discount;
      t.discounted += discounted;
      t.permanentDiscount += r.permanentDiscount ?? 0;
      t.gifts += r.gifts ?? 0;
    }
    byMonth.set(r.month, m);
  }
  return {
    allTime,
    months: [...byMonth].sort(([a], [b]) => b.localeCompare(a)).map(([m, revenue]) => ({ month: m, ...revenue })),
  };
}

export type DiscountSummary = {
  given: number;
  bar: number;
  reception: number;
  receptionUah: number;
  purchases: number;
  purchasesUah: number;
};
type DiscountRow = { kind: 'given' | 'bar' | 'reception' | 'purchase'; month: string; count: number; uah: number };
export type DiscountsSummary = { allTime: DiscountSummary; months: ({ month: string } & DiscountSummary)[] };

const emptyDiscounts = (): DiscountSummary => ({
  given: 0,
  bar: 0,
  reception: 0,
  receptionUah: 0,
  purchases: 0,
  purchasesUah: 0,
});

// Review discounts per Kyiv month and all time, newest month first. Each row is already counted by the query:
// given by the month it was given, bar / reception by the month used, purchase by the month the purchase was paid
export function summarizeDiscounts(rows: DiscountRow[]): DiscountsSummary {
  const byMonth = new Map<string, DiscountSummary>();
  const allTime = emptyDiscounts();
  for (const r of rows) {
    const m = byMonth.get(r.month) ?? emptyDiscounts();
    for (const t of [m, allTime]) {
      if (r.kind === 'given') t.given += r.count;
      else if (r.kind === 'bar') t.bar += r.count;
      else if (r.kind === 'reception') {
        t.reception += r.count;
        t.receptionUah += r.uah;
      } else {
        t.purchases += r.count;
        t.purchasesUah += r.uah;
      }
    }
    byMonth.set(r.month, m);
  }
  return {
    allTime,
    months: [...byMonth].sort(([a], [b]) => b.localeCompare(a)).map(([month, d]) => ({ month, ...d })),
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
      // Cards this trainer added at the reception: shown apart, the gym's money, not in their total
      reception: summarizeRevenue(await this.receptionRows(eq(clubCards.addedBy, trainerId))),
      ...(await this.load(trainerId)),
    };
  }

  // Every trainer, disabled ones too (their money was real), first trainer first
  async forGym() {
    const trainers = await this.database.db
      .select({ id: admins.id, username: admins.username, disabledAt: admins.disabledAt })
      .from(admins)
      .orderBy(asc(admins.createdAt));
    return {
      ...buildGymStats(trainers, await this.revenueRows(), await this.presentByMonth()),
      // The gym's money, no trainer's: only in «Весь зал», as «з них з рецепції»
      reception: { revenue: summarizeRevenue(await this.receptionRows()) },
      reviewDiscounts: summarizeDiscounts(await this.discountRows()),
    };
  }

  // Club cards added at the reception with their price (paid_uah), by the Kyiv month added; the review discount
  // used on one is its discount. `only`: one trainer's (added_by)
  private async receptionRows(only?: SQL): Promise<RevenueRow[]> {
    const month = sql<string>`to_char(${clubCards.createdAt} at time zone 'Europe/Kyiv', 'YYYY-MM')`;
    const rows = await this.database.db
      .select({
        month,
        amount: sql<number>`sum(${clubCards.paidUah})::int`,
        discount: sql<number>`coalesce(sum(${reviewDiscounts.discountUah}), 0)::int`,
        discounted: sql<number>`(count(*) filter (where ${reviewDiscounts.discountUah} > 0))::int`,
        permanentDiscount: sql<number>`coalesce(sum(${clubCards.permanentDiscountUah}), 0)::int`,
      })
      .from(clubCards)
      .leftJoin(reviewDiscounts, eq(reviewDiscounts.clubCardId, clubCards.id))
      .where(and(only, isNotNull(clubCards.paidUah)))
      .groupBy(month);
    return rows.map((r) => ({ ...r, section: 'club_card', trainingType: null }));
  }

  // Review discounts, counted per event and Kyiv month (see summarizeDiscounts)
  private async discountRows(): Promise<DiscountRow[]> {
    const db = this.database.db;
    const kyivMonth = (col: SQL | AnyPgColumn) => sql<string>`to_char(${col} at time zone 'Europe/Kyiv', 'YYYY-MM')`;
    const given = await db
      .select({ month: kyivMonth(reviewDiscounts.givenAt), count: sql<number>`count(*)::int` })
      .from(reviewDiscounts)
      .groupBy(kyivMonth(reviewDiscounts.givenAt));
    const used = await db
      .select({
        via: reviewDiscounts.usedVia,
        month: kyivMonth(reviewDiscounts.usedAt),
        count: sql<number>`count(*)::int`,
        uah: sql<number>`coalesce(sum(${reviewDiscounts.discountUah}), 0)::int`,
      })
      .from(reviewDiscounts)
      .where(and(isNotNull(reviewDiscounts.usedAt), isNotNull(reviewDiscounts.usedVia)))
      .groupBy(reviewDiscounts.usedVia, kyivMonth(reviewDiscounts.usedAt));
    // A discount used on a purchase counts once the purchase is PAID, at the discount knocked off its item
    const bought = await db
      .select({
        month: paidMonth,
        count: sql<number>`count(distinct ${reviewDiscounts.id})::int`,
        uah: sql<number>`sum(${purchaseItems.discountUah})::int`,
      })
      .from(reviewDiscounts)
      .innerJoin(purchases, eq(purchases.id, reviewDiscounts.purchaseId))
      .innerJoin(purchaseItems, eq(purchaseItems.purchaseId, purchases.id))
      .where(and(eq(purchases.status, 'PAID'), gt(purchaseItems.discountUah, 0)))
      .groupBy(paidMonth);
    return [
      ...given.map((r) => ({ kind: 'given' as const, month: r.month, count: r.count, uah: 0 })),
      ...used.map((r) => ({
        kind: r.via === 'BAR' ? ('bar' as const) : ('reception' as const),
        month: r.month,
        count: r.count,
        uah: r.uah,
      })),
      ...bought.map((r) => ({ kind: 'purchase' as const, month: r.month, count: r.count, uah: r.uah })),
    ];
  }

  private revenueRows(only?: SQL) {
    return this.database.db
      .select({
        payee,
        month: paidMonth,
        section: priceItems.section,
        trainingType: priceItems.trainingType,
        amount: sql<number>`sum(${purchaseItems.amountUah})::int`,
        discount: sql<number>`coalesce(sum(${purchaseItems.discountUah}), 0)::int`,
        discounted: sql<number>`(count(*) filter (where ${purchaseItems.discountUah} > 0))::int`,
        permanentDiscount: sql<number>`coalesce(sum(${purchaseItems.permanentDiscountUah}), 0)::int`,
        gifts: sql<number>`(count(*) filter (where ${purchaseItems.gift}))::int`,
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
