import { ConflictException, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { ReviewDiscountsService } from './review-discounts.service';
import { holdDiscountForPurchase, loadDiscount, useDiscountAtReception } from './discount.store';
import { reviewDiscounts } from '../database/schema';
import { requireVisibleMember } from '../schedule/default-trainer';

jest.mock('../schedule/default-trainer', () => ({ requireVisibleMember: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../booking/group-booking', () => ({ lockMember: jest.fn().mockResolvedValue({}) }));

const NOW = DateTime.fromISO('2026-11-24T12:00:00', { zone: 'Europe/Kyiv' });
type Write = { table: unknown; set?: Record<string, any>; values?: Record<string, any> };

// Reads take the next of `reads`; writes are recorded
function makeDb(reads: unknown[][]) {
  let r = 0;
  const writes: Write[] = [];
  const readLink = (): any => {
    const chain: any = { then: (resolve: (v: unknown) => void) => resolve(reads[r++] ?? []) };
    for (const m of ['from', 'innerJoin', 'leftJoin', 'where', 'orderBy', 'limit']) chain[m] = () => readLink();
    return chain;
  };
  const writeLink = (w: Write): any => {
    const chain: any = { then: (resolve: (v: unknown) => void) => resolve(undefined) };
    chain.set = (v: any) => ((w.set = v), chain);
    chain.values = (v: any) => ((w.values = v), chain);
    chain.where = () => chain;
    return chain;
  };
  const db: any = {
    select: () => readLink(),
    update: (table: unknown) => {
      const w = { table };
      writes.push(w);
      return writeLink(w);
    },
    insert: (table: unknown) => {
      const w = { table };
      writes.push(w);
      return writeLink(w);
    },
  };
  db.transaction = async (cb: (tx: any) => Promise<unknown>) => cb(db);
  return { db, writes };
}

const row = (over: Record<string, unknown> = {}) => ({
  id: 'd1',
  code: 'MG-5-ABCD',
  validUntil: '2026-12-24',
  givenAt: new Date('2026-11-24T10:00:00Z'),
  givenBy: 'olena',
  usedAt: null,
  usedVia: null,
  purchaseId: null,
  purchaseStatus: null,
  purchaseDecidedAt: null,
  discountUah: null,
  cardLabel: null,
  ...over,
});

const svc = (db: any) => new ReviewDiscountsService({ db } as any, { now: () => NOW });
const failsWith = async (p: Promise<unknown>, code: string) => {
  const err: any = await p.catch((e) => e);
  expect(err).toBeInstanceOf(ConflictException);
  expect(err.getResponse()).toMatchObject({ code });
};

describe('ReviewDiscountsService', () => {
  it('gives once: valid for a month from the Kyiv date', async () => {
    const { db, writes } = makeDb([[], [], [row()]]);
    const view = await svc(db).give('t1', 'm1');
    expect(view).toMatchObject({ code: 'MG-5-ABCD', state: 'free', givenBy: 'olena', usedVia: null });
    expect(writes[0].table).toBe(reviewDiscounts);
    expect(writes[0].values).toMatchObject({
      memberId: 'm1',
      givenByAdminId: 't1',
      validUntil: '2026-12-24',
    });
    expect(writes[0].values?.code).toMatch(/^MG-5-/);
  });

  it("another trainer's client is 404, nothing written", async () => {
    (requireVisibleMember as jest.Mock).mockRejectedValueOnce(new NotFoundException('Member not found'));
    const { db, writes } = makeDb([]);
    await expect(svc(db).give('t2', 'm1')).rejects.toBeInstanceOf(NotFoundException);
    expect(writes).toHaveLength(0);
  });

  it('a second give is 409 DISCOUNT_GIVEN', async () => {
    const { db, writes } = makeDb([[{ id: 'd1' }]]);
    await failsWith(svc(db).give('t1', 'm1'), 'DISCOUNT_GIVEN');
    expect(writes).toHaveLength(0);
  });

  it('bar: free discount is used, used_at = clock', async () => {
    const { db, writes } = makeDb([[row()], [row({ usedVia: 'BAR' })]]);
    await svc(db).useAtBar('m1');
    expect(writes[0].set).toEqual({ usedVia: 'BAR', usedAt: NOW.toJSDate() });
  });

  it('bar: held by a pending purchase is 409 DISCOUNT_HELD', async () => {
    const { db, writes } = makeDb([[row({ purchaseId: 'p1', purchaseStatus: 'PENDING' })]]);
    await failsWith(svc(db).useAtBar('m1'), 'DISCOUNT_HELD');
    expect(writes).toHaveLength(0);
  });

  it('bar: after the date is 409 DISCOUNT_EXPIRED', async () => {
    const { db } = makeDb([[row({ validUntil: '2026-11-23' })]]);
    await failsWith(svc(db).useAtBar('m1'), 'DISCOUNT_EXPIRED');
  });

  it('bar: used is 409 DISCOUNT_USED, none is DISCOUNT_NONE', async () => {
    await failsWith(svc(makeDb([[row({ usedVia: 'BAR' })]]).db).useAtBar('m1'), 'DISCOUNT_USED');
    await failsWith(svc(makeDb([[]]).db).useAtBar('m1'), 'DISCOUNT_NONE');
  });
});

describe('holdDiscountForPurchase / useDiscountAtReception', () => {
  it('hold sets purchase_id', async () => {
    const { db, writes } = makeDb([[row()]]);
    await expect(holdDiscountForPurchase(db, 'm1', 'p1', '2026-11-24')).resolves.toBeUndefined();
    expect(writes[0].set).toEqual({ purchaseId: 'p1' });
  });

  it('hold refuses a used discount', async () => {
    await failsWith(
      holdDiscountForPurchase(makeDb([[row({ usedVia: 'BAR' })]]).db, 'm1', 'p1', '2026-11-24'),
      'DISCOUNT_USED',
    );
  });

  it('reception marks it used with the card and amount', async () => {
    const { db, writes } = makeDb([[row()]]);
    await useDiscountAtReception(db, 'm1', 't1', 'c1', 75, '2026-11-24', NOW.toJSDate());
    expect(writes[0].set).toMatchObject({
      usedVia: 'RECEPTION',
      usedByAdminId: 't1',
      clubCardId: 'c1',
      discountUah: 75,
    });
  });

  it('reception refuses an expired one', async () => {
    await failsWith(
      useDiscountAtReception(
        makeDb([[row({ validUntil: '2026-11-01' })]]).db,
        'm1',
        't1',
        'c1',
        75,
        '2026-11-24',
        NOW.toJSDate(),
      ),
      'DISCOUNT_EXPIRED',
    );
  });
});

describe('loadDiscount', () => {
  const load = (r: unknown) => loadDiscount(makeDb([[r]]).db, 'm1', '2026-11-24');

  it('free and expired carry no use', async () => {
    expect(await load(row())).toMatchObject({ state: 'free', usedVia: null, usedOn: null });
    expect(await load(row({ validUntil: '2026-11-23' }))).toMatchObject({ state: 'expired', usedVia: null });
  });

  it('held by a pending purchase', async () => {
    expect(await load(row({ purchaseId: 'p1', purchaseStatus: 'PENDING' }))).toMatchObject({
      state: 'held',
      usedVia: null,
      usedOn: null,
    });
  });

  it('BAR: used, nothing bought', async () => {
    const usedAt = new Date('2026-11-24T09:00:00Z');
    expect(await load(row({ usedVia: 'BAR', usedAt }))).toEqual(
      expect.objectContaining({ state: 'used', usedVia: 'BAR', usedAt: usedAt.toISOString(), usedOn: null }),
    );
  });

  it('RECEPTION: the card label and the stored amount', async () => {
    expect(
      await load(row({ usedVia: 'RECEPTION', usedAt: new Date(), discountUah: 75, cardLabel: 'Абонемент на місяць' })),
    ).toMatchObject({
      usedVia: 'RECEPTION',
      usedOn: { title: 'Абонемент на місяць', discountUah: 75 },
    });
  });

  it('PURCHASE: paid purchase, its discounted item, decided_at', async () => {
    const decided = new Date('2026-11-24T11:00:00Z');
    const r = row({ purchaseId: 'p1', purchaseStatus: 'PAID', purchaseDecidedAt: decided });
    const item = { title: 'Пакет', optionLabel: '10 занять', discountUah: 50 };
    const view = await loadDiscount(makeDb([[r], [item]]).db, 'm1', '2026-11-24');
    expect(view).toMatchObject({
      state: 'used',
      usedVia: 'PURCHASE',
      usedAt: decided.toISOString(),
      usedOn: { title: 'Пакет · 10 занять', discountUah: 50 },
    });
  });
});
