import Link from "next/link";
import { PageLayout } from "@/components/ui/PageLayout";

// The gym's opening hours, the same for everyone: plain text, nothing to load. Members only, like «Ціни» (proxy.ts)
const HOURS = [
  { label: "Будні", days: "Пн – Пт", from: "07:00", to: "21:00" },
  { label: "Вихідні", days: "Сб – Нд", from: "10:00", to: "16:00" },
];

export default function HoursPage() {
  const back = (
    <Link href="/purchases" className="text-muted text-sm hover:text-body transition-colors">
      ← Абонемент і пакети
    </Link>
  );

  return (
    <PageLayout variant="top" action={back}>
      <h1 className="font-geologica font-semibold text-title sm:text-display text-heading uppercase mb-6">
        Графік роботи
      </h1>
      <div className="grid grid-cols-2 -m-1.5">
        {HOURS.map((h) => (
          <div key={h.label} className="m-1.5 rounded-xl border border-line bg-surface p-4">
            <div className="text-subtle text-xs font-semibold uppercase tracking-wide">{h.label}</div>
            <div className="text-heading font-medium mt-1">{h.days}</div>
            <div className="font-geologica text-heading text-2xl leading-tight tabular-nums mt-3">
              {h.from}
              <span className="block text-subtle text-xs font-sans">до</span>
              {h.to}
            </div>
          </div>
        ))}
      </div>
    </PageLayout>
  );
}
