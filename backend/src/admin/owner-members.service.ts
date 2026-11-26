import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, ilike, isNotNull, isNull, or } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { ClockService } from '../clock/clock.service';
import {
  admins,
  freezes,
  members,
  payments,
  purchases,
  pushSubscriptions,
  sessions,
  vacancyAlerts,
} from '../database/schema';
import { lockMember } from '../booking/group-booking';
import { cancelBookingsAhead } from '../booking/cancel-ahead';
import { NotificationService } from '../notifications/notification.service';

const LIST_LIMIT = 50;

// The owner's «Клієнти» (added 2026-11-26): find a client, «Вимкнути» / «Увімкнути». A disabled client can't sign in
// (MEMBER_DISABLED), trainers don't see them; their history, purchases and stats stay
@Injectable()
export class OwnerMembersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly clock: ClockService,
    private readonly notifications: NotificationService,
  ) {}

  // By name or member code; disabled ones too
  async list(query: string) {
    const q = query.trim();
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    return this.database.db
      .select({
        id: members.id,
        displayName: members.displayName,
        memberCode: members.memberCode,
        trainer: admins.username,
        createdAt: members.createdAt,
        disabledAt: members.disabledAt,
      })
      .from(members)
      .leftJoin(admins, eq(admins.id, members.trainerId))
      .where(q ? or(ilike(members.displayName, like), ilike(members.memberCode, like)) : undefined)
      .orderBy(asc(members.displayName))
      .limit(LIST_LIMIT);
  }

  // One transaction under the member lock: signed out everywhere, pushes off, bookings not started yet cancelled
  // (system cancellations, no push to the trainer), an unpaid purchase and a freeze request cancelled. Club card and
  // packages are left as they are (they burn by their dates). A second «Вимкнути» changes nothing
  async disable(ownerId: string, memberId: string) {
    const now = this.clock.now();
    const at = now.toJSDate();
    const freed = await this.database.db.transaction(async (tx) => {
      if (!(await lockMember(tx, memberId))) throw new NotFoundException('Member not found');
      const [done] = await tx
        .update(members)
        .set({ disabledAt: at, disabledByOwnerId: ownerId })
        .where(and(eq(members.id, memberId), isNull(members.disabledAt)))
        .returning({ id: members.id });
      if (!done) return [];
      await tx
        .update(sessions)
        .set({ revokedAt: at })
        .where(
          and(eq(sessions.principalType, 'member'), eq(sessions.principalId, memberId), isNull(sessions.revokedAt)),
        );
      await tx
        .update(pushSubscriptions)
        .set({ disabledAt: at })
        .where(and(eq(pushSubscriptions.memberId, memberId), isNull(pushSubscriptions.disabledAt)));
      await tx.update(vacancyAlerts).set({ active: false }).where(eq(vacancyAlerts.memberId, memberId));
      // Payments before the purchase: the lock order of the LiqPay paths (as a member's own cancel)
      const [pending] = await tx
        .select({ id: purchases.id })
        .from(purchases)
        .where(and(eq(purchases.memberId, memberId), eq(purchases.status, 'PENDING')))
        .limit(1);
      if (pending) {
        await tx
          .update(payments)
          .set({ status: 'REPLACED', updatedAt: at })
          .where(and(eq(payments.purchaseId, pending.id), eq(payments.status, 'PENDING')));
        await tx
          .update(purchases)
          .set({ status: 'CANCELLED', decidedAt: at })
          .where(and(eq(purchases.id, pending.id), eq(purchases.status, 'PENDING')));
      }
      await tx
        .update(freezes)
        .set({ status: 'CANCELLED' })
        .where(and(eq(freezes.memberId, memberId), eq(freezes.status, 'REQUESTED')));
      return cancelBookingsAhead(tx, memberId, now);
    });
    // A group training dropping below its norm: «З'явилось місце» to the members waiting, as on any freed seat
    for (const b of freed) {
      await this.notifications.enqueueAndProcess('VACANCY', `vacancy:${b.slotId}:${b.id}`, {
        slotId: b.slotId,
        slotTime: b.slotTime,
        localDate: b.localDate,
        excludeMemberId: memberId,
      });
    }
    return { ok: true };
  }

  // Back in: signs in again, and their trainer (or every trainer, without one) sees them again
  async enable(memberId: string) {
    const [done] = await this.database.db
      .update(members)
      .set({ disabledAt: null, disabledByOwnerId: null })
      .where(and(eq(members.id, memberId), isNotNull(members.disabledAt)))
      .returning({ id: members.id });
    if (!done) {
      const [exists] = await this.database.db.select({ id: members.id }).from(members).where(eq(members.id, memberId));
      if (!exists) throw new NotFoundException('Member not found');
    }
    return { ok: true };
  }
}
