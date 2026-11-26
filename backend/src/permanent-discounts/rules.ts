// «Постійні знижки» (agreed 2026-11-26, the gym's stories): 10% for ЗСУ, students, pensioners, family (1+1: the
// second of a pair), and «Знижка іменинника» on the day. Only on a club card for a period (not «Разове
// відвідування», not group passes, never trainer services). They don't stack with each other, but do with the review
// discount: both off the price list (10% + 5% = 15%)

export const PERMANENT_DISCOUNT_PERCENT = 10;

// The member's mark, set by a trainer who saw the document
export const PERMANENT_KINDS = ['ZSU', 'STUDENT', 'PENSIONER', 'FAMILY'] as const;
export type PermanentKind = (typeof PERMANENT_KINDS)[number];

// What a discounted line records: a mark, or the birthday discount
export const DISCOUNT_KINDS = [...PERMANENT_KINDS, 'BIRTHDAY'] as const;
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];

// Normal rounding, like the review discount
export const permanentDiscountUahFor = (amountUah: number) =>
  Math.round((amountUah * PERMANENT_DISCOUNT_PERCENT) / 100);

// A club card for a period: «Разове відвідування» (0 months) doesn't count
export const permanentApplies = (section: string, durationMonths: number | null) =>
  section === 'club_card' && (durationMonths ?? 0) > 0;

export type BirthdayState = 'free' | 'held' | 'used' | 'expired';

// held = a PENDING purchase has it; valid only on the day it was given
export function birthdayState(
  b: { givenOn: string; clubCardId: string | null; purchaseStatus: string | null },
  today: string,
): BirthdayState {
  if (b.clubCardId || b.purchaseStatus === 'PAID') return 'used';
  if (b.purchaseStatus === 'PENDING') return 'held';
  return today === b.givenOn ? 'free' : 'expired';
}
