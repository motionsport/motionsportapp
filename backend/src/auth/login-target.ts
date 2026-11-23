import { normalizeOwnerEmail } from './owner-email';

export type LoginTarget = { kind: 'owner'; email: string } | { kind: 'admin'; username: string };

// Trainer usernames never contain @ (^[a-z0-9._-]{3,32}$), so an @ means the owner's email
export function loginTarget(login: string): LoginTarget {
  if (login.includes('@')) return { kind: 'owner', email: normalizeOwnerEmail(login) ?? login.trim().toLowerCase() };
  return { kind: 'admin', username: login.trim() };
}
