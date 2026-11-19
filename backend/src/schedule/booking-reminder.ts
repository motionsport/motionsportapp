import { DateTime } from 'luxon';
import { slotStartsAt } from './training-types';
import { bookingOpensAt } from '../trainer-schedule/rules';

// «Сьогодні тренування»: a home banner (no push: «Запис відкрито» is enough) to members with a group package not
// booked that day, from LEAD minutes before the trainer's first group training. It counts down to an hour before
// it, then says «Запис ще відкритий, встигніть!» until it starts
export const DEFAULT_REMINDER_LEAD_MINUTES = 180;
export const REMINDER_SOFT_MINUTES = 60;

// BOOKING_REMINDER_LEAD_MINUTES moves the start (e.g. 480 to test at 11:00 for a 19:00 training)
export function reminderLeadMinutes(env: Record<string, string | undefined> = process.env) {
  const raw = env.BOOKING_REMINDER_LEAD_MINUTES;
  return raw ? Number(raw) : DEFAULT_REMINDER_LEAD_MINUTES;
}

export type ReminderWindow = { from: DateTime; softDeadline: DateTime; firstStart: DateTime };

// The first group training after the opening (one added before it can't be booked), like the booking-open push.
// None, or booking opens after the reminder would start (the member just got «Запис відкрито»): no reminder
export function reminderWindow(
  localDate: string,
  slotTimes: string[],
  opensAt: string,
  leadMinutes = reminderLeadMinutes(),
): ReminderWindow | null {
  const first = slotTimes.filter((t) => t > opensAt).sort()[0];
  if (!first) return null;
  const firstStart = slotStartsAt(localDate, first);
  const from = firstStart.minus({ minutes: leadMinutes });
  if (bookingOpensAt(localDate, opensAt) > from) return null;
  return { from, softDeadline: firstStart.minus({ minutes: REMINDER_SOFT_MINUTES }), firstStart };
}
