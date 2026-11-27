"use client";
import { useState } from "react";
import { api, TrainerStats } from "@/lib/api";
import { PageLayout } from "@/components/ui/PageLayout";
import { AdminMenu } from "@/components/admin/AdminMenu";
import { formatUah } from "@/lib/prices";
import { useAdminData } from "@/lib/useAdminData";
import { monthKeysUpToNow, monthName } from "@/lib/statsMonths";
import { RevenueRows } from "@/components/stats/RevenueRows";
import { DiscountRows } from "@/components/stats/DiscountRows";
import { RefundRows } from "@/components/stats/RefundRows";
import { GiftRow } from "@/components/stats/GiftRow";
import { MonthStepper, PeriodSwitch } from "@/components/stats/PeriodPicker";

const sectionTitle = "font-geologica font-semibold text-heading uppercase mb-3";
const label = "text-subtle text-xs font-semibold uppercase tracking-wide mb-2";

const CHART_MONTHS = 12;
const SHORT_MONTHS = ["січ", "лют", "бер", "кві", "тра", "чер", "лип", "сер", "вер", "жов", "лис", "гру"];

type MonthRevenue = TrainerStats["revenue"]["months"][number];

const noRevenue = (month: string): MonthRevenue => ({
  month,
  clubCards: 0,
  personal: 0,
  split: 0,
  group: 0,
  total: 0,
  discount: 0,
  discounted: 0,
  permanentDiscount: 0,
  refunds: 0,
  gifts: 0,
});

// From the first paid month (at least the last 12) to the current Kyiv month, zero-filled
function monthsUpToNow(months: MonthRevenue[], alsoMonths: string[] = []) {
  return monthKeysUpToNow([...months.map((m) => m.month), ...alsoMonths]).map(
    (k) => months.find((x) => x.month === k) ?? noRevenue(k),
  );
}

const WEEKDAYS = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

