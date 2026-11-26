import { DateTime } from 'luxon';
import { KY_ZONE } from '../schedule/training-types';

// Club card and package dates: Kyiv YYYY-MM-DD, compared as strings. A month ends on the same date
// (or the month's last day), inclusive

export const plusMonths = (date: string, months: number) =>
  DateTime.fromISO(date, { zone: KY_ZONE }).plus({ months }).toISODate()!;

// Months to activate a club card or start a package; not activated by then: it burns
export const ACTIVATE_WITHIN_MONTHS = 3;
export const activateByFor = (purchasedOn: string) => plusMonths(purchasedOn, ACTIVATE_WITHIN_MONTHS);

// From the activation day; 0 months = that day only
export const validUntilFor = (activatedOn: string, months: number) => plusMonths(activatedOn, months);

export type PassDates = {
  purchasedOn: string;
  activateBy: string;
  activatedOn: string | null;
  validUntil: string | null;
};

// From the purchase day until activate_by (waiting) or valid_until (activated)
export const passUsableOn = (p: PassDates, date: string) =>
  p.purchasedOn <= date && date <= (p.activatedOn ? p.validUntil! : p.activateBy);

export type CardState = 'waiting' | 'active' | 'expired' | 'burned';

export function cardState(
  c: { activateBy: string; validFrom: string | null; validUntil: string | null },
  today: string,
): CardState {
  if (!c.validFrom) return today <= c.activateBy ? 'waiting' : 'burned';
  return today <= c.validUntil! ? 'active' : 'expired';
}

// A club card lets the member into the gym on that date: active over it, or waiting (bought by then, not burned:
// the first ✓ on a personal / split training starts it that day). A used «Разове відвідування» covers its day only
export const cardUsableOn = (
  c: { purchasedOn: string; activateBy: string; validFrom: string | null; validUntil: string | null },
  date: string,
) => (c.validFrom ? c.validFrom <= date && date <= c.validUntil! : c.purchasedOn <= date && date <= c.activateBy);

export type PassState = 'waiting' | 'active' | 'expired' | 'burned' | 'used';

export function passState(p: PassDates & { left: number }, today: string): PassState {
  if (p.left <= 0) return 'used';
  if (!p.activatedOn) return today <= p.activateBy ? 'waiting' : 'burned';
  return today <= p.validUntil! ? 'active' : 'expired';
}

// «Пакет скоро закінчиться»: a started package of several trainings with some left, ENDING_SOON_DAYS or fewer
// days to go (today and the last day counted). Shown on the home page and the package's card
export const ENDING_SOON_DAYS = 10;

export function endsInDays(
  p: { total: number; state: PassState; validUntil: string | null },
  today: string,
): number | null {
  if (p.total <= 1 || p.state !== 'active' || !p.validUntil) return null;
  const days =
    Math.round(
      DateTime.fromISO(p.validUntil, { zone: KY_ZONE }).diff(DateTime.fromISO(today, { zone: KY_ZONE }), 'days').days,
    ) + 1;
  return days <= ENDING_SOON_DAYS ? days : null;
}

// An assigned training's card: the package of its type that pays on that date and ends soon (endsInDays set,
// trainings left); several: the one ending first. «Сьогодні останній день пакета» / «Пакет діє до 27.11»
export function packageEnding(
  pkgs: (PassDates & { trainingType: string; left: number; endsInDays: number | null })[],
  trainingType: string,
  date: string,
): { validUntil: string; endsInDays: number } | null {
  const ending = pkgs
    .filter((p) => p.trainingType === trainingType && p.left > 0 && p.endsInDays !== null && passUsableOn(p, date))
    .sort((a, b) => a.validUntil!.localeCompare(b.validUntil!))[0];
  return ending ? { validUntil: ending.validUntil!, endsInDays: ending.endsInDays! } : null;
}
