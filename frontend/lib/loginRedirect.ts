import type { Role } from "@/lib/api";

export type TeamRole = Exclude<Role, "member">;

// Each role's home, after the team login and when a page belongs to another role. A new Role without a home
// doesn't compile
const HOME: Record<Role, string> = { admin: "/admin", owner: "/owner", member: "/" };

export function homeFor(role: Role): string {
  return HOME[role];
}

// A page of one role opened by another (e.g. the owner on the trainer's «Мій пароль»): where to send them
export function elsewhereFor(who: Role, pageRole: TeamRole): string | null {
  return who === pageRole ? null : homeFor(who);
}