// "ср, 21 жовтня"
function dayName(localDate: string) {
  return new Date(`${localDate}T12:00:00`).toLocaleDateString("uk-UA", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

// 1 людина, 3 людини, 5 людей
function people(n: number) {
  const tens = n % 100;
  const ones = n % 10;
  const word = tens >= 11 && tens <= 14 ? "людей" : ones === 1 ? "людина" : ones >= 2 && ones <= 4 ? "людини" : "людей";
  return `${n} ${word}`;
}

const BarsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M5 20V12M12 20V5M19 20v-9" strokeLinecap="round" />
  </svg>
);

// One period card, or a 12-month bar chart; the picked month carries over between them
function RevenueBlock({
  revenue,
  reception,
}: {
  revenue: TrainerStats["revenue"];
  reception: TrainerStats["reception"];
}) {
  const months = monthsUpToNow(
    revenue.months,
    reception.months.map((m) => m.month),
  );
  const [chart, setChart] = useState(false);
  const [allTime, setAllTime] = useState(false);
  const [selected, setSelected] = useState(months.length - 1);
  const month = months[selected];
  const shown = chart ? months.slice(-CHART_MONTHS) : [];
  const offset = months.length - shown.length;
  const max = Math.max(1, ...shown.map((m) => m.total));
  // Club cards this trainer added at the reception in the shown period
  const fromReception =
    allTime && !chart
      ? reception.allTime.clubCards
      : (reception.months.find((m) => m.month === month.month)?.clubCards ?? 0);

  return (
    <div className="flex flex-col space-y-3">
      <div className="flex items-center justify-between space-x-3">
        {chart ? (
          <span className="text-subtle">
            За весь час: <span className="text-heading tabular-nums">{formatUah(revenue.allTime.total)}</span>
          </span>
        ) : (
          <PeriodSwitch allTime={allTime} onChange={setAllTime} />
        )}
        <button
          type="button"
          onClick={() => {
            setChart(!chart);
            // An older pick than the chart shows goes to the current month
            if (!chart && selected < months.length - CHART_MONTHS) setSelected(months.length - 1);
            setAllTime(false);
          }}
          aria-pressed={chart}
          className={`btn-ghost border rounded-full px-3 py-1.5 flex items-center shrink-0 transition-colors ${chart ? "text-accent" : ""}`}
        >
          <BarsIcon />
          <span className="ml-1.5">Графік</span>
        </button>
      </div>

      {chart && (
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-end space-x-1.5 h-36 border-b border-line">
            {shown.map((m, i) => (
              <button
                type="button"
                key={m.month}
                onClick={() => setSelected(offset + i)}
                aria-label={`${monthName(m.month)}: ${formatUah(m.total)}`}
                aria-pressed={offset + i === selected}
                className={`flex-1 rounded-t-md transition-colors ${offset + i === selected ? "bg-teal" : "bg-line hover:bg-muted"}`}
                style={{ height: `${Math.max(3, (m.total / max) * 100)}%` }}
              />
            ))}
          </div>
          <div className="flex space-x-1.5 mt-1.5">
            {shown.map((m, i) => (
              <span
                key={m.month}
                className={`flex-1 text-center text-[10px] ${offset + i === selected ? "text-heading" : "text-muted"}`}
              >
                {SHORT_MONTHS[Number(m.month.slice(5)) - 1]}
              </span>
            ))}
          </div>
        </div>
      )}

      {!chart && !allTime && (
        <MonthStepper months={months.map((m) => m.month)} index={selected} onChange={setSelected} />
      )}

      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between space-x-3 mb-3">
          <span className={chart ? "text-heading font-semibold" : "text-subtle"}>
            {chart ? monthName(month.month) : "Разом отримано"}
          </span>
          <span className="font-geologica text-heading tabular-nums text-sm">
            {formatUah(allTime && !chart ? revenue.allTime.total : month.total)}
          </span>
        </div>
        <RevenueRows revenue={allTime && !chart ? revenue.allTime : month} />
        <RefundRows revenue={allTime && !chart ? revenue.allTime : month} />
        <DiscountRows revenue={allTime && !chart ? revenue.allTime : month} withTotal={chart} />
        <GiftRow revenue={allTime && !chart ? revenue.allTime : month} />
        {fromReception > 0 && (
          <div className="mt-3 pt-3 border-t border-line">
            <div className="flex justify-between space-x-3">
              <span className="text-subtle">Абонементи з рецепції</span>
              <span className="tabular-nums text-body">{formatUah(fromReception)}</span>
            </div>
            <p className="text-subtle text-xs mt-1">Гроші залу, у «Разом отримано» не входять</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StatsPage() {
  const { data: stats, error } = useAdminData(api.getStats);
  const loadError = error != null;

  const maxAvg = Math.max(1, ...(stats?.weekdays.map((w) => w.avgPresent) ?? []));

  return (
    <PageLayout variant="top" loading={!stats && !loadError} action={<AdminMenu />}>
      <h1 className="font-geologica font-semibold text-title sm:text-display text-heading uppercase mb-6">
        Статистика
      </h1>

      {loadError && (
        <p role="alert" className="text-danger text-sm">
          Не вдалося завантажити статистику.
        </p>
      )}

      {stats && (
        <div className="flex flex-col space-y-8">
          <section>
            <h2 className={sectionTitle}>Прибуток</h2>
            <p className="text-subtle text-xs mb-3">
              Покупки ваших клієнтів через застосунок, за датою оплати. Абонементи з рецепції, які ви додали, окремо: це
              гроші залу.
            </p>

            <RevenueBlock revenue={stats.revenue} reception={stats.reception} />
          </section>

          <section>
            <h2 className={sectionTitle}>Завантаженість</h2>
            <p className="text-subtle text-xs mb-3">
              Скільки людей прийшло (✓) на ваші тренування, гості теж. Сьогоднішній день зʼявиться завтра.
            </p>

            {stats.busiestDays.length === 0 ? (
              <p className="text-muted text-sm">Ще немає минулих тренувань з відмітками.</p>
            ) : (
              <div className="flex flex-col space-y-6">
                <div>
                  <h3 className={label}>Найбільше людей</h3>
                  <div className="flex flex-col">
                    {stats.busiestDays.map((d) => (
                      <div
                        key={d.localDate}
                        className="flex justify-between space-x-3 py-1.5 border-b border-line last:border-0"
                      >
                        <span className="text-heading">{dayName(d.localDate)}</span>
                        <span className="text-body tabular-nums">{people(d.present)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className={label}>У середньому за день тижня</h3>
                  <div className="flex flex-col space-y-2">
                    {stats.weekdays.map((w) => (
                      <div key={w.weekday} className="flex items-center space-x-3">
                        <span className="text-subtle w-6 shrink-0">{WEEKDAYS[w.weekday]}</span>
                        <div className="flex-1 h-2 rounded-full bg-line overflow-hidden">
                          <div
                            className="h-full rounded-full bg-teal"
                            style={{ width: `${(w.avgPresent / maxAvg) * 100}%` }}
                          />
                        </div>
                        <span className="text-body tabular-nums w-10 text-right shrink-0">
                          {w.avgPresent.toLocaleString("uk-UA")}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-muted text-xs mt-2">Середнє за всі дні, коли у вас були тренування.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </PageLayout>
  );
}
