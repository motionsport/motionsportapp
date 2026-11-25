import type { Role } from "@/lib/api";
import { homeFor } from "@/lib/loginRedirect";

// Set by the backend with the session (backend/src/auth/session-cookies.ts): the session's role. Only an
// optimistic hint for routing: the backend's guards decide what anyone gets
export const ROLE_COOKIE = "role";

// Where each role signs in. A new Role without one doesn't compile
const LOGIN: Record<Role, string> = { member: "/login", admin: "/admin/login", owner: "/admin/login" };

// Each role's pages by path prefix; `open` = pages of that prefix anyone may open (sign-in, invite link).
// /payment/return is left out on purpose: LiqPay sends the member back there from its own site
const SECTIONS: { prefix: string; role: Role; open?: string[] }[] = [
  { prefix: "/admin", role: "admin", open: ["/admin/login", "/admin/join"] },
  { prefix: "/owner", role: "owner" },
  { prefix: "/purchases", role: "member" },
  { prefix: "/prices", role: "member" },
  { prefix: "/hours", role: "member" },
];

const inside = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export function parseRole(value: string | undefined): Role | null {
  return value && Object.hasOwn(LOGIN, value) ? (value as Role) : null;
}

// Where proxy.ts sends this request (null = let it through): signed out → the section's login,
// another role → its own home. `/` is the members' schedule and the visitors' landing: the team goes home
export function redirectFor(path: string, role: Role | null): string | null {
  if (path === "/") return role && role !== "member" ? homeFor(role) : null;
  const section = SECTIONS.find((s) => inside(path, s.prefix));
  if (!section || section.open?.some((p) => inside(path, p)) || role === section.role) return null;
  return role ? homeFor(role) : LOGIN[section.role];
}
