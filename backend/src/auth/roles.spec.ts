import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES, byRole, isRole, type SessionUser } from './roles';
import { BookingController } from '../booking/booking.controller';
import { SessionGuard } from './session.guard';
import { MemberGuard } from '../common/guards/member.guard';

const member: SessionUser = { type: 'member', sessionId: 's', id: 'm1', memberCode: 'GYM-1', displayName: 'Катя' };
const owner: SessionUser = { type: 'owner', sessionId: 's', id: 'o1', email: 'o@g.ua', name: 'Ілона' };

describe('roles: one list, a branch for every role', () => {
  it('the roles a session can have', () => {
    expect(ROLES).toEqual(['member', 'admin', 'owner']);
    expect(isRole('owner')).toBe(true);
    expect(isRole('root')).toBe(false);
  });

  it('byRole runs the handler of the user’s role, with that role’s fields', () => {
    const handlers = {
      member: (u: Extract<SessionUser, { type: 'member' }>) => `member ${u.memberCode}`,
      admin: (u: Extract<SessionUser, { type: 'admin' }>) => `admin ${u.username}`,
      owner: (u: Extract<SessionUser, { type: 'owner' }>) => `owner ${u.email}`,
    };
    expect(byRole(member, handlers)).toBe('member GYM-1');
    expect(byRole(owner, handlers)).toBe('owner o@g.ua');
  });

  it('a missing role does not compile (checked by tsc in CI)', () => {
    // @ts-expect-error every role needs a handler: a new role in ROLES breaks each byRole that forgot it
    expect(() => byRole(owner, { member: () => 1, admin: () => 2 })).toThrow();
  });

  it('bookings: members only by the guard, not by checks inside the handlers', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, BookingController)).toEqual([SessionGuard, MemberGuard]);
  });
});
