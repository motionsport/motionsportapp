import type { DiscountState, DiscountView } from "./api";
import { ddmm, kyivToday } from "./dates";
import { formatUah } from "./prices";

// Review discount: a percent off one club card or group pass. The percent lives only in the backend
// (review-discounts/rules.ts) and comes with the responses; this is display only: the backend computes the amount again

const discountable = (section: string) => section === "club_card" || section === "group";

type Line = { section?: string; amountUah: number };

// Taken off the first discountable line, rounded like the backend's discountUahFor
export function discountPreview(lines: Line[], percent: number): { discountUah: number; payUah: number } {
  const total = lines.reduce((sum, l) => sum + l.amountUah, 0);
  const line = lines.find((l) => !!l.section && discountable(l.section));
  const discountUah = line ? Math.round((line.amountUah * percent) / 100) : 0;
  return { discountUah, payUah: total - discountUah };
}

// Cash or transfer only (never online), a free discount and something it applies to
export function showDiscountToggle(
  state: DiscountState | null | undefined,
  lines: Line[],
  manualMethod: boolean,
  percent: number,
) {
  return state === "free" && manualMethod && discountPreview(lines, percent).discountUah > 0;
}

// «знижка за відгук, −70 ₴» under a bought line
export function discountNote(line: { discountUah?: number }): string | null {
  return line.discountUah ? `знижка за відгук, −${formatUah(line.discountUah)}` : null;
}

// The trainer's «Знижка за відгук» block on the client page: «Видано 24.11 (admin), діє до 24.12»
export function discountGivenLine(d: DiscountView): string {
  return `Видано ${ddmm(kyivToday(new Date(d.givenAt)))} (${d.givenBy}), діє до ${ddmm(d.validUntil)}`;
}

// What happened to it; used days are Kyiv days of a moment
export function discountStatusLine(d: DiscountView): string {
  switch (d.state) {
    case "free":
      return "Не використано";
    case "held":
      return "Застосовано до покупки, що чекає оплати";
    case "expired":
      return `Згоріла ${ddmm(d.validUntil)}`;
    case "used": {
      const day = d.usedAt ? ` ${ddmm(kyivToday(new Date(d.usedAt)))}` : "";
      if (d.usedVia === "BAR") return `Використано${day} у барі`;
      const on = d.usedOn ? `: ${d.usedOn.title}, −${formatUah(d.usedOn.discountUah)}` : "";
      return d.usedVia === "RECEPTION" ? `Використано${day} на рецепції${on}` : `Використано${day}${on}`;
    }
  }
}

// The home page's promo strip, hidden by its ✕ in this browser. Storage can be off (private mode): shown then
const PROMO_HIDDEN = "mg_review_promo_hidden";

export function promoStripHidden(): boolean {
  try {
    return localStorage.getItem(PROMO_HIDDEN) === "1";
  } catch {
    return false;
  }
}

export function hidePromoStrip() {
  try {
    localStorage.setItem(PROMO_HIDDEN, "1");
  } catch {}
}
