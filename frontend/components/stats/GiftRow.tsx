import type { Revenue } from "@/lib/api";

// «Спеціальна пропозиція»: single gym visits given free in the period (trainer's «Статистика», owner's «Статистика
// залу»). Not money, so apart from the totals; only when there were some
export function GiftRow({ revenue }: { revenue: Revenue }) {
  if (revenue.gifts <= 0) return null;
  return (
    <div className="flex justify-between space-x-3 mt-3 pt-3 border-t border-line">
      <span className="text-subtle">
        Подаровано разових відвідувань <span className="text-xs">(спецпропозиція)</span>
      </span>
      <span className="tabular-nums text-body">{revenue.gifts}</span>
    </div>
  );
}
