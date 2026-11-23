import { Injectable, ConflictException } from '@nestjs/common';
import { and, asc, eq, gt, isNull } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { ClockService } from '../clock/clock.service';
import { trainerInvites } from '../database/schema';
import { newToken, hashToken } from '../auth/token';

export const INVITE_DAYS = 7;

// One-time trainer invite links; sign-up is AuthService.registerAdmin
@Injectable()
export class TrainerInvitesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly clock: ClockService,
  ) {}

  // The only time the raw token leaves the server; the DB keeps its hash. Made by the owner: no trainer author
  async create() {
    const token = newToken();
    const expiresAt = this.clock.now().plus({ days: INVITE_DAYS }).toJSDate();
    const [invite] = await this.database.db
      .insert(trainerInvites)
      .values({ tokenHash: hashToken(token), expiresAt })
      .returning({ id: trainerInvites.id });
    return { id: invite.id, token, expiresAt };
  }

  async listActive() {
    return this.database.db
      .select({
        id: trainerInvites.id,
        createdAt: trainerInvites.createdAt,
        expiresAt: trainerInvites.expiresAt,
      })
      .from(trainerInvites)
      .where(
        and(
          isNull(trainerInvites.usedAt),
          isNull(trainerInvites.revokedAt),
          gt(trainerInvites.expiresAt, this.clock.now().toJSDate()),
        ),
      )
      .orderBy(asc(trainerInvites.createdAt));
  }

  // The owner revokes any invite. Compare-and-set: used or revoked → 409
  async revoke(inviteId: string) {
    const [revoked] = await this.database.db
      .update(trainerInvites)
      .set({ revokedAt: this.clock.now().toJSDate() })
      .where(and(eq(trainerInvites.id, inviteId), isNull(trainerInvites.usedAt), isNull(trainerInvites.revokedAt)))
      .returning({ id: trainerInvites.id });
    if (!revoked) throw new ConflictException('Invite already used or revoked');
    return { ok: true };
  }
}
