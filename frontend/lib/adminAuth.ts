import { api, statusOf } from "./api";
import { homeFor } from "./loginRedirect";

// 401 → the team login; 403 (a page of another role: the owner on /admin, a trainer on /owner) → that role's
// home, so a signed-in owner opening the app isn't shown a login form. Returns true if it redirected
export function toAdminLogin(err: unknown, router: { push: (href: string) => void }): boolean {
  const status = statusOf(err);
  if (status === 401) {
    router.push("/admin/login");
    return true;
  }
  if (status !== 403) return false;
  api
    .me()
    .then((me) => router.push(homeFor(me.type)))
    .catch(() => router.push("/admin/login"));
  return true;
}
