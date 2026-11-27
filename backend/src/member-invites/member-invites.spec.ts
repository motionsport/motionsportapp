import { DateTime } from 'luxon';
import { MemberInvitesService } from './member-invites.service';
import { grantInvite } from './invite.store';
import { clubCards, memberInvites, packages } from '../database/schema';
import { KY_ZONE } from '../schedule/training-types';

const NOW = DateTime.fromISO('2026-11-27T12:00:00', { zone: KY_ZONE });

// Reads take the next result; inserts / updates are recorded and return `returning`
function makeDb(reads: unknown[][], returning: unknown[] = [{ id: 'inv-1', expiresAt: new Date() }]) {
  const queue = [...reads];
  const inserts: { table: unknown; values: any }[] = [];
  const updates: { table: unknown; set: any }[] = [];
  const chain = (result: () => unknown): any => {
    const c: any = { then: (ok: any, ko: any) => Promise.resolve(result()).then(ok, ko) };
    for (const m of ['from', 'where', 'limit', 'orderBy', 'returning']) c[m] = jest.fn(() => c);
    return c;
  };
  const db: any = {
    select: jest.fn(() => chain(() => queue.shift() ?? [])),
    insert: jest.fn((table: unknown) => ({
      values: jest.fn((values: unknown) => {
        inserts.push({ table, values });
        return chain(() => returning);
      }),
    })),
    update: jest.fn((table: unknown) => ({
      set: jest.fn((set: unknown) => {
        updates.push({ table, set });
        return chain(() => returning);
      }),
    })),
  };
  return { db, inserts, updates };
}

const P8 = { id: 'p8', title: 'Персональне', optionLabel: '8 тренувань', trainingType: 'personal', trainingCount: 8 };
const service = (db: any) => new MemberInvitesService({ db } as any, { now: () => NOW });
const dto = (over: Record<string, unknown> = {}) =>
  ({
    displayName: ' Оля ',
    clubCard: { priceItemId: 'card-1', validUntil: '2026-12-15' },
    packages: [{ priceItemId: 'p8', left: 5, validUntil: '2026-12-10' }],
    permanentDiscount: null,
    ...over,
  }) as any;

describe('MemberInvitesService.create', () => {
  it('keeps only the token hash, 7 days, the trimmed name and what the client already has', async () => {
    const { db, inserts } = makeDb([[{ section: 'club_card' }], [P8]]);
    const result = await service(db).create('t1', dto());
    expect(result.token).toEqual(expect.any(String));
    expect(inserts[0].table).toBe(memberInvites);
    expect(inserts[0].values).toMatchObject({ createdByAdminId: 't1', displayName: 'Оля' });
    expect(inserts[0].values.tokenHash).not.toBe(result.token);
    expect(inserts[0].values.expiresAt).toEqual(NOW.plus({ days: 7 }).toJSDate());
    expect(inserts[0].values.payload).toEqual({
      clubCard: { priceItemId: 'card-1', validUntil: '2026-12-15' },
      packages: [
        { trainingType: 'personal', label: 'Персональне · перенесений пакет', left: 5, validUntil: '2026-12-10' },
      ],
      permanentDiscount: null,
    });
  });

  it('400 when more are left than the package holds, or the item is not a package', async () => {
    await expect(
      service(makeDb([[{ section: 'club_card' }], [P8]]).db).create(
        't1',
        dto({ packages: [{ priceItemId: 'p8', left: 9, validUntil: '2026-12-10' }] }),
      ),
    ).rejects.toThrow('Invite form is not valid');
    await expect(
      service(makeDb([[{ section: 'club_card' }], [{ ...P8, trainingType: null }]]).db).create('t1', dto()),
    ).rejects.toThrow('Invite form is not valid');
  });

  it('400 for a date in the past or a price item that is not a club card', async () => {
    await expect(
      service(makeDb([[{ section: 'club_card' }]]).db).create(
        't1',
        dto({ packages: [{ priceItemId: 'p8', left: 2, validUntil: '2026-11-26' }] }),
      ),
    ).rejects.toThrow('Invite form is not valid');
    await expect(service(makeDb([[{ section: 'group' }]]).db).create('t1', dto())).rejects.toThrow(
      'Invite form is not valid',
    );
  });
});

describe('MemberInvitesService.revoke / relink', () => {
  it('revoke: used or revoked meanwhile → 409', async () => {
    const { db } = makeDb([], []);
    await expect(service(db).revoke('t1', 'inv-1')).rejects.toThrow('Invite is not valid');
  });

  it('relink: a new token replaces the old one, 7 days again', async () => {
    const { db, updates } = makeDb([], [{ id: 'inv-1', displayName: 'Оля', expiresAt: new Date() }]);
    const result = await service(db).relink('t1', 'inv-1');
    expect(updates[0].set.tokenHash).toEqual(expect.any(String));
    expect(updates[0].set.tokenHash).not.toBe(result.token);
  });
});

describe('grantInvite (inside the sign-up transaction)', () => {
  it('a running club card from today, a waiting one without a date; packages running from today, no purchase', async () => {
    const { db, inserts } = makeDb([[{ title: 'Повний день', optionLabel: '1 місяць', durationMonths: 1 }]]);
    await grantInvite(
      db,
      'm1',
      't1',
      {
        clubCard: { priceItemId: 'card-1', validUntil: '2026-12-15' },
        packages: [{ trainingType: 'group', label: 'Пакет · 10 занять', left: 4, validUntil: '2026-12-10' }],
        permanentDiscount: null,
      },
      '2026-11-27',
    );
    expect(inserts[0]).toMatchObject({
      table: clubCards,
      values: { label: 'Повний день · 1 місяць', validFrom: '2026-11-27', validUntil: '2026-12-15', paidUah: null },
    });
    expect(inserts[1]).toMatchObject({
      table: packages,
      values: {
        purchaseItemId: null,
        label: 'Пакет · 10 занять',
        trainingType: 'group',
        total: 4,
        activatedOn: '2026-11-27',
        validUntil: '2026-12-10',
        addedBy: 't1',
      },
    });
  });

  it('a club card without a date waits', async () => {
    const { db, inserts } = makeDb([[{ title: 'Денний', optionLabel: '1 місяць', durationMonths: 1 }]]);
    await grantInvite(
      db,
      'm1',
      't1',
      { clubCard: { priceItemId: 'card-1', validUntil: null }, packages: [], permanentDiscount: null },
      '2026-11-27',
    );
    expect(inserts[0].values).toMatchObject({ validFrom: null, validUntil: null, activateBy: '2027-02-27' });
  });
});
