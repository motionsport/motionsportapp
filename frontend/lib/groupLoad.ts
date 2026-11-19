// A group training has a norm (8, the counter's «/8») and books past it up to capacity (15) with a warning.
// These pick what the member card warns about and which other time it suggests instead.

interface LoadSlot {
  id: string;
  slotTime: string;
  status: "ACTIVE" | "CANCELLED";
  bookedCount: number;
  capacity: number;
  norm: number;
  started?: boolean;
  lateCancelled?: boolean;
}

// «На 20:00 вільніше» shows when this time has LIGHTER_HINT_FROM people or more (2 short of the norm of 8)
// and another time has LIGHTER_HINT_GAP fewer or more: earlier it only sends people to a time that may not happen
export const LIGHTER_HINT_FROM = 6;
export const LIGHTER_HINT_GAP = 3;

// This booking (with a guest: 2 seats) would take the training past its norm
export function overNorm(slot: LoadSlot, seats = 1) {
  return slot.bookedCount + seats > slot.norm;
}

// Another time still bookable with fewer people and room for `seats`: the least booked, the earlier on a tie
export function lighterSlot<T extends LoadSlot>(slot: T, allSlots: T[], seats = 1): T | null {
  const candidates = allSlots.filter(
    (s) =>
      s.id !== slot.id &&
      s.status === "ACTIVE" &&
      !s.started &&
      !s.lateCancelled &&
      s.bookedCount < slot.bookedCount &&
      s.bookedCount + seats <= s.capacity,
  );
  candidates.sort((a, b) => a.bookedCount - b.bookedCount || a.slotTime.localeCompare(b.slotTime));
  return candidates[0] ?? null;
}

// The card's «На 20:00 вільніше»: from LIGHTER_HINT_FROM booked, the least booked other time,
// when it has LIGHTER_HINT_GAP fewer people or more
export function lighterHint<T extends LoadSlot>(slot: T, allSlots: T[]): T | null {
  if (slot.bookedCount < LIGHTER_HINT_FROM) return null;
  const lighter = lighterSlot(slot, allSlots);
  return lighter && slot.bookedCount - lighter.bookedCount >= LIGHTER_HINT_GAP ? lighter : null;
}

// «На 19:00 вже 8 людей, тренуватись буде менш комфортно»
export function crowdedText(slot: LoadSlot) {
  return `На ${slot.slotTime} вже ${slot.bookedCount} людей, тренуватись буде менш комфортно`;
}

// The suggested time, with no number: «вільно: 4 місця» read as a limit, and there is none
export function lighterText(slot: LoadSlot) {
  return `На ${slot.slotTime} вільніше`;
}
