import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { MemberGuard } from './member.guard';
import { OwnerGuard } from './owner.guard';
import { MemberOrAdminGuard } from './member-or-admin.guard';
import { TeamGuard } from './team.guard';

const ctx = (type?: string) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user: type ? { type } : undefined }) }) }) as ExecutionContext;

const lets = (guard: { canActivate: (c: ExecutionContext) => boolean }, type?: string) => {
  try {
    return guard.canActivate(ctx(type));
  } catch (err) {
    if (err instanceof ForbiddenException) return false;
    throw err;
  }
};

describe('role guards', () => {
  it.each([
    ['OwnerGuard', new OwnerGuard(), ['owner']],
    ['AdminGuard', new AdminGuard(), ['admin']],
    ['MemberGuard', new MemberGuard(), ['member']],
    ['MemberOrAdminGuard', new MemberOrAdminGuard(), ['member', 'admin']],
    ['TeamGuard', new TeamGuard(), ['admin', 'owner']],
  ])('%s lets in only %j, 403 for the rest and for no session', (_, guard, allowed) => {
    for (const type of ['member', 'admin', 'owner']) expect(lets(guard, type)).toBe(allowed.includes(type));
    expect(lets(guard)).toBe(false);
  });
});
