import { DateTime } from 'luxon';
import { PermanentDiscountsService } from './permanent-discounts.service';
import { birthdayDiscounts, members } from '../database/schema';
import { KY_ZONE } from '../schedule/training-types';
import { loadBirthday, permanentKindOf } from './discount.store';
import { requireVisibleMember } from '../schedule/default-trainer';

jest.mock('./discount.store', () => ({ loadBirthday: jest.fn(), permanentKindOf: jest.fn() }));
jest.mock('../schedule/default-trainer', () => ({ requireVisibleMember: jest.fn() }));
jest.mock('../booking/group-booking', () => ({ lockMember: jest.fn().mockResolvedValue({ id: 'm1' }) }));

const NOW = DateTime.fromISO('2026-11-26T12:00:00', { zone: KY_ZONE });

function makeDb() {
  const writes: { table: unknown; values: unknown }[] = [];
  const chain: any = { where: jest.fn(() => Promise.resolve()) };
  const db: any = {
    update: jest.fn((table: unknown) => ({
      set: jest.fn((values: unknown) => {
        writes.push({ table, values });
        return chain;
      }),
    })),
    insert: jest.fn((table: unknown) => ({
      values: jest.fn((values: unknown) => {
        writes.push({ table, values });
        return Promise.resolve();
      }),
    })),
  };
  db.transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(db));
  return { db, writes };
}

const service = (db: any) => new PermanentDiscountsService({ db } as any, { now: () => NOW });

beforeEach(() => {
  (loadBirthday as jest.Mock).mockReset().mockResolvedValue(null);
  (permanentKindOf as jest.Mock).mockReset().mockResolvedValue(null);
  (requireVisibleMember as jest.Mock).mockReset().mockResolvedValue(undefined);
});

describe('PermanentDiscountsService', () => {
  it('sets the mark for a client the trainer sees, signed by the trainer', async () => {
    const { db, writes } = makeDb();
    await service(db).setKind('t1', 'm1', 'ZSU');
    expect(requireVisibleMember).toHaveBeenCalledWith(db, 't1', 'm1');
    expect(writes[0]).toMatchObject({
      table: members,
      values: { permanentDiscount: 'ZSU', permanentDiscountSetBy: 't1' },
    });
  });

  it("another trainer's client: 404 from requireVisibleMember, nothing written", async () => {
    (requireVisibleMember as jest.Mock).mockRejectedValue(new Error('Member not found'));
    const { db, writes } = makeDb();
    await expect(service(db).setKind('t2', 'm1', null)).rejects.toThrow('Member not found');
    expect(writes).toEqual([]);
  });

  it('birthday discount: given today', async () => {
    const { db, writes } = makeDb();
    await service(db).giveBirthday('t1', 'm1');
    expect(writes[0]).toMatchObject({ table: birthdayDiscounts, values: { memberId: 'm1', givenOn: '2026-11-26' } });
  });

  it('birthday discount: once a calendar year (409)', async () => {
    (loadBirthday as jest.Mock).mockResolvedValue({ givenOn: '2026-03-02', state: 'expired' });
    const { db, writes } = makeDb();
    await expect(service(db).giveBirthday('t1', 'm1')).rejects.toThrow('Birthday discount already given this year');
    expect(writes).toEqual([]);
  });
});
