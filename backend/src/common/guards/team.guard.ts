import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { allowRoles } from './allow-roles';

// The team: trainers and the owner (e.g. «Мій пароль»)
@Injectable()
export class TeamGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    return allowRoles(ctx, ['admin', 'owner']);
  }
}
