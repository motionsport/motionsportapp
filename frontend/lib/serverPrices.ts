import type { PriceListItem } from "@/lib/api";

export type PriceListResult = PriceListItem[] | "signed-out" | "forbidden" | null;

const backend = () => process.env.BACKEND_URL ?? "http://localhost:3001";

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
