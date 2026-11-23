import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PageLayout } from "@/components/ui/PageLayout";
import { PriceList } from "@/components/prices/PriceList";
import { AdminMenu } from "@/components/admin/AdminMenu";
import { fetchPriceList, fetchRole } from "@/lib/serverPrices";
import { homeFor } from "@/lib/loginRedirect";

// Read-only, the same list members see: only the owner changes prices (since 2026-11-23)
export default async function AdminPricesPage() {
  const session = (await cookies()).get("session")?.value;
  const role = await fetchRole(session);
  if (!role) redirect("/admin/login");
  if (role !== "admin") redirect(homeFor(role));
  const items = await fetchPriceList(session);
  if (items === "signed-out" || items === "forbidden") redirect("/admin/login");

  return (
    <PageLayout variant="top" action={<AdminMenu />}>
      <h1 className="font-geologica font-semibold text-title sm:text-display text-heading uppercase mb-2">Ціни</h1>
      <p className="text-subtle text-xs mb-6">Один прайс для всіх тренерів. Змінює ціни власник залу.</p>
      {items ? <PriceList items={items} /> : <p className="text-danger text-sm">Не вдалося завантажити ціни.</p>}
    </PageLayout>
  );
}
