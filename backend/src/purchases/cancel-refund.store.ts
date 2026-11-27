import { and, asc, eq, isNull, lte, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import {
  admins,
  bookings,
  cancelRefunds,
  members,
  payments,
  purchases,
  trainingDays,
  trainingSlots,
} from '../database/schema';

type Db = DatabaseService['db'];
type Q = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

export type RefundStatus = 'DUE' | 'SENDING' | 'DONE' | 'CANCELLED';

// trainerId: the training's trainer only (cancel_refunds.trainer_id), null = missing or another trainer's; none = the
// owner, any trainer's
export async function loadRefund(q: Q, id: string, trainerId?: string) {
  const [row] = await q
    .select({
      id: cancelRefunds.id,
      status: cancelRefunds.status,
      amountUah: cancelRefunds.amountUah,
      purchaseId: cancelRefunds.purchaseId,
      method: purchases.method,
      expectedRefundedUah: cancelRefunds.expectedRefundedUah,
      sentAt: cancelRefunds.sentAt,
      lastError: cancelRefunds.lastError,
      paymentId: payments.id,
      orderId: payments.orderId,
      paymentAmount: payments.amount,
    })
    .from(cancelRefunds)
    .innerJoin(purchases, eq(purchases.id, cancelRefunds.purchaseId))
    // The one PAID payment of the purchase (payments move to PAID compare-and-set with the purchase)
    .leftJoin(payments, and(eq(payments.purchaseId, purchases.id), eq(payments.status, 'PAID')))
    .where(and(eq(cancelRefunds.id, id), trainerId ? eq(cancelRefunds.trainerId, trainerId) : undefined))
    .limit(1);
  return row ? { ...row, status: row.status as RefundStatus } : null;
}

// Compare-and-set: false when the row is no longer in `from`. expectedNull: also only while no expected total
// is saved, i.e. the refund request was certainly not sent
export async function moveRefund(
  q: Q,
  id: string,
  from: RefundStatus,
  set: Partial<typeof cancelRefunds.$inferInsert>,
  opts: { expectedNull?: boolean } = {},
): Promise<boolean> {
  const rows = await q
    .update(cancelRefunds)
    .set(set)
    .where(
      and(
        eq(cancelRefunds.id, id),
        eq(cancelRefunds.status, from),
        opts.expectedNull ? isNull(cancelRefunds.expectedRefundedUah) : undefined,
      ),
    )
    .returning({ id: cancelRefunds.id });
  return rows.length > 0;
}

// What this app refunded through LiqPay from the purchase's payment
export async function appRefundedUah(q: Q, purchaseId: string): Promise<number> {
  const [row] = await q
    .select({ total: sql<number>`coalesce(sum(${cancelRefunds.amountUah}), 0)::int` })
    .from(cancelRefunds)
    .where(and(eq(cancelRefunds.purchaseId, purchaseId), eq(cancelRefunds.doneVia, 'LIQPAY')));
  return Number(row?.total ?? 0);
}

// The owner's «Повернення»: every trainer's refunds still to hand over, oldest first
export async function pendingRefunds(q: Q) {
  return q
    .select({
      id: cancelRefunds.id,
      memberId: cancelRefunds.memberId,
      displayName: members.displayName,
      trainer: admins.username,
      amountUah: cancelRefunds.amountUah,
      createdAt: cancelRefunds.createdAt,
      localDate: trainingDays.localDate,
      slotTime: trainingSlots.slotTime,
      trainingType: trainingSlots.trainingType,
    })
    .from(cancelRefunds)
    .innerJoin(members, eq(members.id, cancelRefunds.memberId))
    .innerJoin(admins, eq(admins.id, cancelRefunds.trainerId))
    .innerJoin(bookings, eq(bookings.id, cancelRefunds.bookingId))
    .innerJoin(trainingSlots, eq(trainingSlots.id, bookings.slotId))
    .innerJoin(trainingDays, eq(trainingDays.id, trainingSlots.trainingDayId))
    .where(eq(cancelRefunds.status, 'DUE'))
    .orderBy(asc(cancelRefunds.createdAt));
}

// LiqPay's reversed callback: refund_amount = all refunds on the order, so every SENDING row of the purchase
// whose expected total is covered went through. Returns how many rows closed
export async function confirmRefundsFromCallback(q: Q, purchaseId: string, refundAmount: number, at: Date) {
  const rows = await q
    .update(cancelRefunds)
    .set({ status: 'DONE', doneVia: 'LIQPAY', doneAt: at })
    .where(
      and(
        eq(cancelRefunds.purchaseId, purchaseId),
        eq(cancelRefunds.status, 'SENDING'),
        lte(cancelRefunds.expectedRefundedUah, refundAmount),
      ),
    )
    .returning({ id: cancelRefunds.id });
  return rows.length;
}
