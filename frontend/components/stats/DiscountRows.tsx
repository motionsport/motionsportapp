import type { Revenue } from "@/lib/api";
import { formatUah } from "@/lib/prices";

// Under «Разом отримано» (money actually received, every discount already off): what the review and the permanent
// discounts took off and the total at price list prices (before refunds: the discounts were on what was bought). Only
// when the period had a discount (trainer's «Статистика», owner's «Статистика залу»). withTotal: a card whose header
// shows the total without a label gets the «Разом отримано» line too, unless RefundRows above already ends with it
export function DiscountRows({ revenue, withTotal }: { revenue: Revenue; withTotal?: boolean }) {
  if (revenue.discount <= 0 && revenue.permanentDiscount <= 0) return null;
  return (
    <div className="flex flex-col space-y-1.5 mt-3 pt-3 border-t border-line">
      {withTotal && revenue.refunds <= 0 && (
        <div className="flex justify-between space-x-3">
          <span className="text-subtle">Разом отримано</span>
          <span className="tabular-nums text-heading whitespace-nowrap">{formatUah(revenue.total)}</span>
        </div>
      )}
      {revenue.discount > 0 && (
        <div className="flex justify-between space-x-3">
          <span className="text-subtle whitespace-nowrap">Знижки за відгук</span>
          <span className="text-right">
            <span className="tabular-nums text-discount whitespace-nowrap">−{formatUah(revenue.discount)}</span>{" "}
            <span className="text-subtle text-xs">(тільки абонементи і групові)</span>
          </span>
        </div>
      )}
      {revenue.permanentDiscount > 0 && (
        <div className="flex justify-between space-x-3">
          <span className="text-subtle whitespace-nowrap">Постійні знижки</span>
          <span className="text-right">
            <span className="tabular-nums text-discount whitespace-nowrap">
              −{formatUah(revenue.permanentDiscount)}
            </span>{" "}
            <span className="text-subtle text-xs">(тільки абонементи)</span>
          </span>
        </div>
      )}
      <div className="flex justify-between space-x-3">
        <span className="text-subtle">За цінами прайсу</span>
        <span className="tabular-nums text-body whitespace-nowrap">
          {formatUah(revenue.total + revenue.refunds + revenue.discount + revenue.permanentDiscount)}
        </span>
      </div>
    </div>
  );
}
