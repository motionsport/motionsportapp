import type { Revenue } from "@/lib/api";
import { formatUah } from "@/lib/prices";

// Under the columns, only when the period had refunds: what came in, the half refunds handed back after a late
// cancellation (by the month given back) and, last, what the gym actually has (revenue.total, already net of them)
export function RefundRows({ revenue }: { revenue: Revenue }) {
  if (revenue.refunds <= 0) return null;
  return (
    <div className="flex flex-col space-y-1.5 mt-3 pt-3 border-t border-line">
      <div className="flex justify-between space-x-3">
        <span className="text-subtle">Отримано за покупки</span>
        <span className="tabular-nums text-body whitespace-nowrap">{formatUah(revenue.total + revenue.refunds)}</span>
      </div>
      <div className="flex justify-between space-x-3">
        <span className="text-subtle">Повернення за скасування</span>
        <span className="tabular-nums text-danger whitespace-nowrap">−{formatUah(revenue.refunds)}</span>
      </div>
      <div className="flex justify-between space-x-3">
        <span className="text-heading font-semibold">Разом отримано</span>
        <span className="tabular-nums text-heading font-semibold whitespace-nowrap">{formatUah(revenue.total)}</span>
      </div>
    </div>
  );
}
