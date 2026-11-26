import { ddmm, kyivToday } from "./dates";
import { kyivTime } from "./kyivTime";

const nextDay = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

// A morning training opens before its training day (the backend's slotOpensAt). Said from today, not from the
// training day: «сьогодні о 16:00», «завтра о 16:00», «28.11 о 16:00»; an opening on the training day: null
function dayBefore(openAtIso: string, localDate: string, nowIso: string): string | null {
  const openDate = kyivToday(new Date(openAtIso));
  if (openDate >= localDate) return null;
  const today = kyivToday(new Date(nowIso));
  const day = openDate === today ? "сьогодні" : openDate === nextDay(today) ? "завтра" : ddmm(openDate);
  return `${day} о ${kyivTime(openAtIso)}`;
}

// A slot card: «Запис відкриється о 16:00» on the training day, else «… сьогодні о 16:00» / «завтра о 16:00»
export function opensText(openAtIso: string, localDate: string, nowIso: string): string {
  return dayBefore(openAtIso, localDate, nowIso) ?? `о ${kyivTime(openAtIso)}`;
}

// The day's badge before booking opens: «До 16:00» on the training day, else «Запис сьогодні о 16:00» /
// «Запис завтра о 16:00» (Saturday, Monday's 9:00: Sunday)
export function opensBadge(openAtIso: string, localDate: string, nowIso: string): string {
  const before = dayBefore(openAtIso, localDate, nowIso);
  return before ? `Запис ${before}` : `До ${kyivTime(openAtIso)}`;
}
