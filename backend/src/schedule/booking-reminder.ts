import { DateTime } from 'luxon';
import { slotStartsAt } from './training-types';
import { slotOpensAt } from '../trainer-schedule/rules';

// «Сьогодні тренування»: a home banner (no push: «Запис відкрито» is enough) to members with a group package not
// booked that day, from LEAD minutes before the trainer's first group training. It counts down to an hour before
// it, then says «Запис ще відкритий, встигніть!» until it starts
// Fixed in code (no server setting since 2026-11-27, so a test value can't be left on); tests pass their own lead
export const REMINDER_LEAD_MINUTES = 180;
export const REMINDER_SOFT_MINUTES = 60;

export type ReminderWindow = { from: DateTime; softDeadline: DateTime; firstStart: DateTime };

// The first group training of the morning (at or before the opening: booked the day before) until it starts, then
// the first of the evening (after the opening), as the booking-open push counts. Booking opens after the reminder
// would start (the member just got «Запис відкрито»): none
export function reminderWindow(
  localDate: string,
  slotTimes: string[],
  opensAt: string,
  now: DateTime,
  leadMinutes = REMINDER_LEAD_MINUTES,
): ReminderWindow | null {
  const sorted = [...slotTimes].sort();
  const morning = sorted.find((t) => t <= opensAt);
  const evening = sorted.find((t) => t > opensAt);
  const first = morning && now < slotStartsAt(localDate, morning) ? morning : evening;
  if (!first) return null;
  const firstStart = slotStartsAt(localDate, first);
  const from = firstStart.minus({ minutes: leadMinutes });
  if (slotOpensAt(localDate, first, opensAt) > from) return null;
  return { from, softDeadline: firstStart.minus({ minutes: REMINDER_SOFT_MINUTES }), firstStart };
}
