import type { GymStats, Revenue, RevenueByMonth } from "@/lib/api";

export type GymPeriod = "all" | string; // "all" or "YYYY-MM"

export type GymCard = { key: string; title: string; disabled: boolean; revenue: Revenue; present: number | null };

const zero = (): Revenue => ({ clubCards: 0, personal: 0, split: 0, group: 0, total: 0 });

function revenueIn(r: RevenueByMonth, period: GymPeriod): Revenue {
  if (period === "all") return r.allTime;
  const m = r.months.find((x) => x.month === period);
  return m ? { clubCards: m.clubCards, personal: m.personal, split: m.split, group: m.group, total: m.total } : zero();
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
  }));
  const unassigned = revenueIn(stats.unassigned.revenue, period);
  const rest: GymCard[] =
    unassigned.total > 0
      ? [{ key: "unassigned", title: "Без тренера", disabled: false, revenue: unassigned, present: null }]
      : [];
  const all = [...trainers, ...rest];
  const gym: GymCard = {
    key: "gym",
    title: "Весь зал",
    disabled: false,
    revenue: all.reduce((sum, c) => add(sum, c.revenue), zero()),
    present: trainers.reduce((sum, c) => sum + (c.present ?? 0), 0),
  };
  return [gym, ...all];
}

// Every month any card has data in, for the month stepper
export function gymMonthsWithData(stats: GymStats): string[] {
  const rows = [
    ...stats.trainers.flatMap((t) => [...t.revenue.months, ...t.present.months]),
    ...stats.unassigned.revenue.months,
  ];
  return rows.map((r) => r.month);
}
