import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchPriceList, fetchRole } from "@/lib/serverPrices";
import { homeFor } from "@/lib/loginRedirect";
import { PageLayout } from "@/components/ui/PageLayout";
import { PriceList } from "@/components/prices/PriceList";

// Rendered per request, so always current. Visitors go to /login; a trainer or the owner to their own home
export default async function PricesPage() {
  const session = (await cookies()).get("session")?.value;
  const role = await fetchRole(session);
  if (role === "admin" || role === "owner") redirect(homeFor(role));
  const items = await fetchPriceList(session);
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
