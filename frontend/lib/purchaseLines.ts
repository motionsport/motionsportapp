import { discountNote } from "./reviewDiscount";

// Note after a bought line: «подарунок» (the special offer's free gym visit) or «знижка за відгук, −70 ₴»
export function lineNote(line: { gift?: boolean; discountUah?: number }): string | null {
  return line.gift ? "подарунок" : discountNote(line);
}
