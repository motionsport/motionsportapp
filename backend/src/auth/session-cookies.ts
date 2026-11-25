import type { Response } from 'express';
import type { Role } from './roles';

export const SESSION_COOKIE = 'session';
// The session's role, read by the frontend's proxy.ts to route each role to its pages. Only an optimistic hint:
// it grants nothing (the guards decide every request), so it isn't signed, and it is `lax`, not `strict`: a link to
// the app from another site (a messenger) must still carry it, or the proxy would send a signed-in person to the
// login. Same name in frontend/lib/roleRoutes.ts
export const ROLE_COOKIE = 'role';

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const options = (sameSite: 'strict' | 'lax') => ({
  httpOnly: true,
  sameSite,
  secure: process.env.NODE_ENV === 'production',
  maxAge: MAX_AGE_MS,
  path: '/',
});

// Every sign-in: the session and its role, for the same 30 days
export function setSessionCookies(res: Response, token: string, role: Role) {
  res.cookie(SESSION_COOKIE, token, options('strict'));
  res.cookie(ROLE_COOKIE, role, options('lax'));
}

export function clearRoleCookie(res: Response) {
  res.clearCookie(ROLE_COOKIE, { path: '/' });
}

export function clearSessionCookies(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  clearRoleCookie(res);
}
