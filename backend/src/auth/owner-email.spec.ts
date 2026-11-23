import { normalizeOwnerEmail } from './owner-email';

describe('normalizeOwnerEmail', () => {
  it('trims and lowercases, so «Owner@Gym.UA » signs in as owner@gym.ua', () => {
    expect(normalizeOwnerEmail(' Owner@Gym.UA ')).toBe('owner@gym.ua');
  });

  it('rejects what is not an email', () => {
    expect(normalizeOwnerEmail('owner')).toBeNull();
    expect(normalizeOwnerEmail('a@b')).toBeNull();
    expect(normalizeOwnerEmail('a b@c.d')).toBeNull();
  });
});
