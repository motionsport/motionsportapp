// Review discount: 5% off club cards and group passes (not trainer services), once per member

export const REVIEW_DISCOUNT_PERCENT = 5;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Normal rounding: half a hryvnia goes up
export const discountUahFor = (amountUah: number) => Math.round((amountUah * REVIEW_DISCOUNT_PERCENT) / 100);

// By price list section
export const discountable = (section: string) => section === 'club_card' || section === 'group';

export type DiscountState = 'free' | 'held' | 'used' | 'expired';

// held = a PENDING purchase has it; a CANCELLED / REJECTED / FAILED / EXPIRED one gives it back
export function discountState(
  d: { validUntil: string; usedVia: string | null; purchaseStatus: string | null },
  today: string,
): DiscountState {
  if (d.usedVia || d.purchaseStatus === 'PAID') return 'used';
  if (d.purchaseStatus === 'PENDING') return 'held';
  return today <= d.validUntil ? 'free' : 'expired';
}

export function newDiscountCode(random: () => number = Math.random): string {
  let tail = '';
  for (let i = 0; i < 4; i++) tail += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return `MG5${tail}`;
}
