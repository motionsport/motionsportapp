import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, gt, isNull } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { ClockService } from '../clock/clock.service';
import { memberInvites, priceItems } from '../database/schema';
import { hashToken, newToken } from '../auth/token';
import { apiError } from '../common/api-error';
import type { CreateMemberInviteDto } from './dto/create-member-invite.dto';
import type { MemberInvitePayload } from './invite.store';

export const MEMBER_INVITE_DAYS = 7;

// «Запросити нового клієнта»: the trainer's side. The client signs up with AuthService.registerMemberInvite
@Injectable()
export class MemberInvitesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly clock: ClockService,
  ) {}

  private expiresAt() {
    return this.clock.now().plus({ days: MEMBER_INVITE_DAYS }).toJSDate();
  }

  // The raw token leaves the server only here and in relink; the DB keeps its hash
  async create(trainerId: string, dto: CreateMemberInviteDto) {
    const today = this.clock.now().toISODate()!;
    const displayName = dto.displayName.trim();
    if (!displayName) throw new BadRequestException(apiError('INVITE_FORM_INVALID'));
    if (dto.clubCard) {
      const [item] = await this.database.db
        .select({ section: priceItems.section })
        .from(priceItems)
        .where(eq(priceItems.id, dto.clubCard.priceItemId))
        .limit(1);
      if (item?.section !== 'club_card') throw new BadRequestException(apiError('INVITE_FORM_INVALID'));
    }
    const dates = [dto.clubCard?.validUntil, ...dto.packages.map((p) => p.validUntil)].filter((d): d is string => !!d);
    if (dates.some((d) => d < today)) throw new BadRequestException(apiError('INVITE_FORM_INVALID'));

    const payload: MemberInvitePayload = {
      clubCard: dto.clubCard
        ? { priceItemId: dto.clubCard.priceItemId, validUntil: dto.clubCard.validUntil ?? null }
        : null,
      packages: dto.packages.map((p) => ({ trainingType: p.trainingType, left: p.left, validUntil: p.validUntil })),
      permanentDiscount: dto.permanentDiscount ?? null,
    };
    const token = newToken();
    const [invite] = await this.database.db
      .insert(memberInvites)
      .values({
        tokenHash: hashToken(token),
        createdByAdminId: trainerId,
        displayName,
        payload,
        expiresAt: this.expiresAt(),
      })
      .returning({ id: memberInvites.id, expiresAt: memberInvites.expiresAt });
    return { id: invite.id, token, displayName, expiresAt: invite.expiresAt };
  }

  // This trainer's invites not used, revoked or expired
  async listActive(trainerId: string) {
    return this.database.db
      .select({ id: memberInvites.id, displayName: memberInvites.displayName, expiresAt: memberInvites.expiresAt })
      .from(memberInvites)
      .where(and(eq(memberInvites.createdByAdminId, trainerId), this.live()))
      .orderBy(asc(memberInvites.createdAt));
  }

  // «QR» on a waiting invite: the link isn't kept, so a new one replaces it (the old link stops working), 7 days again
  async relink(trainerId: string, inviteId: string) {
    const token = newToken();
    const [invite] = await this.database.db
      .update(memberInvites)
      .set({ tokenHash: hashToken(token), expiresAt: this.expiresAt() })
      .where(and(eq(memberInvites.id, inviteId), eq(memberInvites.createdByAdminId, trainerId), this.live()))
      .returning({ id: memberInvites.id, displayName: memberInvites.displayName, expiresAt: memberInvites.expiresAt });
    if (!invite) throw new NotFoundException('Invite not found');
    return { ...invite, token };
  }

  // Compare-and-set: used or revoked meanwhile → 409
  async revoke(trainerId: string, inviteId: string) {
    const [revoked] = await this.database.db
      .update(memberInvites)
      .set({ revokedAt: this.clock.now().toJSDate() })
      .where(
        and(
          eq(memberInvites.id, inviteId),
          eq(memberInvites.createdByAdminId, trainerId),
          isNull(memberInvites.usedAt),
          isNull(memberInvites.revokedAt),
        ),
      )
      .returning({ id: memberInvites.id });
    if (!revoked) throw new ConflictException(apiError('INVITE_INVALID'));
    return { ok: true };
  }

  private live() {
    return and(
      isNull(memberInvites.usedAt),
      isNull(memberInvites.revokedAt),
      gt(memberInvites.expiresAt, this.clock.now().toJSDate()),
    );
  }
}
