import type { DiscountSummary, GymStats, Revenue, RevenueByMonth } from "@/lib/api";
import { formatUah } from "@/lib/prices";

export type GymPeriod = "all" | string; // "all" or "YYYY-MM"

// reception = club cards added at the reception, counted in «Весь зал» only (0 elsewhere)
export type GymCard = {
  key: string;
  title: string;
  disabled: boolean;
  revenue: Revenue;
  present: number | null;
  reception: number;
};

const zero = (): Revenue => ({ clubCards: 0, personal: 0, split: 0, group: 0, total: 0, discount: 0, discounted: 0 });

function revenueIn(r: RevenueByMonth, period: GymPeriod): Revenue {
  if (period === "all") return r.allTime;
  const m = r.months.find((x) => x.month === period);
  if (!m) return zero();
  const { clubCards, personal, split, group, total, discount, discounted } = m;
  return { clubCards, personal, split, group, total, discount, discounted };
}

function presentIn(p: GymStats["trainers"][number]["present"], period: GymPeriod) {
  return period === "all" ? p.allTime : (p.months.find((x) => x.month === period)?.present ?? 0);
}

function add(a: Revenue, b: Revenue): Revenue {
  return {
    clubCards: a.clubCards + b.clubCards,
    personal: a.personal + b.personal,
    split: a.split + b.split,
    group: a.group + b.group,
    total: a.total + b.total,
    discount: a.discount + b.discount,
    discounted: a.discounted + b.discounted,
  };
}

// «Весь зал» first, then every trainer in the backend's order, «Без тренера» last and only when it has money
export function gymCards(stats: GymStats, period: GymPeriod): GymCard[] {
  const trainers: GymCard[] = stats.trainers.map((t) => ({
    key: t.id,
    title: t.username,
    disabled: t.disabledAt !== null,
    revenue: revenueIn(t.revenue, period),
    present: presentIn(t.present, period),
    reception: 0,
  }));
  const unassigned = revenueIn(stats.unassigned.revenue, period);
  const rest: GymCard[] =
    unassigned.total > 0
      ? [{ key: "unassigned", title: "Без тренера", disabled: false, revenue: unassigned, present: null, reception: 0 }]
      : [];
  const all = [...trainers, ...rest];
  const reception = revenueIn(stats.reception.revenue, period);
  const gym: GymCard = {
    key: "gym",
    title: "Весь зал",
    disabled: false,
    revenue: all.reduce((sum, c) => add(sum, c.revenue), reception),
    present: trainers.reduce((sum, c) => sum + (c.present ?? 0), 0),
    reception: reception.clubCards,
  };
  return [gym, ...all];
}

// Every month any card or the review discounts have data in, for the month stepper
export function gymMonthsWithData(stats: GymStats): string[] {
  const rows = [
    ...stats.trainers.flatMap((t) => [...t.revenue.months, ...t.present.months]),
    ...stats.unassigned.revenue.months,
    ...stats.reception.revenue.months,
    ...stats.reviewDiscounts.months,
  ];
  return rows.map((r) => r.month);
}

const noDiscounts = (): DiscountSummary => ({
  given: 0,
  bar: 0,
  reception: 0,
  receptionUah: 0,
  purchases: 0,
  purchasesUah: 0,
});

// Review discounts of the picked month or all time; zeros for a month without any
export function discountSummaryIn(stats: GymStats, period: GymPeriod): DiscountSummary {
  if (period === "all") return stats.reviewDiscounts.allTime;
  const m = stats.reviewDiscounts.months.find((x) => x.month === period);
  if (!m) return noDiscounts();
  const { given, bar, reception, receptionUah, purchases, purchasesUah } = m;
  return { given, bar, reception, receptionUah, purchases, purchasesUah };
}

// «Знижки за відгук: видано 12, використано 9 (бар 3, рецепція 1: −70 ₴, застосунок 5: −350 ₴), разом −420 ₴»; only the
// places used go in brackets, «разом» only when both the reception and the app have an amount; null when nothing
// was given or used
export function discountSummaryText(s: DiscountSummary): string | null {
  const used = s.bar + s.reception + s.purchases;
  if (s.given === 0 && used === 0) return null;
  const places = [
    s.bar > 0 ? `бар ${s.bar}` : null,
    s.reception > 0 ? `рецепція ${s.reception}: −${formatUah(s.receptionUah)}` : null,
    s.purchases > 0 ? `застосунок ${s.purchases}: −${formatUah(s.purchasesUah)}` : null,
  ].filter(Boolean);
  const total = s.reception > 0 && s.purchases > 0 ? `, разом −${formatUah(s.receptionUah + s.purchasesUah)}` : "";
  return `Знижки за відгук: видано ${s.given}, використано ${used}${places.length ? ` (${places.join(", ")})` : ""}${total}`;
}
