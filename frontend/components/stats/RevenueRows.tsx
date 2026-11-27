import { Fragment } from "react";
import type { Revenue } from "@/lib/api";
import { TYPE_COLORS } from "@/lib/trainingTypes";
import { formatUah } from "@/lib/prices";

// Dot colors: training types as in the calendar, club cards in the secondary text color
const REVENUE_ROWS: [keyof Omit<Revenue, "total">, string, string][] = [
  ["clubCards", "Абонементи", ""], // bg-subtle class: theme colors aren't CSS variables here
  ["personal", "Персональні", TYPE_COLORS["personal"].border],
  ["split", "Спліт", TYPE_COLORS["split"].border],
  ["group", "Групові", TYPE_COLORS["group"].border],
];

// A revenue card's money, the same on the trainer's «Статистика» and every card of the owner's «Статистика залу»: the
// columns at price list prices, then (only when something was taken off) «Разом», the discounts and the refunds with
// a minus, and last, always, «Фактично отримано» (revenue.total, what the gym actually has). `fromReception`: the part
// of «Абонементи» added at the reception, as «з них з рецепції» under it (the owner's «Весь зал» only)
export function RevenueRows({
  revenue,
  small,
  fromReception = 0,
}: {
  revenue: Revenue;
  small?: boolean;
  fromReception?: number;
}) {
  // Before anything was taken off: the columns' sum
  const gross = revenue.total + revenue.refunds + revenue.discount + revenue.permanentDiscount;
  return (
    <div className="flex flex-col space-y-1.5">
      {REVENUE_ROWS.map(([key, title, color]) => (
        <Fragment key={key}>
          <div className={`flex justify-between space-x-3 ${small ? "text-xs" : ""}`}>
            <span className="text-subtle flex items-center">
              <span
                className={`w-2 h-2 rounded-full mr-2 shrink-0${color ? "" : " bg-subtle"}`}
                style={color ? { backgroundColor: color } : undefined}
              />
              {title}
            </span>
            <span className={`tabular-nums ${revenue[key] ? "text-body" : "text-muted"}`}>
              {formatUah(revenue[key])}
            </span>
          </div>
          {key === "clubCards" && fromReception > 0 && (
            <div className="flex justify-between space-x-3 pl-4 text-base">
              <span className="text-subtle">з них з рецепції</span>
              <span className="tabular-nums text-subtle">{formatUah(fromReception)}</span>
            </div>
          )}
        </Fragment>
      ))}
      {gross !== revenue.total && (
        <>
          <Line label="Разом" value={formatUah(gross)} top />
          {revenue.discount > 0 && (
            <Line
              label="Знижки за відгук"
              note="тільки абонементи і групові"
              value={`−${formatUah(revenue.discount)}`}
              tone="text-discount"
            />
          )}
          {revenue.permanentDiscount > 0 && (
            <Line
              label="Постійні знижки"
              note="тільки абонементи"
              value={`−${formatUah(revenue.permanentDiscount)}`}
              tone="text-discount"
            />
          )}
          {revenue.refunds > 0 && (
            <Line label="Повернення за скасування" value={`−${formatUah(revenue.refunds)}`} tone="text-danger" />
          )}
        </>
      )}
      <Line label="Фактично отримано" value={formatUah(revenue.total)} strong top={gross === revenue.total} />
    </div>
  );
}

function Line({
  label,
  note,
  value,
  tone = "text-body",
  strong,
  top,
}: {
  label: string;
  note?: string;
  value: string;
  tone?: string;
  strong?: boolean;
  top?: boolean;
}) {
  return (
    <div className={`flex justify-between space-x-3${top ? " pt-2 mt-1 border-t border-line" : ""}`}>
      <span className={strong ? "text-heading font-semibold" : "text-subtle"}>
        {label}
        {note && <span className="text-xs"> ({note})</span>}
      </span>
      <span className={`tabular-nums whitespace-nowrap ${strong ? "text-heading font-semibold" : tone}`}>{value}</span>
    </div>
  );
}
