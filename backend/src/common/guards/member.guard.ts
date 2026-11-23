import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { allowRoles } from './allow-roles';

@Injectable()
export class MemberGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    return allowRoles(ctx, ['member']);
  }
}
