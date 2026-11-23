import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { members, admins, owners } from '../database/schema';
import { AuthService } from './auth.service';
import { isRole, type Role, type SessionUser, type UserOf } from './roles';

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

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ cookies?: Record<string, string>; user?: SessionUser }>();
    const rawToken = req.cookies?.['session'];
    if (!rawToken) throw new UnauthorizedException();

    const session = await this.authService.validateSessionToken(rawToken);
    if (!session) throw new UnauthorizedException();

    const role = session.principalType;
    if (!isRole(role)) throw new UnauthorizedException();
    const user = await (LOADERS[role] as (db: Db, id: string, sessionId: string) => Promise<SessionUser | null>)(
      this.database.db,
      session.principalId,
      session.id,
    );
    if (!user) throw new UnauthorizedException();
    req.user = user;

    return true;
  }
}
