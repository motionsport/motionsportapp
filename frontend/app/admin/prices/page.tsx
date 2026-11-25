import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PageLayout } from "@/components/ui/PageLayout";
import { PriceList } from "@/components/prices/PriceList";
import { AdminMenu } from "@/components/admin/AdminMenu";
import { fetchPriceList } from "@/lib/serverPrices";

// Read-only, the same list members see: only the owner changes prices (since 2026-11-23).
// Who may open it is the layout's job; "forbidden" (another role) is left to the layout's redirect
export default async function AdminPricesPage() {
  const items = await fetchPriceList((await cookies()).get("session")?.value);
  if (items === "signed-out") redirect("/admin/login");

  return (
    <PageLayout variant="top" action={<AdminMenu />}>
      <h1 className="font-geologica font-semibold text-title sm:text-display text-heading uppercase mb-2">Ціни</h1>
      <p className="text-subtle text-xs mb-6">Один прайс для всіх тренерів. Змінює ціни власник залу.</p>
      {Array.isArray(items) ? (
        <PriceList items={items} />
      ) : (
        <p className="text-danger text-sm">Не вдалося завантажити ціни.</p>
      )}
    </PageLayout>
  );
}
