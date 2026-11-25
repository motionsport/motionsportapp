import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { SessionGuard } from './session.guard';
import type { AuthService } from './auth.service';
import type { DatabaseService } from '../database/database.service';

const member = { id: 'm1', memberCode: '123456', displayName: 'Оля', disabledAt: null };

// One member row for the member loader's select().from().where().limit()
const db = {
  select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([member]) }) }) }),
};

function setup(
  cookies: Record<string, string>,
  session: { id: string; principalType: string; principalId: string } | null,
) {
  const res = { cookie: jest.fn(), clearCookie: jest.fn() };
  const req: { cookies: Record<string, string>; user?: unknown } = { cookies };
  const context = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
  const auth = { validateSessionToken: jest.fn().mockResolvedValue(session) } as unknown as AuthService;
  const guard = new SessionGuard(auth, { db } as unknown as DatabaseService);
  return { guard, context, req, res };
}

describe('SessionGuard and the role cookie (frontend proxy.ts)', () => {
  it('a live session passes and leaves the cookies alone', async () => {
    const { guard, context, req, res } = setup(
      { session: 't', role: 'member' },
      { id: 's1', principalType: 'member', principalId: 'm1' },
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.user).toMatchObject({ type: 'member', id: 'm1' });
    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.clearCookie).not.toHaveBeenCalled();
  });

  it('a dead session drops the role cookie, so the proxy sends the browser to the login', async () => {
    const { guard, context, res } = setup({ session: 't', role: 'member' }, null);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(res.clearCookie).toHaveBeenCalledWith('role', { path: '/' });
  });

  it('no cookies at all: 401 and nothing to clear', async () => {
    const { guard, context, res } = setup({}, null);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(res.clearCookie).not.toHaveBeenCalled();
  });
});
