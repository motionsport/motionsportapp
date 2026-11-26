import { ddmm, kyivToday } from "./dates";
import { kyivTime } from "./kyivTime";

const nextDay = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

// «сьогодні о 16:00», «завтра о 16:00», «29.11 о 16:00»: the day counted from today (the server's), since a morning
// training opens the day before and the evening on its day
function dayAt(openAtIso: string, nowIso: string): string {
  const openDate = kyivToday(new Date(openAtIso));
  const today = kyivToday(new Date(nowIso));
  const day = openDate === today ? "сьогодні" : openDate === nextDay(today) ? "завтра" : ddmm(openDate);
  return `${day} о ${kyivTime(openAtIso)}`;
}

// A slot card and the trainer's panel: «Запис відкриється сьогодні о 16:00»
export function opensText(openAtIso: string, nowIso: string): string {
  return `Запис відкриється ${dayAt(openAtIso, nowIso)}`;
}

type BadgeSlot = { status: string; started?: boolean; bookingOpenAt?: string };

// The day's badge names what opens next: «Запис на ранкове групове відкриється сьогодні о 16:00» (a morning one
// opens the day before its day), «Запис на вечірні групові …» (on its day); one or several of that kind not started
export function opensBadge(dayOpenAtIso: string, localDate: string, slots: BadgeSlot[], nowIso: string): string {
  const morning = (iso: string) => kyivToday(new Date(iso)) < localDate;
  const isMorning = morning(dayOpenAtIso);
  const count = slots.filter(
    (s) => s.status === "ACTIVE" && !s.started && s.bookingOpenAt && morning(s.bookingOpenAt) === isMorning,
  ).length;
  const what = isMorning
    ? count > 1
      ? "ранкові групові"
      : "ранкове групове"
    : count > 1
      ? "вечірні групові"
      : "вечірнє групове";
  return `Запис на ${what} відкриється ${dayAt(dayOpenAtIso, nowIso)}`;
}
