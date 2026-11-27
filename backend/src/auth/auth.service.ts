import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { eq, and, isNull, gt, ne } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { ClockService } from '../clock/clock.service';
import { members, admins, owners, sessions, trainerInvites, memberInvites } from '../database/schema';
import { grantInvite, invitePreview, liveInvite, type MemberInvitePayload } from '../member-invites/invite.store';
import { apiError } from '../common/api-error';
import type { RegisterMemberInviteDto } from './dto/register-member-invite.dto';
import { loginTarget } from './login-target';
import { byRole, type Role, type SessionUser } from './roles';
import { newToken, hashToken } from './token';
import { deleteDeadSessions } from './dead-sessions';
import type { RegisterMemberDto } from './dto/register-member.dto';
import type { LoginMemberDto } from './dto/login-member.dto';
import type { RecoverMemberDto } from './dto/recover-member.dto';
import type { LoginAdminDto } from './dto/login-admin.dto';
import type { RegisterAdminDto } from './dto/register-admin.dto';
import type { ChangePasswordDto } from './dto/change-password.dto';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 12;
// Same bcrypt cost as real hashes: an unknown code or username takes as long, so timing leaks nothing
const DUMMY_HASH = '$2b$12$t.Mnp58vbb/O.oSG0aHVEuyog3GrnDk1woQu4pJdSwJ0TDWhl7DkO';

