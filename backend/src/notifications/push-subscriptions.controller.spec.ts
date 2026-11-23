import { PushSubscriptionsController } from './push-subscriptions.controller';
import type { SessionUser } from '../auth/session.guard';

describe('push subscriptions by role', () => {
  const svc = { upsert: jest.fn(), upsertAdmin: jest.fn(), remove: jest.fn(), removeAdmin: jest.fn() };
  const controller = new PushSubscriptionsController(svc as any);
  const dto = { endpoint: 'https://push/1', p256dh: 'k', auth: 'a' };
  const owner: SessionUser = { type: 'owner', sessionId: 's', id: 'o1', email: 'o@g.ua', name: 'Ілона' };

  beforeEach(() => jest.clearAllMocks());

  it("the owner gets no pushes: nothing is stored as a member's or a trainer's", async () => {
    await controller.subscribe(dto, owner);
    await controller.unsubscribe({ endpoint: dto.endpoint }, owner);
    for (const fn of Object.values(svc)) expect(fn).not.toHaveBeenCalled();
  });

  it('a member and a trainer still go to their own tables', async () => {
    await controller.subscribe(dto, {
      type: 'member',
      sessionId: 's',
      id: 'm1',
      memberCode: 'GYM-1',
      displayName: 'Катя',
    });
    await controller.subscribe(dto, { type: 'admin', sessionId: 's', id: 't1', username: 'admin' });
    expect(svc.upsert).toHaveBeenCalledWith('m1', dto.endpoint, 'k', 'a');
    expect(svc.upsertAdmin).toHaveBeenCalledWith('t1', dto.endpoint, 'k', 'a');
  });
});
