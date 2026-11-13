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

// «На 20:00 вільніше» shows on a time with this many booked or more
export const LIGHTER_HINT_FROM = 7;

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

// The card's «На 20:00 вільніше»: only once this time is filling up
export function lighterHint<T extends LoadSlot>(slot: T, allSlots: T[]): T | null {
  return slot.bookedCount >= LIGHTER_HINT_FROM ? lighterSlot(slot, allSlots) : null;
}

// «вільно: 5 місць» (1 місце, 2 місця, 5 місць, 11 місць, 21 місце)
export function seatsWord(n: number) {
  const last = n % 10;
  const lastTwo = n % 100;
  if (last === 1 && lastTwo !== 11) return `${n} місце`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${n} місця`;
  return `${n} місць`;
}

// «На 19:00 вже 8 людей, тренуватись буде менш комфортно»
export function crowdedText(slot: LoadSlot) {
  return `На ${slot.slotTime} вже ${slot.bookedCount} людей, тренуватись буде менш комфортно`;
}

// The suggested time: free seats within its norm, or (past the norm too, just less so) how many are there
export function lighterText(slot: LoadSlot) {
  const free = slot.norm - slot.bookedCount;
  return free > 0
    ? `На ${slot.slotTime} вільно: ${seatsWord(free)}`
    : `На ${slot.slotTime} людей менше: ${slot.bookedCount}`;
}