export async function secretMatches(secret: string, hash: string | undefined): Promise<boolean> {
  const valid = await bcrypt.compare(secret, hash ?? DUMMY_HASH);
  return valid && hash !== undefined;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly clock: ClockService,
  ) {}

  async registerMember(dto: RegisterMemberDto) {
    const pinHash = await bcrypt.hash(dto.pin, BCRYPT_ROUNDS);
    const rawRecoveryCode = crypto.randomBytes(20).toString('base64url');
    const recoveryHash = await bcrypt.hash(rawRecoveryCode, BCRYPT_ROUNDS);
    const memberCode = await this.generateUniqueMemberCode();

    const [member] = await this.database.db
      .insert(members)
      .values({ memberCode, displayName: dto.displayName, pinHash, recoveryHash })
      .returning();

    const sessionToken = await this.createSession('member', member.id);
    return { memberCode, recoveryCode: rawRecoveryCode, sessionToken };
  }

  // «Запросити нового клієнта»: the client's page before the PIN (name and what is waiting); null = not valid
  async memberInvitePreview(token: string) {
    return invitePreview(this.database.db, token, this.clock.now().toJSDate());
  }

  // One transaction: the invite taken compare-and-set (one link, one client), the member with the inviting trainer and
  // the permanent discount, then the club card and packages they already paid for (no money in stats)
  async registerMemberInvite(dto: RegisterMemberInviteDto) {
    const pinHash = await bcrypt.hash(dto.pin, BCRYPT_ROUNDS);
    const rawRecoveryCode = crypto.randomBytes(20).toString('base64url');
    const recoveryHash = await bcrypt.hash(rawRecoveryCode, BCRYPT_ROUNDS);
    const memberCode = await this.generateUniqueMemberCode();
    const now = this.clock.now();

    const member = await this.database.db.transaction(async (tx) => {
      const [invite] = await tx
        .update(memberInvites)
        .set({ usedAt: now.toJSDate() })
        .where(liveInvite(dto.token, now.toJSDate()))
        .returning({
          id: memberInvites.id,
          trainerId: memberInvites.createdByAdminId,
          displayName: memberInvites.displayName,
          payload: memberInvites.payload,
        });
      if (!invite) throw new BadRequestException(apiError('INVITE_INVALID'));
      const payload = invite.payload as MemberInvitePayload;
      const [created] = await tx
        .insert(members)
        .values({
          memberCode,
          displayName: invite.displayName,
          pinHash,
          recoveryHash,
          trainerId: invite.trainerId,
          permanentDiscount: payload.permanentDiscount,
          permanentDiscountSetBy: payload.permanentDiscount ? invite.trainerId : null,
          permanentDiscountSetAt: payload.permanentDiscount ? now.toJSDate() : null,
        })
        .returning({ id: members.id });
      await tx.update(memberInvites).set({ usedByMemberId: created.id }).where(eq(memberInvites.id, invite.id));
      await grantInvite(tx, created.id, invite.trainerId, payload, now.toISODate()!);
      return created;
    });

    const sessionToken = await this.createSession('member', member.id);
    return { memberCode, recoveryCode: rawRecoveryCode, sessionToken };
  }

  async loginMember(dto: LoginMemberDto) {
    const [member] = await this.database.db
      .select()
      .from(members)
      .where(eq(members.memberCode, dto.memberCode))
      .limit(1);

    const valid = await secretMatches(dto.pin, member?.pinHash);
    // A client the owner disabled gets the same answer as a wrong PIN: nothing tells whether the account exists
    if (!member || member.disabledAt || !valid) throw new UnauthorizedException('Invalid credentials');

    const sessionToken = await this.createSession('member', member.id);
    return { memberCode: member.memberCode, displayName: member.displayName, sessionToken };
  }

  async recoverMember(dto: RecoverMemberDto) {
    const [member] = await this.database.db
      .select()
      .from(members)
      .where(eq(members.memberCode, dto.memberCode))
      .limit(1);

    const valid = await secretMatches(dto.recoveryCode, member?.recoveryHash);
    if (!member || member.disabledAt || !valid) throw new UnauthorizedException('Invalid credentials');

    const newPinHash = await bcrypt.hash(dto.newPin, BCRYPT_ROUNDS);
    const newRawRecovery = crypto.randomBytes(20).toString('base64url');
    const newRecoveryHash = await bcrypt.hash(newRawRecovery, BCRYPT_ROUNDS);

    await this.database.db
      .update(members)
      .set({ pinHash: newPinHash, recoveryHash: newRecoveryHash })
      .where(eq(members.id, member.id));

    await this.database.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.principalId, member.id), isNull(sessions.revokedAt)));

    const sessionToken = await this.createSession('member', member.id);
    return { memberCode: member.memberCode, recoveryCode: newRawRecovery, sessionToken };
  }

  // The team login: a trainer's username, or the owner's email. Every failure is the same 401
  async loginAdmin(dto: LoginAdminDto) {
    const target = loginTarget(dto.username);
    if (target.kind === 'owner') {
      const [owner] = await this.database.db.select().from(owners).where(eq(owners.email, target.email)).limit(1);
      const valid = await secretMatches(dto.password, owner?.passwordHash);
      if (!owner || !valid) throw new UnauthorizedException('Invalid credentials');

      const sessionToken = await this.createSession('owner', owner.id);
      return { role: 'owner' as const, name: owner.name, sessionToken };
    }

    const [admin] = await this.database.db.select().from(admins).where(eq(admins.username, target.username)).limit(1);

    // A disabled trainer gets the same answer as a wrong password
    const valid = await secretMatches(dto.password, admin?.passwordHash);
    if (!admin || admin.disabledAt || !valid) throw new UnauthorizedException('Invalid credentials');

    const sessionToken = await this.createSession('admin', admin.id);
    return { role: 'admin' as const, username: admin.username, sessionToken };
  }

  // Lets the invite page show a message for a dead link instead of a form
  async checkInvite(rawToken: string) {
    const [invite] = await this.database.db
      .select({ id: trainerInvites.id })
      .from(trainerInvites)
      .where(this.liveInvite(rawToken))
      .limit(1);
    return { valid: !!invite };
  }

  // Invite taken compare-and-set: one link, one trainer. A taken username rolls back, the link stays usable
  async registerAdmin(dto: RegisterAdminDto) {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const now = this.clock.now().toJSDate();

    const admin = await this.database.db.transaction(async (tx) => {
      const [invite] = await tx
        .update(trainerInvites)
        .set({ usedAt: now })
        .where(this.liveInvite(dto.token))
        .returning({ id: trainerInvites.id, createdByAdminId: trainerInvites.createdByAdminId });
      if (!invite) throw new BadRequestException('Invalid invite');

      // Checked before the insert: a unique violation would abort the transaction with a 500
      const [taken] = await tx.select({ id: admins.id }).from(admins).where(eq(admins.username, dto.username)).limit(1);
      if (taken) throw new ConflictException('Username taken');

      const [created] = await tx
        .insert(admins)
        .values({ username: dto.username, passwordHash, invitedByAdminId: invite.createdByAdminId })
        .returning({ id: admins.id, username: admins.username });
      await tx.update(trainerInvites).set({ usedByAdminId: created.id }).where(eq(trainerInvites.id, invite.id));
      return created;
    });

    const sessionToken = await this.createSession('admin', admin.id);
    return { username: admin.username, sessionToken };
  }

  // «Мій пароль» for a trainer or the owner: the current password, then the new one; their other sessions end
  async changePassword(user: SessionUser, dto: ChangePasswordDto) {
    const table = byRole(user, {
      member: () => {
        throw new ForbiddenException();
      },
      admin: () => admins,
      owner: () => owners,
    });
    const [row] = await this.database.db
      .select({ passwordHash: table.passwordHash })
      .from(table)
      .where(eq(table.id, user.id))
      .limit(1);
    if (!row || !(await bcrypt.compare(dto.currentPassword, row.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.database.db.update(table).set({ passwordHash }).where(eq(table.id, user.id));
    await this.database.db
      .update(sessions)
      .set({ revokedAt: this.clock.now().toJSDate() })
      .where(
        and(
          eq(sessions.principalType, user.type),
          eq(sessions.principalId, user.id),
          ne(sessions.id, user.sessionId),
          isNull(sessions.revokedAt),
        ),
      );
    return { ok: true };
  }

  async revokeSession(sessionId: string) {
    await this.database.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
  }

  async validateSessionToken(rawToken: string) {
    const tokenHash = hashToken(rawToken);

    const [session] = await this.database.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
      .limit(1);

    return session ?? null;
  }

  private async generateUniqueMemberCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const digits = crypto.randomInt(10000, 100000);
      const code = `GYM-${digits}`;
      const [existing] = await this.database.db
        .select({ id: members.id })
        .from(members)
        .where(eq(members.memberCode, code))
        .limit(1);
      if (!existing) return code;
    }
    throw new InternalServerErrorException('Failed to generate unique member code');
  }

  private async createSession(principalType: Role, principalId: string) {
    const rawToken = newToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await this.database.db.insert(sessions).values({ principalType, principalId, tokenHash, expiresAt });
    // Housekeeping must not fail the sign-in; the next one retries
    await deleteDeadSessions(this.database.db, new Date()).catch((err: unknown) =>
      this.logger.warn(`Deleting dead sessions failed: ${String(err)}`),
    );
    return rawToken;
  }

  private liveInvite(rawToken: string) {
    return and(
      eq(trainerInvites.tokenHash, hashToken(rawToken)),
      isNull(trainerInvites.usedAt),
      isNull(trainerInvites.revokedAt),
      gt(trainerInvites.expiresAt, this.clock.now().toJSDate()),
    );
  }
}
