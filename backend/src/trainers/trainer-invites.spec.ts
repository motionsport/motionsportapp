import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from '../auth/auth.controller';
import { TeamGuard } from '../common/guards/team.guard';
import { owners, sessions } from '../database/schema';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { DateTime } from 'luxon';
import { AuthService } from '../auth/auth.service';
import { hashToken } from '../auth/token';
import { RegisterAdminDto } from '../auth/dto/register-admin.dto';
import { SessionGuard } from '../auth/session.guard';
import { OwnerGuard } from '../common/guards/owner.guard';
import { TrainerInvitesService } from './trainer-invites.service';
import { TrainerInvitesController } from './trainer-invites.controller';
import { KY_ZONE } from '../schedule/training-types';

const NOW = DateTime.fromISO('2026-10-24T12:00:00', { zone: KY_ZONE });
const TOKEN = 'a'.repeat(64);

// Drizzle chain mock: each awaited query takes the next result; set/values payloads are recorded
function makeDb(results: unknown[][]) {
  const queue = [...results];
  const sets: Record<string, unknown>[] = [];
  const inserts: Record<string, unknown>[] = [];
  function link(): any {
    const chain: any = {
      then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
        Promise.resolve(queue.shift() ?? []).then(resolve, reject),
    };
    for (const m of ['from', 'where', 'orderBy', 'limit', 'returning', 'leftJoin', 'innerJoin']) {
      chain[m] = jest.fn(() => chain);
    }
    chain.set = jest.fn((v: Record<string, unknown>) => {
      sets.push(v);
      return chain;
    });
    chain.values = jest.fn((v: Record<string, unknown>) => {
      inserts.push(v);
      return chain;
    });
    return chain;
  }
  const db: any = { select: jest.fn(() => link()), update: jest.fn(() => link()), insert: jest.fn(() => link()) };
  db.transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(db));
  return { db, sets, inserts };
}

const clock = { now: () => NOW };
const TRAINER = { type: 'admin' as const, sessionId: 'session-1', id: 'trainer-1', username: 'admin' };
const OWNER = { type: 'owner' as const, sessionId: 'session-1', id: 'owner-1', email: 'o@g.ua', name: 'Ілона' };
const auth = (db: any) => new AuthService({ db } as any, clock);
const invites = (db: any) => new TrainerInvitesService({ db } as any, clock);

describe('Trainer invites', () => {
  it('creates a 7-day invite and stores only the hash of the token (by the owner: no trainer author)', async () => {
    const { db, inserts } = makeDb([[{ id: 'inv-1' }]]);
    const result = await invites(db).create();

    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
    expect(result.expiresAt).toEqual(NOW.plus({ days: 7 }).toJSDate());
    expect(inserts).toEqual([{ tokenHash: hashToken(result.token), expiresAt: result.expiresAt }]);
  });

  it('answers 409 when revoking an invite that is used or already revoked', async () => {
    const { db } = makeDb([[]]);
    await expect(invites(db).revoke('inv-1')).rejects.toThrow(ConflictException);
  });

  it('only the owner invites trainers (/owner/trainer-invites)', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, TrainerInvitesController)).toEqual([SessionGuard, OwnerGuard]);
    expect(Reflect.getMetadata(PATH_METADATA, TrainerInvitesController)).toBe('owner/trainer-invites');
  });

  it("the owner's invites are listed too (no join on the trainer who made it)", async () => {
    const row = { id: 'inv-1', createdAt: NOW.toJSDate(), expiresAt: NOW.plus({ days: 7 }).toJSDate() };
    const { db } = makeDb([[row]]);
    expect(await invites(db).listActive()).toEqual([row]);
  });
});

