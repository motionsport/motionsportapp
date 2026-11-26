import { DateTime } from 'luxon';
import { OwnerMembersService } from './owner-members.service';
import { freezes, members, payments, purchases, pushSubscriptions, sessions, vacancyAlerts } from '../database/schema';
import { KY_ZONE } from '../schedule/training-types';
import { lockMember } from '../booking/group-booking';
import { cancelBookingsAhead } from '../booking/cancel-ahead';

jest.mock('../booking/group-booking', () => ({ lockMember: jest.fn() }));
jest.mock('../booking/cancel-ahead', () => ({ cancelBookingsAhead: jest.fn() }));

const NOW = DateTime.fromISO('2026-11-26T12:00:00', { zone: KY_ZONE });

// Reads take the next result; updates return `returning` once (the disable compare-and-set)
function makeDb(reads: unknown[][], returning: unknown[] = [{ id: 'm1' }]) {
  const queue = [...reads];
  const updates: { table: unknown; set: unknown }[] = [];
  let firstUpdate = true;
  const chain = (result: () => unknown): any => {
    const c: any = { then: (ok: any, ko: any) => Promise.resolve(result()).then(ok, ko) };
    for (const m of ['from', 'where', 'limit', 'returning', 'leftJoin', 'orderBy']) c[m] = jest.fn(() => c);
    return c;
  };
  const db: any = {
    select: jest.fn(() => chain(() => queue.shift() ?? [])),
    update: jest.fn((table: unknown) => ({
      set: jest.fn((set: unknown) => {
        updates.push({ table, set });
        const result = firstUpdate ? returning : [];
        firstUpdate = false;
        return chain(() => result);
      }),
    })),
  };
  db.transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(db));
  return { db, updates };
}

const service = (db: any) => {
  const notifications = { enqueueAndProcess: jest.fn().mockResolvedValue(undefined) };
  return {
    svc: new OwnerMembersService({ db } as any, { now: () => NOW }, notifications as any),
    notifications,
  };
};

beforeEach(() => {
  (lockMember as jest.Mock).mockReset().mockResolvedValue({ id: 'm1' });
  (cancelBookingsAhead as jest.Mock).mockReset().mockResolvedValue([]);
});

describe('OwnerMembersService.disable', () => {
  it('signs out, pushes off, cancels the unpaid purchase, the freeze request and bookings ahead', async () => {
    const { db, updates } = makeDb([[{ id: 'p1' }]]);
    await service(db).svc.disable('owner-1', 'm1');
    expect(updates.map((u) => u.table)).toEqual([
      members,
      sessions,
      pushSubscriptions,
      vacancyAlerts,
      payments,
      purchases,
      freezes,
    ]);
    expect(updates[0].set).toMatchObject({ disabledByOwnerId: 'owner-1' });
    expect(updates[5].set).toMatchObject({ status: 'CANCELLED' });
    expect(cancelBookingsAhead).toHaveBeenCalledWith(db, 'm1', NOW);
  });

  it("a seat freed below the norm: «З'явилось місце» to the members waiting, nothing to the trainer", async () => {
    (cancelBookingsAhead as jest.Mock).mockResolvedValue([
      { id: 'b1', slotId: 's1', slotTime: '19:00', localDate: '2026-11-27' },
    ]);
    const { db } = makeDb([[]]);
    const { svc, notifications } = service(db);
    await svc.disable('owner-1', 'm1');
    expect(notifications.enqueueAndProcess).toHaveBeenCalledTimes(1);
    expect(notifications.enqueueAndProcess).toHaveBeenCalledWith('VACANCY', 'vacancy:s1:b1', expect.anything());
  });

  it('already disabled: nothing else changes', async () => {
    const { db, updates } = makeDb([], []);
    await service(db).svc.disable('owner-1', 'm1');
    expect(updates.map((u) => u.table)).toEqual([members]);
    expect(cancelBookingsAhead).not.toHaveBeenCalled();
  });
});

describe('OwnerMembersService.enable', () => {
  it('clears the disable', async () => {
    const { db, updates } = makeDb([]);
    await service(db).svc.enable('m1');
    expect(updates[0]).toEqual({ table: members, set: { disabledAt: null, disabledByOwnerId: null } });
  });
});
