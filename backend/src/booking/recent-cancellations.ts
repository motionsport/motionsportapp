import { sql, type SQL } from 'drizzle-orm';

// The trainer's «Клієнти» counter and the member's «Це вже 3-тє скасування»: one rule for both
export const CANCELLATION_STATS_DAYS = 30;

// A member's own cancellations since `since`: a reason written, moves 19:00 ↔ 20:00 left out (system
// cancellations have no reason). Table names explicit: drizzle drops them in a single-table select
export function memberCancellationsSince(memberId: SQL, since: Date) {
  return sql<number>`(
    SELECT count(*)::int FROM bookings b
    WHERE b.member_id = ${memberId}
      AND b.status = 'CANCELLED'
      AND b.cancellation_reason IS NOT NULL
      AND b.switched_to_slot_id IS NULL
      AND b.cancelled_at >= ${since}
  )`;
}
