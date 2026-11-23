import { kyivToday } from "@/lib/dates";

// Same as the backend (admin/attendance-lock.ts): marks and «Не списувати» on the training day and 3 days after it
export const MARKS_EDITABLE_DAYS = 3;

export function marksLocked(localDate: string, today = kyivToday()) {
  const until = new Date(`${localDate}T12:00:00Z`);
  until.setUTCDate(until.getUTCDate() + MARKS_EDITABLE_DAYS);
  return today > until.toISOString().slice(0, 10);
}
