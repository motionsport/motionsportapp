import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { allowRoles } from './allow-roles';

// Pages both see the same way, e.g. the read-only price list
@Injectable()
export class MemberOrAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    return allowRoles(ctx, ['member', 'admin']);
  }
}
