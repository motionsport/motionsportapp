import type { BookingReminder } from "@/lib/api";

// «Сьогодні тренування» banner: a countdown until an hour before the first group training, then
// «Запис ще відкритий, встигніть!» until it starts. The backend sends it only to a member who should see it
// (today, not booked, a group package left); `now` is server time, so a wrong phone clock is harmless
export type ReminderState = { kind: "countdown"; left: string } | { kind: "hurry" } | null;

export function reminderState(reminder: BookingReminder | null, now: number): ReminderState {
  if (!reminder) return null;
  const from = Date.parse(reminder.from);
  const soft = Date.parse(reminder.softDeadline);
  const start = Date.parse(reminder.firstStart);
  if (now < from || now >= start) return null;
  if (now >= soft) return { kind: "hurry" };
  return { kind: "countdown", left: hms(soft - now) };
}

// 1:59:59, counted down to the second
export function hms(ms: number) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
