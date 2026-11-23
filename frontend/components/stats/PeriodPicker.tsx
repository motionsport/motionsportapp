import { monthName } from "@/lib/statsMonths";

const segButton = (on: boolean) =>
  `px-3.5 py-1.5 rounded-full transition-colors ${on ? "bg-teal text-on-teal font-semibold" : "text-subtle hover:text-body"}`;

// «Весь час» / «Місяць» toggle
export function PeriodSwitch({ allTime, onChange }: { allTime: boolean; onChange: (allTime: boolean) => void }) {
  return (
    <div className="inline-flex border border-line rounded-full p-[3px] bg-surface" role="group" aria-label="Період">
      <button type="button" onClick={() => onChange(true)} aria-pressed={allTime} className={segButton(allTime)}>
        Весь час
      </button>
      <button type="button" onClick={() => onChange(false)} aria-pressed={!allTime} className={segButton(!allTime)}>
        Місяць
      </button>
    </div>
  );
}

const stepButton = "w-9 h-9 rounded-full border border-line bg-surface text-heading disabled:opacity-35";

// ‹ Листопад 2026 › through `months` (oldest first); `index` is the shown one
export function MonthStepper({
  months,
  index,
  onChange,
}: {
  months: string[];
  index: number;
  onChange: (index: number) => void;
}) {
  return (
    <div className="flex items-center justify-between space-x-3">
      <button
        type="button"
        onClick={() => onChange(index - 1)}
        disabled={index === 0}
        aria-label="Попередній місяць"
        className={stepButton}
      >
        ‹
      </button>
      <span className="text-heading font-semibold">{monthName(months[index])}</span>
      <button
        type="button"
        onClick={() => onChange(index + 1)}
        disabled={index === months.length - 1}
        aria-label="Наступний місяць"
        className={stepButton}
      >
        ›
      </button>
    </div>
  );
}
