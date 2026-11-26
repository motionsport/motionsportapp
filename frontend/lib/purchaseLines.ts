import type { DiscountKind } from "./api";
import { discountNote } from "./reviewDiscount";
import { permanentNote } from "./permanentDiscount";

// Note after a bought line: «подарунок» (the special offer's free gym visit), or its discounts: «знижка ЗСУ, −140 ₴»,
// «знижка за відгук, −70 ₴»
export function lineNote(line: {
  gift?: boolean;
  discountUah?: number;
  permanentDiscountUah?: number;
  permanentDiscountKind?: DiscountKind | null;
}): string | null {
  if (line.gift) return "подарунок";
  const notes = [permanentNote(line), discountNote(line)].filter(Boolean);
  return notes.length ? notes.join(", ") : null;
}
