import type { Role } from "@/lib/api";

export type TeamRole = Exclude<Role, "member">;

// Each role's home, after the team login and when a page belongs to another role. A new Role without a home
// doesn't compile
const HOME: Record<Role, string> = { admin: "/admin", owner: "/owner", member: "/" };

export function homeFor(role: Role): string {
  return HOME[role];
}

// After the session cookies change (sign-in, sign-out, a session that ended): a full page load, not router.push.
// Next's client cache keeps where a link went under the old role cookie (proxy.ts's redirect), so a client-side
// move could send the person back where they were («← Назад» on the login kept opening it again). The client cache
// is cleared on a page load (Next docs, glossary «Client Cache»)
export function reloadTo(href: string) {
  window.location.assign(href);
}
