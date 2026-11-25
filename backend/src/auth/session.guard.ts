import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { members, admins, owners } from '../database/schema';
import { AuthService } from './auth.service';
import { isRole, type Role, type SessionUser, type UserOf } from './roles';
import { clearRoleCookie, ROLE_COOKIE, SESSION_COOKIE } from './session-cookies';

export type { SessionUser } from './roles';

type Db = DatabaseService['db'];

// How each role's person is found; a disabled or deleted one = no session
const LOADERS: { [R in Role]: (db: Db, id: string, sessionId: string) => Promise<UserOf<R> | null> } = {
  member: async (db, id, sessionId) => {
    const [m] = await db.select().from(members).where(eq(members.id, id)).limit(1);
    if (!m || m.disabledAt) return null;
    return { type: 'member', sessionId, id: m.id, memberCode: m.memberCode, displayName: m.displayName };
  },
  admin: async (db, id, sessionId) => {
    const [a] = await db.select().from(admins).where(eq(admins.id, id)).limit(1);
    return a ? { type: 'admin', sessionId, id: a.id, username: a.username } : null;
  },
  owner: async (db, id, sessionId) => {
    const [o] = await db.select().from(owners).where(eq(owners.id, id)).limit(1);
    return o ? { type: 'owner', sessionId, id: o.id, email: o.email, name: o.name } : null;
  },
};

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly database: DatabaseService,
  ) {}

  // A dead session also drops the role cookie (frontend proxy.ts), so the proxy sends that browser to the login
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ cookies?: Record<string, string>; user?: SessionUser }>();
    const res = context.switchToHttp().getResponse<Response>();
    const user = await this.findUser(req.cookies?.[SESSION_COOKIE]);
    if (!user) {
      if (req.cookies?.[ROLE_COOKIE]) clearRoleCookie(res);
      throw new UnauthorizedException();
    }
    req.user = user;
    return true;
  }

  private async findUser(rawToken: string | undefined): Promise<SessionUser | null> {
    if (!rawToken) return null;
    const session = await this.authService.validateSessionToken(rawToken);
    if (!session) return null;
    const role = session.principalType;
    if (!isRole(role)) return null;
    return (LOADERS[role] as (db: Db, id: string, sessionId: string) => Promise<SessionUser | null>)(
      this.database.db,
      session.principalId,
      session.id,
    );
  }
}
