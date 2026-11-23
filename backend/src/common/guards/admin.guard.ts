import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { allowRoles } from './allow-roles';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    return allowRoles(ctx, ['admin']);
  }
}
