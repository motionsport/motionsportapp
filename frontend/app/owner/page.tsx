"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { PageLayout } from "@/components/ui/PageLayout";
import { Badge } from "@/components/ui/Badge";
import { OwnerMenu } from "@/components/owner/OwnerMenu";
import { RevenueRows } from "@/components/stats/RevenueRows";
import { GiftRow } from "@/components/stats/GiftRow";
import { MonthStepper, PeriodSwitch } from "@/components/stats/PeriodPicker";
import { useAdminData } from "@/lib/useAdminData";
import { monthKeysUpToNow } from "@/lib/statsMonths";
import { discountSummaryIn, discountSummaryText, gymCards, gymMonthsWithData, type GymCard } from "./gymStats";

function Card({ card }: { card: GymCard }) {
  const gym = card.key === "gym";
  return (
    <div className={`rounded-xl border bg-surface p-4 ${gym ? "border-teal/40" : "border-line"}`}>
      <div className="flex items-baseline justify-between space-x-3 mb-3">
        <span className="text-heading font-semibold flex items-center">
          {card.title}
          {card.disabled && <Badge className="ml-2">вимкнено</Badge>}
        </span>
      </div>
      <RevenueRows revenue={card.revenue} fromReception={card.reception} />
      <GiftRow revenue={card.revenue} />
      {card.present !== null && (
        <div className="flex justify-between space-x-3 mt-3 pt-3 border-t border-line">
          <span className="text-subtle">
            Відвідувань
            {/* Visits, not people: one client coming 8 times is 8 */}
            <span className="block text-xs">тренування з ✓, гості теж, без сьогодні</span>
          </span>
          <span className={`tabular-nums ${card.present ? "text-body" : "text-muted"}`}>{card.present}</span>
        </div>
      )}
    </div>
  );
}

// The owner's home: every trainer's money and visits, and the whole gym
export default function OwnerStatsPage() {
  const { data: stats, error } = useAdminData(api.getOwnerStats);
  const loadError = error != null;
  const months = useMemo(() => monthKeysUpToNow(stats ? gymMonthsWithData(stats) : []), [stats]);
  const [allTime, setAllTime] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const selected = picked ?? months.length - 1; // the current month until one is picked
  const period = allTime ? "all" : months[selected];
  const discountLine = stats ? discountSummaryText(discountSummaryIn(stats, period)) : null;
  // Cash waiting to be handed back (the owner gets no pushes)
  const [refundsWaiting, setRefundsWaiting] = useState(0);
  useEffect(() => {
    api
      .getOwnerRefunds()
      .then((r) => setRefundsWaiting(r.length))
      .catch(() => undefined);
  }, []);

  return (
    <PageLayout variant="top" loading={!stats && !loadError} action={<OwnerMenu />}>
      <h1 className="font-geologica font-semibold text-title sm:text-display text-heading uppercase mb-2">
        Статистика залу
      </h1>
      <p className="text-subtle text-xs mb-6">
        Покупки через застосунок (готівка, переказ, онлайн) за датою оплати. Абонементи з рецепції це гроші залу: лише у
        «Весь зал», за датою додавання. І скільки відвідувань (✓, гості теж) було на тренуваннях кожного тренера.
        Сьогоднішній день зʼявиться завтра. Повернення за пізнє скасування віднімаються в місяці, коли їх віддали.
      </p>

      {refundsWaiting > 0 && (
        <Link
          href="/owner/refunds"
          className="block bg-warn-bg border border-warn-line rounded-xl px-4 py-3 mb-4 text-sm text-warn"
        >
          Чекають повернення: {refundsWaiting} →
        </Link>
      )}

      {loadError && (
        <p role="alert" className="text-danger text-sm">
          Не вдалося завантажити статистику.
        </p>
      )}

      {stats && (
        <div className="flex flex-col space-y-3">
          <div>
            <PeriodSwitch allTime={allTime} onChange={setAllTime} />
          </div>
          {!allTime && <MonthStepper months={months} index={selected} onChange={setPicked} />}
          {discountLine && (
            <p className="rounded-xl border border-teal/30 bg-teal/5 px-4 py-3 text-body text-base">{discountLine}</p>
          )}
          {gymCards(stats, period).map((card) => (
            <Card key={card.key} card={card} />
          ))}
        </div>
      )}
    </PageLayout>
  );
}
