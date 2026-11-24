"use client";
import { formatUah } from "@/lib/prices";

// The review discount at the payment step (cash or transfer only). Amounts are shown when one price is known;
// a choice of several items shows them on its own buttons
export function DiscountToggle({
  code,
  percent,
  applied,
  onChange,
  discountUah,
  payUah,
  payLabel = "До сплати",
}: {
  code: string;
  percent: number;
  applied: boolean;
  onChange: (applied: boolean) => void;
  discountUah?: number;
  payUah?: number;
  payLabel?: string;
}) {
  if (!applied) {
    return (
      <button
        type="button"
        onClick={() => onChange(true)}
        className="btn-secondary w-full py-3 rounded-lg border text-sm transition-colors"
      >
        🎁 Застосувати знижку {percent}%
      </button>
    );
  }
  return (
    <div className="rounded-xl border border-teal/30 bg-teal/5 px-4 py-3">
      <div className="flex items-center justify-between space-x-3">
        <span className="text-accent text-base">
          Знижка {percent}% ({code})
        </span>
        {discountUah !== undefined && (
          <span className="font-geologica text-accent tabular-nums whitespace-nowrap">−{formatUah(discountUah)}</span>
        )}
      </div>
      {payUah !== undefined && (
        <div className="flex items-center justify-between space-x-3 mt-1">
          <span className="text-body text-base">{payLabel}</span>
          <span className="font-geologica text-heading text-lg tabular-nums whitespace-nowrap">
            {formatUah(payUah)}
          </span>
        </div>
      )}
      <button
        type="button"
        onClick={() => onChange(false)}
        className="text-subtle text-xs underline hover:text-body py-1 mt-1"
      >
        Прибрати
      </button>
    </div>
  );
}