describe('Trainer sign-up through an invite', () => {
  const dto = { token: TOKEN, username: 'olena', password: 'long-enough-pass' };

  it('creates the trainer and signs them in; an old trainer-made invite still remembers who invited', async () => {
    const { db, sets, inserts } = makeDb([
      [{ id: 'inv-1', createdByAdminId: 'trainer-1' }], // invite taken
      [], // username free
      [{ id: 'trainer-2', username: 'olena' }], // admin inserted
      [], // invite marks who used it
      [], // session
    ]);
    const result = await auth(db).registerAdmin(dto);

    expect(result.username).toBe('olena');
    expect(result.sessionToken).toMatch(/^[0-9a-f]{64}$/);
    expect(sets).toEqual([{ usedAt: NOW.toJSDate() }, { usedByAdminId: 'trainer-2' }]);
    expect(inserts[0]).toMatchObject({ username: 'olena', invitedByAdminId: 'trainer-1' });
    expect(await bcrypt.compare(dto.password, inserts[0].passwordHash as string)).toBe(true);
    expect(inserts[1]).toMatchObject({ principalType: 'admin', principalId: 'trainer-2' });
  });

  it("signs up through the owner's invite (no trainer invited them)", async () => {
    const { db, inserts } = makeDb([
      [{ id: 'inv-1', createdByAdminId: null }],
      [],
      [{ id: 'trainer-2', username: 'olena' }],
      [],
      [],
    ]);
    await auth(db).registerAdmin(dto);
    expect(inserts[0]).toMatchObject({ username: 'olena', invitedByAdminId: null });
  });

  it('refuses a used, revoked or expired link (the compare-and-set takes nothing)', async () => {
    const { db, inserts } = makeDb([[]]);
    await expect(auth(db).registerAdmin(dto)).rejects.toThrow(BadRequestException);
    expect(inserts).toEqual([]);
  });

  it('answers 409 for a taken username inside the transaction, so the invite is not spent', async () => {
    const { db, inserts } = makeDb([[{ id: 'inv-1', createdByAdminId: 'trainer-1' }], [{ id: 'trainer-x' }]]);
    await expect(auth(db).registerAdmin(dto)).rejects.toThrow(ConflictException);
    expect(db.transaction).toHaveBeenCalled();
    expect(inserts).toEqual([]);
  });

  it('accepts lowercase usernames of 3–32 characters and passwords of at least 10', async () => {
    const errors = async (v: object) =>
      (await validate(plainToInstance(RegisterAdminDto, { ...dto, ...v }))).map((e) => e.property);

    expect(await errors({})).toEqual([]);
    expect(await errors({ username: 'Olena' })).toEqual(['username']);
    expect(await errors({ username: 'ol' })).toEqual(['username']);
    expect(await errors({ username: 'olena kovalenko' })).toEqual(['username']);
    expect(await errors({ password: 'short' })).toEqual(['password']);
    expect(await errors({ token: 'abc' })).toEqual(['token']);
  });

  it('says whether a link is still valid', async () => {
    await expect(auth(makeDb([[{ id: 'inv-1' }]]).db).checkInvite(TOKEN)).resolves.toEqual({ valid: true });
    await expect(auth(makeDb([[]]).db).checkInvite(TOKEN)).resolves.toEqual({ valid: false });
  });
});

describe('Trainer password change', () => {
  it('changes the password and signs out the other sessions', async () => {
    const passwordHash = await bcrypt.hash('old-password', 4);
    const { db, sets } = makeDb([[{ passwordHash }], [], []]);
    await expect(
      auth(db).changePassword(TRAINER, {
        currentPassword: 'old-password',
        newPassword: 'new-long-password',
      }),
    ).resolves.toEqual({ ok: true });

    expect(await bcrypt.compare('new-long-password', sets[0].passwordHash as string)).toBe(true);
    expect(sets[1]).toEqual({ revokedAt: NOW.toJSDate() });
  });

  it('answers 401 for a wrong current password and changes nothing', async () => {
    const passwordHash = await bcrypt.hash('old-password', 4);
    const { db, sets } = makeDb([[{ passwordHash }]]);
    await expect(
      auth(db).changePassword(TRAINER, {
        currentPassword: 'wrong',
        newPassword: 'new-long-password',
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(sets).toEqual([]);
  });
});

describe('«Мій пароль» for the owner', () => {
  it("changes the owner's own password and signs out the owner's other sessions", async () => {
    const passwordHash = await bcrypt.hash('old-password', 4);
    const { db, sets } = makeDb([[{ passwordHash }], [], []]);
    await expect(
      auth(db).changePassword(OWNER, { currentPassword: 'old-password', newPassword: 'new-long-password' }),
    ).resolves.toEqual({ ok: true });
    expect(db.update.mock.calls.map((c: unknown[]) => c[0])).toEqual([owners, sessions]);
    expect(await bcrypt.compare('new-long-password', sets[0].passwordHash as string)).toBe(true);
  });

  it('a member has no team password (403)', async () => {
    const { db } = makeDb([]);
    await expect(
      auth(db).changePassword(
        { type: 'member', sessionId: 's', id: 'm1', memberCode: 'GYM-1', displayName: 'Катя' },
        { currentPassword: 'x', newPassword: 'new-long-password' },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('the password page is for trainers and the owner (TeamGuard)', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AuthController.prototype.changePassword) as unknown[];
    expect(guards).toEqual([SessionGuard, TeamGuard]);
  });
});

describe('Trainer sign-in', () => {
  it('a disabled trainer gets the same «Invalid credentials» even with the right password', async () => {
    const passwordHash = await bcrypt.hash('long-enough-pass', 4);
    const { db, inserts } = makeDb([[{ id: 'trainer-2', username: 'olena', passwordHash, disabledAt: new Date() }]]);
    await expect(auth(db).loginAdmin({ username: 'olena', password: 'long-enough-pass' })).rejects.toThrow(
      new UnauthorizedException('Invalid credentials'),
    );
    expect(inserts).toEqual([]); // no session
  });
});
