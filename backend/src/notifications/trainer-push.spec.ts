import { NotificationService } from './notification.service';
import { PushSubscriptionsController } from './push-subscriptions.controller';

const adminSub = { endpoint: 'https://push/admin', p256dh: 'k', auth: 'a' };

function makeNotifications() {
  const push = { send: jest.fn().mockResolvedValue('ok') };
  const subs = {
    findAllAdmin: jest.fn().mockResolvedValue([adminSub]),
    findAdminByAdminId: jest.fn().mockResolvedValue([adminSub]),
    disableAdminByEndpoint: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    findForTrainers: jest.fn().mockResolvedValue([]),
  };
  const svc = new NotificationService({} as any, push as any, subs as any, {} as any);
  return { svc, push, subs };
}

// A failed push must never fail the request that sent it
describe('Push — a failure is logged, never thrown', () => {
  it('the event row cannot be written (the database is down)', async () => {
    const db = {
      insert: () => ({
        values: () => ({ onConflictDoNothing: () => ({ returning: () => Promise.reject(new Error('db down')) }) }),
      }),
    };
    const svc = new NotificationService({ db } as any, {} as any, {} as any, {} as any);
    jest.spyOn((svc as any).logger, 'error').mockImplementation(() => undefined);
    await expect(svc.enqueueAndProcess('CASH_REQUESTED', 'cash-requested:p1', {})).resolves.toBeUndefined();
    expect((svc as any).logger.error).toHaveBeenCalledWith('Push cash-requested:p1 failed', expect.any(Error));
  });
});

describe('Trainer push — member cancelled / moved', () => {
  it('sends the reason to the trainer devices only', async () => {
    const { svc, push, subs } = makeNotifications();
    await (svc as any).sendMemberCancelled({
      displayName: 'Оля',
      slotTime: '19:00',
      localDate: '2026-10-22',
      reason: 'Захворіла',
      switchedToTime: null,
    });
    expect(subs.findAll).not.toHaveBeenCalled();
    expect(push.send).toHaveBeenCalledWith(
      adminSub,
      expect.objectContaining({
        title: 'Скасування 19:00, 22.10',
        body: 'Оля: Захворіла',
        url: '/admin',
      }),
    );
  });

  it('adds what to return when the cancellation owes a half refund', async () => {
    const { svc, push } = makeNotifications();
    await (svc as any).sendMemberCancelled({
      displayName: 'Оля',
      slotTime: '19:00',
      localDate: '2026-10-22',
      reason: 'Захворіла',
      switchedToTime: null,
      refundUah: 300,
    });
    expect(push.send).toHaveBeenCalledWith(
      adminSub,
      expect.objectContaining({ body: 'Оля: Захворіла\nПовернути 300 ₴: Клієнти' }),
    );
  });

  it('names both times for a move', async () => {
    const { svc, push } = makeNotifications();
    await (svc as any).sendMemberCancelled({
      displayName: 'Іра',
      slotTime: '19:00',
      localDate: '2026-10-22',
      reason: 'Не встигаю',
      switchedToTime: '20:00',
    });
    expect(push.send).toHaveBeenCalledWith(
      adminSub,
      expect.objectContaining({ title: 'Перенесення 19:00 → 20:00, 22.10' }),
    );
  });

  describe('a small group left behind (the trainer decides, nothing is cancelled)', () => {
    const bodyFor = async (groupLeft: unknown, refundUah: number | null = null) => {
      const { svc, push } = makeNotifications();
      await (svc as any).sendMemberCancelled({
        displayName: 'Іра',
        slotTime: '19:00',
        localDate: '2026-10-22',
        reason: 'Не встигаю',
        switchedToTime: '20:00',
        refundUah,
        groupLeft,
      });
      return push.send.mock.calls[0][1].body as string;
    };

    it('says how many are left at 2 and 1', async () => {
      expect(await bodyFor({ count: 2, capacity: 8 })).toBe('Іра: Не встигаю\nМала група: на 19:00 лишилось 2 з 8');
      expect(await bodyFor({ count: 1, capacity: 8 })).toBe('Іра: Не встигаю\nМала група: на 19:00 лишилось 1 з 8');
    });

    it('says nobody is left at 0', async () => {
      expect(await bodyFor({ count: 0, capacity: 8 })).toBe('Іра: Не встигаю\nНа 19:00 нікого не лишилось');
    });

    it('nothing from 3, for an assigned training or an older event', async () => {
      expect(await bodyFor({ count: 3, capacity: 8 })).toBe('Іра: Не встигаю');
      expect(await bodyFor(null)).toBe('Іра: Не встигаю');
      expect(await bodyFor(undefined)).toBe('Іра: Не встигаю');
    });

    it('comes before the refund line', async () => {
      expect(await bodyFor({ count: 2, capacity: 8 }, 300)).toBe(
        'Іра: Не встигаю\nМала група: на 19:00 лишилось 2 з 8\nПовернути 300 ₴: Клієнти',
      );
    });
  });

  it("goes only to the member's trainer when the member has one", async () => {
    const { svc, subs } = makeNotifications();
    await (svc as any).sendMemberCancelled({
      displayName: 'Оля',
      slotTime: '19:00',
      localDate: '2026-10-22',
      reason: 'x',
      switchedToTime: null,
      trainerId: 'trainer-2',
    });
    expect(subs.findAdminByAdminId).toHaveBeenCalledWith('trainer-2');
    expect(subs.findAllAdmin).not.toHaveBeenCalled();
  });

  it('goes to every trainer for an unassigned member', async () => {
    const { svc, subs } = makeNotifications();
    await (svc as any).sendMemberCancelled({
      displayName: 'Оля',
      slotTime: '19:00',
      localDate: '2026-10-22',
      reason: 'x',
      switchedToTime: null,
      trainerId: null,
    });
    expect(subs.findAllAdmin).toHaveBeenCalled();
    expect(subs.findAdminByAdminId).not.toHaveBeenCalled();
  });

  it('disables an expired trainer subscription', async () => {
    const { svc, push, subs } = makeNotifications();
    push.send.mockResolvedValue('expired');
    await (svc as any).sendMemberCancelled({
      displayName: 'Оля',
      slotTime: '19:00',
      localDate: '2026-10-22',
      reason: 'x',
      switchedToTime: null,
    });
    expect(subs.disableAdminByEndpoint).toHaveBeenCalledWith(adminSub.endpoint);
  });
});

