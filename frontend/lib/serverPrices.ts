import type { MeResponse, PriceListItem } from "@/lib/api";

export type PriceListResult = PriceListItem[] | "signed-out" | "forbidden" | null;

const backend = () => process.env.BACKEND_URL ?? "http://localhost:3001";

// Whose session this is (null = signed out or the backend didn't answer), to send another role home
export async function fetchRole(session: string | undefined): Promise<MeResponse["type"] | null> {
  if (!session) return null;
  try {
    const res = await fetch(`${backend()}/auth/me`, { headers: { Cookie: `session=${session}` }, cache: "no-store" });
    return res.ok ? ((await res.json()) as MeResponse).type : null;
  } catch {
    return null;
  }
}

// Server components only: no /api rewrite there, so call BACKEND_URL and pass on the `session` cookie only.
// The read-only list members and trainers both see (GET /prices); null = couldn't load
export async function fetchPriceList(session: string | undefined): Promise<PriceListResult> {
  if (!session) return "signed-out";
  try {
    const res = await fetch(`${backend()}/prices`, {
      headers: { Cookie: `session=${session}` },
      cache: "no-store",
    });
    if (res.status === 401) return "signed-out";
    if (res.status === 403) return "forbidden";
    return res.ok ? ((await res.json()) as PriceListItem[]) : null;
  } catch {
    return null;
  }
}
