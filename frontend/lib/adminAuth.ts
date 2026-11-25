import { statusOf } from "./api";

// 401 = the session ended while a team page was open → the team login. Returns true if it redirected.
// Another role never opens a team page (proxy.ts), so a 403 is just an error
export function toAdminLogin(err: unknown, router: { push: (href: string) => void }): boolean {
  if (statusOf(err) !== 401) return false;
  router.push("/admin/login");
  return true;
}
