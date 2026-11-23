import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { SessionUser, UserOf } from './roles';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): SessionUser => {
  return ctx.switchToHttp().getRequest<{ user: SessionUser }>().user;
});

// Behind MemberGuard: the member, already typed as one (the guard has checked the role)
export const CurrentMember = createParamDecorator((_data: unknown, ctx: ExecutionContext): UserOf<'member'> => {
  return ctx.switchToHttp().getRequest<{ user: UserOf<'member'> }>().user;
});
