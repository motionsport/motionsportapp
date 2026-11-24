import type { Revenue } from "@/lib/api";
import { formatUah } from "@/lib/prices";
import { purchasesCount } from "@/lib/plural";

// Under «Разом отримано»: what the review discounts took off and the total at price list prices.
// Only when the period had a discount (trainer's «Статистика», owner's «Статистика залу»). withTotal: a card whose
// header shows the total without a label gets the «Разом отримано» line too
export function DiscountRows({ revenue, withTotal }: { revenue: Revenue; withTotal?: boolean }) {
  if (revenue.discount <= 0) return null;
  return (
    <div className="flex flex-col space-y-1.5 mt-3 pt-3 border-t border-line">
      {withTotal && (
        <div className="flex justify-between space-x-3">
          <span className="text-subtle">Разом отримано</span>
          <span className="tabular-nums text-heading whitespace-nowrap">{formatUah(revenue.total)}</span>
        </div>
      )}
      <div className="flex justify-between space-x-3">
        <span className="text-subtle">Знижки за відгук</span>
        <span className="tabular-nums text-body whitespace-nowrap">
          −{formatUah(revenue.discount)}{" "}
          <span className="text-subtle text-xs">({purchasesCount(revenue.discounted)})</span>
        </span>
      </div>
      <div className="flex justify-between space-x-3">
        <span className="text-subtle">За цінами прайсу</span>
        <span className="tabular-nums text-body whitespace-nowrap">{formatUah(revenue.total + revenue.discount)}</span>
      </div>
    </div>
  );
}
