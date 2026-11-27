import { PgDialect } from 'drizzle-orm/pg-core';
import { DateTime } from 'luxon';
import {
  StatsService,
  revenueKey,
  summarizeLoad,
  summarizeRevenue,
  summarizeDiscounts,
  buildGymStats,
} from './stats.service';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { OwnerStatsController } from './stats.controller';
import { SessionGuard } from '../auth/session.guard';
import { OwnerGuard } from '../common/guards/owner.guard';

describe('stats — revenue columns', () => {
  it('club cards, group passes, and trainer services by type', () => {
    expect(revenueKey('club_card', null)).toBe('clubCards');
    expect(revenueKey('group', 'group')).toBe('group');
    expect(revenueKey('assigned', 'personal')).toBe('personal');
    expect(revenueKey('assigned', 'split')).toBe('split');
  });
});

describe('stats — whose revenue', () => {
  it("the trainer's clients' purchases, and cash a member without a trainer paid to this trainer", async () => {
    const wheres: unknown[] = [];
    const chain: any = { then: (resolve: (v: unknown) => void) => resolve([]) };
    for (const m of ['from', 'innerJoin', 'leftJoin', 'groupBy', 'orderBy']) chain[m] = () => chain;
    chain.where = (cond: unknown) => (wheres.push(cond), chain);
    const db = { select: () => chain, selectDistinct: () => chain };
    await new StatsService({ db } as any, { now: () => DateTime.fromISO('2026-10-23') }).forTrainer('t1');
    const { sql, params } = new PgDialect().sqlToQuery(wheres[0] as any);
    // The same «whose money» as the owner's gym stats: the client's trainer, else who confirmed the cash
    expect(sql).toContain('coalesce("purchases"."trainer_id", "purchases"."decided_by") = $1');
    expect(params[0]).toBe('t1');
  });
});

describe('stats — load', () => {
  // Mon 19.10, Wed 21.10, Mon 26.10 (nobody came), Fri 23.10
  const present = new Map([
    ['2026-10-19', 6],
    ['2026-10-21', 9],
    ['2026-10-23', 4],
    ['2026-10-26', 0],
  ]);

  it('busiest days: most ✓ first, days nobody came left out', () => {
    expect(summarizeLoad(present).busiestDays).toEqual([
      { localDate: '2026-10-21', present: 9 },
      { localDate: '2026-10-19', present: 6 },
      { localDate: '2026-10-23', present: 4 },
    ]);
  });

  it('a tie: the later day first', () => {
    const tie = new Map([
      ['2026-10-19', 5],
      ['2026-10-21', 5],
    ]);
    expect(summarizeLoad(tie).busiestDays.map((d) => d.localDate)).toEqual(['2026-10-21', '2026-10-19']);
  });

  it('weekday average counts the days nobody came', () => {
    expect(summarizeLoad(present).weekdays).toEqual([
      { weekday: 1, days: 2, avgPresent: 3 },
      { weekday: 3, days: 1, avgPresent: 9 },
      { weekday: 5, days: 1, avgPresent: 4 },
    ]);
  });

  it('only the top 5', () => {
    const many = new Map(Array.from({ length: 8 }, (_, i) => [`2026-10-${10 + i}`, i + 1] as [string, number]));
    expect(summarizeLoad(many).busiestDays).toHaveLength(5);
  });
});

describe('stats — revenue by month', () => {
  it('sums columns per month and all time, newest month first', () => {
    const r = summarizeRevenue([
      { month: '2026-10', section: 'club_card', trainingType: null, amount: 1000, discount: 0 },
      { month: '2026-10', section: 'assigned', trainingType: 'split', amount: 600, discount: 0 },
      { month: '2026-11', section: 'group', trainingType: 'group', amount: 300, discount: 0 },
    ]);
    expect(r.allTime).toEqual({
      clubCards: 1000,
      personal: 0,
      split: 600,
      group: 300,
      total: 1900,
      discount: 0,
      discounted: 0,
      permanentDiscount: 0,
      gifts: 0,
      refunds: 0,
    });
    expect(r.months.map((m) => [m.month, m.total])).toEqual([
      ['2026-11', 300],
      ['2026-10', 1600],
    ]);
  });
});

