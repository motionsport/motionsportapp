import { kyivToday } from "./dates";
import { kyivTime } from "./kyivTime";

// A morning training opens the day before its training day (the backend's slotOpensAt)
export const opensDayBefore = (openAtIso: string, localDate: string) => kyivToday(new Date(openAtIso)) < localDate;

// When booking opens, said from the training day: «напередодні о 10:00» or «о 10:00»
export function opensText(openAtIso: string, localDate: string): string {
  const time = kyivTime(openAtIso);
  return opensDayBefore(openAtIso, localDate) ? `напередодні о ${time}` : `о ${time}`;
}

// The day's badge before booking opens: «До 10:00», or «Напередодні о 10:00» when its first training opens the day
// before (Saturday, Monday's 9:00: Sunday 10:00)
export function opensBadge(openAtIso: string, localDate: string): string {
  const time = kyivTime(openAtIso);
  return opensDayBefore(openAtIso, localDate) ? `Напередодні о ${time}` : `До ${time}`;
}
