import type { DateTime } from 'luxon';
import { and, eq, gte, inArray, lt } from 'drizzle-orm';
import type { DatabaseService } from '../database/database.service';
import { bookings, trainingDays, trainingSlots } from '../database/schema';
import { slotStartsAt } from '../schedule/training-types';
import { cancelGuests, freeSeats } from './group-booking';

type Db = DatabaseService['db'];
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

// The member's bookings not started yet (before endsOn, if given) become system cancellations: nothing spent, no
// reason, guests go too, seats freed. Shared by a freeze approval and the owner's «Вимкнути». Returns the bookings
// whose group slot dropped below its norm, for the caller's «З'явилось місце» after the transaction
export async function cancelBookingsAhead(tx: Tx, memberId: string, now: DateTime, endsOn?: string) {
  const today = now.toISODate()!;
  const toCancel = await tx
    .select({
      id: bookings.id,
      slotId: bookings.slotId,
      slotTime: trainingSlots.slotTime,
      localDate: trainingDays.localDate,
    })
    .from(bookings)
    .innerJoin(trainingSlots, eq(trainingSlots.id, bookings.slotId))
    .innerJoin(trainingDays, eq(trainingDays.id, trainingSlots.trainingDayId))
    .where(
      and(
        eq(bookings.memberId, memberId),
        eq(bookings.status, 'ACTIVE'),
        gte(trainingDays.localDate, today),
        endsOn ? lt(trainingDays.localDate, endsOn) : undefined,
      ),
    )
    .for('update', { of: trainingSlots });
  const ahead = toCancel.filter((b) => slotStartsAt(b.localDate, b.slotTime) > now);
  if (ahead.length === 0) return [];
  const ids = ahead.map((b) => b.id);
  const at = now.toJSDate();
  await tx
    .update(bookings)
    .set({ status: 'CANCELLED', cancelledAt: at })
    .where(and(inArray(bookings.id, ids), eq(bookings.status, 'ACTIVE')));
  const withGuest = await cancelGuests(tx, ids, at);
  const freed: typeof ahead = [];
  for (const b of ahead) {
    if (await freeSeats(tx, b.slotId, withGuest.has(b.id) ? 2 : 1)) freed.push(b);
  }
  return freed;
}
