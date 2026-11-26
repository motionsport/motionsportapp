import type { PermanentDiscountNow } from "@/lib/api";
import { DISCOUNT_NAME } from "@/lib/permanentDiscount";

// «Абонемент і пакети»: the member's permanent or today's birthday discount, so they know a club card is cheaper
export function PermanentDiscountCard({ discount }: { discount: PermanentDiscountNow }) {
  return (
    <div className="rounded-xl border border-discount/35 bg-discount/10 p-4">
      <span className="inline-block text-xs font-semibold border border-discount/35 bg-discount/10 text-discount rounded-full px-2.5 py-1">
        {DISCOUNT_NAME[discount.kind]} {discount.percent}%
      </span>
      <p className="text-subtle text-xs mt-2">
        {discount.kind === "BIRTHDAY"
          ? "Діє лише сьогодні, на абонемент у зал (крім «Разового відвідування»)."
          : "На кожен абонемент у зал (крім «Разового відвідування»)."}
      </p>
    </div>
  );
}
