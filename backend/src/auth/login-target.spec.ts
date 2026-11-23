import { loginTarget } from './login-target';

describe('loginTarget (one team login for trainers and the owner)', () => {
  it('an email signs in the owner, lowercased', () => {
    expect(loginTarget('Owner@Gym.ua ')).toEqual({ kind: 'owner', email: 'owner@gym.ua' });
  });

  it('anything without @ is a trainer username (usernames never contain @)', () => {
    expect(loginTarget(' olena ')).toEqual({ kind: 'admin', username: 'olena' });
  });
});
