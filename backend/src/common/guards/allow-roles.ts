import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { SessionUser } from '../../auth/session.guard';

// Shared by the role guards: 403 unless the signed-in user has one of these roles
export function allowRoles(ctx: ExecutionContext, roles: readonly SessionUser['type'][]): true {
  const user = ctx.switchToHttp().getRequest<{ user?: SessionUser }>().user;
  if (!user || !roles.includes(user.type)) throw new ForbiddenException();
  return true;
}
