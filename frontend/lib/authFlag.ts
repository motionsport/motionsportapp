import type { Role } from "@/lib/api";
import { homeFor } from "@/lib/loginRedirect";

// What this browser remembers about its sign-in. Only a hint: the session cookie (httpOnly) decides,
// and a wrong hint ends on a 401 / 403 that toAdminLogin corrects. Storage can be off (private mode)
const AUTHED = "mg_authed"; // "1" = signed in: `/` asks the API instead of showing the landing
const ROLE = "mg_role"; // whose session: `/` sends a trainer or the owner home without a 403

const ROLES: readonly Role[] = ["member", "admin", "owner"];

export function rememberSignIn(role: Role) {
  try {
    localStorage.setItem(AUTHED, "1");
    localStorage.setItem(ROLE, role);
  } catch {}
}

export function forgetSignIn() {
  try {
    localStorage.removeItem(AUTHED);
    localStorage.removeItem(ROLE);
  } catch {}
}

// No flag: `/` shows the landing without calling the API (avoids a 401 in the console). Storage off: ask the API
export function rememberedSignIn(): boolean {
  try {
    return localStorage.getItem(AUTHED) === "1";
  } catch {
    return true;
  }
}

export function rememberedRole(): Role | null {
  try {
    const role = localStorage.getItem(ROLE);
    return ROLES.find((r) => r === role) ?? null;
  } catch {
    return null;
  }
}

// The schedule page is the members' home: a remembered trainer or owner goes to theirs
export function teamHomeOnStart(role: Role | null): string | null {
  return role && role !== "member" ? homeFor(role) : null;
}