describe('Trainer push — cash requested', () => {
  it("goes to the member's trainer", async () => {
    const { svc, subs } = makeNotifications();
    await (svc as any).sendCashRequested({ trainerId: 'trainer-2', displayName: 'Оля', totalUah: 1400 });
    expect(subs.findAdminByAdminId).toHaveBeenCalledWith('trainer-2');
    expect(subs.findAllAdmin).not.toHaveBeenCalled();
  });

  it('a member without a trainer: goes to every trainer', async () => {
    const { svc, push, subs } = makeNotifications();
    await (svc as any).sendCashRequested({ trainerId: null, displayName: 'Оля', totalUah: 1400 });
    expect(subs.findAllAdmin).toHaveBeenCalled();
    expect(subs.findAdminByAdminId).not.toHaveBeenCalled();
    expect(push.send).toHaveBeenCalledWith(adminSub, expect.objectContaining({ body: 'Оля: 1400 ₴' }));
  });
});

describe('Booking-open push', () => {
  it('goes only to clients of trainers with group trainings today (and unassigned ones when asked)', async () => {
    const { svc, subs } = makeNotifications();
    await (svc as any).sendOpening({ localDate: '2026-10-26', trainerIds: ['trainer-1'], includeUnassigned: true });
    expect(subs.findForTrainers).toHaveBeenCalledWith(['trainer-1'], true);
    expect(subs.findAll).not.toHaveBeenCalled();
  });
});

describe('Push subscriptions — admin vs member', () => {
  const dto = { endpoint: 'https://push/1', p256dh: 'k', auth: 'a' };
  const makeSvc = () => ({ upsert: jest.fn(), upsertAdmin: jest.fn(), remove: jest.fn(), removeAdmin: jest.fn() });

  it('stores the trainer device in the admin table', async () => {
    const svc = makeSvc();
    await new PushSubscriptionsController(svc as any).subscribe(dto, {
      type: 'admin',
      id: 'admin-1',
      sessionId: 's-1',
      username: 'admin',
    });
    expect(svc.upsertAdmin).toHaveBeenCalledWith('admin-1', dto.endpoint, dto.p256dh, dto.auth);
    expect(svc.upsert).not.toHaveBeenCalled();
  });

  it('stores a member device in the members table', async () => {
    const svc = makeSvc();
    await new PushSubscriptionsController(svc as any).subscribe(dto, {
      type: 'member',
      id: 'member-1',
      sessionId: 's-2',
      memberCode: 'GYM-12345',
      displayName: 'Оля',
    });
    expect(svc.upsert).toHaveBeenCalledWith('member-1', dto.endpoint, dto.p256dh, dto.auth);
    expect(svc.upsertAdmin).not.toHaveBeenCalled();
  });
});
