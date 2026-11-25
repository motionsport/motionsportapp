import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchPriceList } from "@/lib/serverPrices";
import { PageLayout } from "@/components/ui/PageLayout";
import { PriceList } from "@/components/prices/PriceList";

// Rendered per request, so always current. Who may open it is proxy.ts's job; a dead session → /login
export default async function PricesPage() {
  const items = await fetchPriceList((await cookies()).get("session")?.value);
  if (items === "signed-out" || items === "forbidden") redirect("/login");

  const back = (
    <Link href="/purchases" className="text-muted text-sm hover:text-body transition-colors">
      ← Абонемент і пакети
    </Link>
  );

  return (
    <PageLayout variant="top" action={back}>
      <h1 className="font-geologica font-semibold text-title sm:text-display text-heading uppercase mb-6">Ціни</h1>
      {items ? <PriceList items={items} /> : <p className="text-danger text-sm">Не вдалося завантажити ціни.</p>}
    </PageLayout>
  );
}