describe('stats — columns at price list prices, total what was actually received', () => {
  it('a discounted club card counts in «Абонементи» at its price list amount; total is net of the discounts', () => {
    const r = summarizeRevenue([
      // 1400 at the price list, −70 review, −140 permanent: 1190 paid
      {
        month: '2026-11',
        section: 'club_card',
        trainingType: null,
        amount: 1190,
        discount: 70,
        permanentDiscount: 140,
      },
      { month: '2026-11', section: 'assigned', trainingType: 'personal', amount: 800, discount: 0 },
    ]);
    expect(r.allTime).toMatchObject({
      clubCards: 1400,
      personal: 800,
      discount: 70,
      permanentDiscount: 140,
      total: 1990,
    });
  });
});

describe('stats — refunds after a late cancellation', () => {
  it('a separate line in the month given back; the total is net of it, the columns stay what was received', () => {
    const r = summarizeRevenue([
      { month: '2026-10', section: 'assigned', trainingType: 'personal', amount: 800, discount: 0 },
      { month: '2026-11', section: 'assigned', trainingType: 'personal', amount: 800, discount: 0 },
      // the October training, cancelled late; half handed back in November
      { month: '2026-11', section: 'assigned', trainingType: null, amount: 0, discount: 0, refunds: 400 },
    ]);
    expect(r.allTime).toMatchObject({ personal: 1600, refunds: 400, total: 1200 });
    expect(r.months.map((m) => [m.month, m.personal, m.refunds, m.total])).toEqual([
      ['2026-11', 800, 400, 400],
      ['2026-10', 800, 0, 800],
    ]);
  });

  it('a refund in a month with no purchase still makes that month, below zero', () => {
    const r = summarizeRevenue([
      { month: '2026-12', section: 'assigned', trainingType: null, amount: 0, discount: 0, refunds: 300 },
    ]);
    expect(r.months).toEqual([expect.objectContaining({ month: '2026-12', refunds: 300, total: -300 })]);
  });

  it('the owner: each refund goes to the payee of the purchase', () => {
    const gym = buildGymStats(
      [{ id: 't1', username: 'admin', disabledAt: null }],
      [
        { payee: 't1', month: '2026-11', section: 'assigned', trainingType: 'personal', amount: 800, discount: 0 },
        {
          payee: 't1',
          month: '2026-11',
          section: 'assigned',
          trainingType: null,
          amount: 0,
          discount: 0,
          refunds: 400,
        },
      ],
      [],
    );
    expect(gym.trainers[0].revenue.allTime).toMatchObject({ personal: 800, refunds: 400, total: 400 });
  });
});

describe('stats — special offer gifts in revenue', () => {
  it('counts the free gym visits per month and all time; they add no money', () => {
    const r = summarizeRevenue([
      { month: '2026-11', section: 'club_card', trainingType: null, amount: 0, discount: 0, gifts: 2 },
      { month: '2026-11', section: 'assigned', trainingType: 'personal', amount: 800, discount: 0 },
      { month: '2026-10', section: 'club_card', trainingType: null, amount: 1400, discount: 0, gifts: 1 },
    ]);
    expect(r.allTime).toMatchObject({ gifts: 3, clubCards: 1400, total: 2200 });
    expect(r.months.map((m) => [m.month, m.gifts])).toEqual([
      ['2026-11', 2],
      ['2026-10', 1],
    ]);
  });
});

describe('stats — discounts in revenue', () => {
  it('discount and discounted per month and all time; total stays what was paid', () => {
    const r = summarizeRevenue([
      { month: '2026-10', section: 'club_card', trainingType: null, amount: 950, discount: 50 },
      { month: '2026-10', section: 'group', trainingType: 'group', amount: 300, discount: 0 },
      { month: '2026-11', section: 'club_card', trainingType: null, amount: 900, discount: 100 },
      { month: '2026-11', section: 'group', trainingType: 'group', amount: 280, discount: 20 },
    ]);
    expect(r.allTime).toMatchObject({ total: 2430, discount: 170, discounted: 3 });
    expect(r.months.map((m) => [m.month, m.discount, m.discounted])).toEqual([
      ['2026-11', 120, 2],
      ['2026-10', 50, 1],
    ]);
  });
});

