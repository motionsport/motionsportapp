import { ConflictException } from '@nestjs/common';
import { and, desc, eq, gte } from 'drizzle-orm';
import type { DatabaseService } from '../database/database.service';
import { birthdayDiscounts, members, purchases } from '../database/schema';
import { apiError } from '../common/api-error';
import {
  birthdayState,
  PERMANENT_DISCOUNT_PERCENT,
  type BirthdayState,
  type DiscountKind,
  type PermanentKind,
} from './rules';

type Db = DatabaseService['db'];
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Q = Db | Tx;

export type BirthdayView = { givenOn: string; state: BirthdayState };

// This calendar year's birthday discount, if given (one a year). A plain function, like loadDiscount
async function birthdayRow(db: Q, memberId: string, today: string) {
  const [row] = await db
    .select({
      id: birthdayDiscounts.id,
      givenOn: birthdayDiscounts.givenOn,
      clubCardId: birthdayDiscounts.clubCardId,
      purchaseStatus: purchases.status,
    })
    .from(birthdayDiscounts)
    .leftJoin(purchases, eq(purchases.id, birthdayDiscounts.purchaseId))
    .where(and(eq(birthdayDiscounts.memberId, memberId), gte(birthdayDiscounts.givenOn, `${today.slice(0, 4)}-01-01`)))
    .orderBy(desc(birthdayDiscounts.givenOn))
    .limit(1);
  return row ?? null;
}

export async function loadBirthday(db: Q, memberId: string, today: string): Promise<BirthdayView | null> {
  const row = await birthdayRow(db, memberId, today);
  return row ? { givenOn: row.givenOn, state: birthdayState(row, today) } : null;
}

export async function permanentKindOf(db: Q, memberId: string): Promise<PermanentKind | null> {
  const [row] = await db
    .select({ kind: members.permanentDiscount })
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);
  return (row?.kind as PermanentKind | null) ?? null;
}

// The 10% the member gets on a club card today: their mark, else a birthday discount still free today. They don't
// stack, so the mark wins (the trainer isn't offered the birthday one then)
export async function discountKindNow(db: Q, memberId: string, today: string): Promise<DiscountKind | null> {
  const mark = await permanentKindOf(db, memberId);
  if (mark) return mark;
  const birthday = await loadBirthday(db, memberId, today);
  return birthday?.state === 'free' ? 'BIRTHDAY' : null;
}

// What the member's and trainer's screens preview; the percent rides along (the frontend has no copy of it)
export async function permanentDiscountNow(db: Q, memberId: string, today: string) {
  const kind = await discountKindNow(db, memberId, today);
  return kind ? { kind, percent: PERMANENT_DISCOUNT_PERCENT } : null;
}

// The birthday discount can be taken now: else 409. Callers hold lockMember
async function freeBirthdayRow(tx: Tx, memberId: string, today: string) {
  const row = await birthdayRow(tx, memberId, today);
  if (!row || birthdayState(row, today) !== 'free') throw new ConflictException(apiError('BIRTHDAY_DISCOUNT_NOT_FREE'));
  return row;
}

// A purchase takes it (held while the purchase waits for payment; given back if it doesn't go through)
export async function holdBirthdayForPurchase(tx: Tx, memberId: string, purchaseId: string, today: string) {
  const row = await freeBirthdayRow(tx, memberId, today);
  await tx.update(birthdayDiscounts).set({ purchaseId }).where(eq(birthdayDiscounts.id, row.id));
}

// A club card added at the reception takes it
export async function useBirthdayAtReception(tx: Tx, memberId: string, clubCardId: string, today: string) {
  const row = await freeBirthdayRow(tx, memberId, today);
  await tx.update(birthdayDiscounts).set({ clubCardId }).where(eq(birthdayDiscounts.id, row.id));
}
