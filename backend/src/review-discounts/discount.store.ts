import { and, desc, eq, gt } from 'drizzle-orm';
import { admins, clubCards, purchaseItems, purchases, reviewDiscounts } from '../database/schema';
import type { DatabaseService } from '../database/database.service';
import { apiError } from '../common/api-error';
import { ConflictException } from '@nestjs/common';
import { discountState, type DiscountState } from './rules';

type Db = DatabaseService['db'];
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Q = Db | Tx;

export type DiscountView = {
  code: string;
  validUntil: string;
  givenAt: string;
  givenBy: string;
  state: DiscountState;
  usedAt: string | null;
  usedVia: 'BAR' | 'RECEPTION' | 'PURCHASE' | null;
  usedOn: { title: string; discountUah: number } | null;
};

// The member's discount row with what its state needs. A plain function, like loadFreezes
async function discountRow(db: Q, memberId: string) {
  const [row] = await db
    .select({
      id: reviewDiscounts.id,
      code: reviewDiscounts.code,
      validUntil: reviewDiscounts.validUntil,
      givenAt: reviewDiscounts.givenAt,
      givenBy: admins.username,
      usedAt: reviewDiscounts.usedAt,
      usedVia: reviewDiscounts.usedVia,
      purchaseId: reviewDiscounts.purchaseId,
      purchaseStatus: purchases.status,
      purchaseDecidedAt: purchases.decidedAt,
      discountUah: reviewDiscounts.discountUah,
      cardLabel: clubCards.label,
    })
    .from(reviewDiscounts)
    .innerJoin(admins, eq(admins.id, reviewDiscounts.givenByAdminId))
    .leftJoin(purchases, eq(purchases.id, reviewDiscounts.purchaseId))
    .leftJoin(clubCards, eq(clubCards.id, reviewDiscounts.clubCardId))
    .where(eq(reviewDiscounts.memberId, memberId))
    .limit(1);
  return row ?? null;
}

export async function loadDiscount(db: Q, memberId: string, today: string): Promise<DiscountView | null> {
  const row = await discountRow(db, memberId);
  if (!row) return null;
  const state = discountState(row, today);
  const base = {
    code: row.code,
    validUntil: row.validUntil,
    givenAt: row.givenAt.toISOString(),
    givenBy: row.givenBy,
    state,
  };
  if (state !== 'used') return { ...base, usedAt: null, usedVia: null, usedOn: null };

  if (row.usedVia === 'BAR') {
    return { ...base, usedAt: row.usedAt?.toISOString() ?? null, usedVia: 'BAR', usedOn: null };
  }
  if (row.usedVia === 'RECEPTION') {
    return {
      ...base,
      usedAt: row.usedAt?.toISOString() ?? null,
      usedVia: 'RECEPTION',
      usedOn: { title: row.cardLabel ?? 'Абонемент (клубна карта)', discountUah: row.discountUah ?? 0 },
    };
  }
  // Paid online or by cash: the purchase item that took the discount
  const [item] = row.purchaseId
    ? await db
        .select({
          title: purchaseItems.title,
          optionLabel: purchaseItems.optionLabel,
          discountUah: purchaseItems.discountUah,
        })
        .from(purchaseItems)
        .where(and(eq(purchaseItems.purchaseId, row.purchaseId), gt(purchaseItems.discountUah, 0)))
        .orderBy(desc(purchaseItems.discountUah))
        .limit(1)
    : [];
  return {
    ...base,
    usedAt: row.purchaseDecidedAt?.toISOString() ?? null,
    usedVia: 'PURCHASE',
    usedOn: item
      ? { title: item.optionLabel ? `${item.title} · ${item.optionLabel}` : item.title, discountUah: item.discountUah }
      : null,
  };
}

// The discount can be taken now: else the matching error. Callers hold lockMember
async function freeDiscountRow(tx: Tx, memberId: string, today: string) {
  const row = await discountRow(tx, memberId);
  if (!row) throw new ConflictException(apiError('DISCOUNT_NONE'));
  const state = discountState(row, today);
  if (state === 'used') throw new ConflictException(apiError('DISCOUNT_USED'));
  if (state === 'held') throw new ConflictException(apiError('DISCOUNT_HELD'));
  if (state === 'expired') throw new ConflictException(apiError('DISCOUNT_EXPIRED'));
  return row;
}

// A purchase takes the discount (it is «held» while the purchase waits for payment)
export async function holdDiscountForPurchase(tx: Tx, memberId: string, purchaseId: string, today: string) {
  const row = await freeDiscountRow(tx, memberId, today);
  await tx.update(reviewDiscounts).set({ purchaseId }).where(eq(reviewDiscounts.id, row.id));
}

// The trainer gives a club card at the reception with the discount
export async function useDiscountAtReception(
  tx: Tx,
  memberId: string,
  trainerId: string,
  clubCardId: string,
  discountUah: number,
  today: string,
  now: Date,
) {
  const row = await freeDiscountRow(tx, memberId, today);
  await tx
    .update(reviewDiscounts)
    .set({ usedVia: 'RECEPTION', usedAt: now, usedByAdminId: trainerId, clubCardId, discountUah })
    .where(eq(reviewDiscounts.id, row.id));
}

export async function useDiscountAtBar(tx: Tx, memberId: string, today: string, now: Date) {
  const row = await freeDiscountRow(tx, memberId, today);
  await tx.update(reviewDiscounts).set({ usedVia: 'BAR', usedAt: now }).where(eq(reviewDiscounts.id, row.id));
}
