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

// Revenue by column (trainer's «Статистика», owner's «Статистика залу»)
export function RevenueRows({ revenue, small }: { revenue: Revenue; small?: boolean }) {
  return (
    <div className="flex flex-col space-y-1.5">
      {REVENUE_ROWS.map(([key, title, color]) => (
        <div key={key} className={`flex justify-between space-x-3 ${small ? "text-xs" : ""}`}>
          <span className="text-subtle flex items-center">
            <span
              className={`w-2 h-2 rounded-full mr-2 shrink-0${color ? "" : " bg-subtle"}`}
              style={color ? { backgroundColor: color } : undefined}
            />
            {title}
          </span>
          <span className={`tabular-nums ${revenue[key] ? "text-body" : "text-muted"}`}>{formatUah(revenue[key])}</span>
        </div>
      ))}
    </div>
  );
}