describe('stats — review discount summary', () => {
  const zero = { given: 0, bar: 0, reception: 0, receptionUah: 0, purchases: 0, purchasesUah: 0 };

  it('counts given, bar, reception and purchases per month, newest first, and all time', () => {
    const s = summarizeDiscounts([
      { kind: 'given', month: '2026-10', count: 3, uah: 0 },
      { kind: 'given', month: '2026-11', count: 2, uah: 0 },
      { kind: 'bar', month: '2026-11', count: 1, uah: 0 },
      { kind: 'reception', month: '2026-11', count: 2, uah: 150 },
      { kind: 'purchase', month: '2026-10', count: 1, uah: 50 },
      { kind: 'purchase', month: '2026-11', count: 2, uah: 120 },
    ]);
    expect(s.allTime).toEqual({ given: 5, bar: 1, reception: 2, receptionUah: 150, purchases: 3, purchasesUah: 170 });
    expect(s.months).toEqual([
      { month: '2026-11', given: 2, bar: 1, reception: 2, receptionUah: 150, purchases: 2, purchasesUah: 120 },
      { month: '2026-10', ...zero, given: 3, purchases: 1, purchasesUah: 50 },
    ]);
  });

  it('nothing: zeros and no months', () => {
    expect(summarizeDiscounts([])).toEqual({ allTime: zero, months: [] });
  });
});

describe('stats — the whole gym (owner)', () => {
  const trainers = [
    { id: 't1', username: 'admin', disabledAt: null },
    { id: 't2', username: 'olena', disabledAt: new Date('2026-11-01T10:00:00Z') },
  ];

  it('one card per trainer, in order; a trainer with nothing gets zeros', () => {
    const gym = buildGymStats(
      trainers,
      [{ payee: 't1', month: '2026-11', section: 'group', trainingType: 'group', amount: 300, discount: 0 }],
      [{ trainerId: 't1', month: '2026-11', present: 4 }],
    );
    expect(gym.trainers.map((t) => t.username)).toEqual(['admin', 'olena']);
    expect(gym.trainers[0].revenue.allTime.total).toBe(300);
    expect(gym.trainers[0].present).toEqual({ allTime: 4, months: [{ month: '2026-11', present: 4 }] });
    expect(gym.trainers[1].revenue.allTime.total).toBe(0);
    expect(gym.trainers[1].present).toEqual({ allTime: 0, months: [] });
    expect(gym.trainers[1].disabledAt).toBe('2026-11-01T10:00:00.000Z');
  });

  it('money nobody can be credited with (online, member without a trainer) goes to «Без тренера»', () => {
    const gym = buildGymStats(
      trainers,
      [{ payee: null, month: '2026-11', section: 'club_card', trainingType: null, amount: 500, discount: 0 }],
      [],
    );
    expect(gym.unassigned.revenue.allTime.total).toBe(500);
    expect(gym.trainers.every((t) => t.revenue.allTime.total === 0)).toBe(true);
  });

  it('present ✓ adds members and guests of the same month', () => {
    const gym = buildGymStats(
      trainers,
      [],
      [
        { trainerId: 't1', month: '2026-11', present: 4 },
        { trainerId: 't1', month: '2026-11', present: 1 },
        { trainerId: 't1', month: '2026-10', present: 2 },
      ],
    );
    expect(gym.trainers[0].present).toEqual({
      allTime: 7,
      months: [
        { month: '2026-11', present: 5 },
        { month: '2026-10', present: 2 },
      ],
    });
  });

  it('GET /owner/stats is for the owner only', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, OwnerStatsController)).toEqual([SessionGuard, OwnerGuard]);
    expect(Reflect.getMetadata(PATH_METADATA, OwnerStatsController)).toBe('owner/stats');
  });
});
