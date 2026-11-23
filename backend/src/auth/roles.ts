// Who a session can belong to: the one list (DB CHECK, sessions, guards, byRole). A new role goes here,
// and tsc then points at every byRole() and loader that has no branch for it
export const ROLES = ['member', 'admin', 'owner'] as const;
export type Role = (typeof ROLES)[number];

export type SessionUser =
  | { type: 'member'; sessionId: string; id: string; memberCode: string; displayName: string }
  | { type: 'admin'; sessionId: string; id: string; username: string }
  | { type: 'owner'; sessionId: string; id: string; email: string; name: string };

export type UserOf<R extends Role> = Extract<SessionUser, { type: R }>;

export type RoleHandlers<T> = { [R in Role]: (user: UserOf<R>) => T };

export const isRole = (value: string): value is Role => (ROLES as readonly string[]).includes(value);

// Behaviour that differs by role: a handler for every role, so none falls into another's branch.
// The result is the union of the handlers' results
export function byRole<H extends RoleHandlers<unknown>>(user: SessionUser, handlers: H): ReturnType<H[Role]> {
  return (handlers[user.type] as (u: SessionUser) => ReturnType<H[Role]>)(user);
}
