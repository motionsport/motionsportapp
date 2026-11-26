import type { BirthdayDiscount, DiscountKind, PermanentKind } from "./api";
import { ddmm } from "./dates";
import { formatUah } from "./prices";

// «Постійні знижки» and «Знижка іменинника»: a percent off a club card for a period. The percent and who has one
// come from the backend (permanent-discounts/rules.ts); this is display only: the backend computes the amount again

// The trainer's choice, in this order
export const PERMANENT_KINDS: { kind: PermanentKind; label: string }[] = [
  { kind: "ZSU", label: "ЗСУ" },
  { kind: "STUDENT", label: "Студент" },
  { kind: "PENSIONER", label: "Пенсіонер" },
  { kind: "FAMILY", label: "Сімейна" },
];

// «Знижка ЗСУ», «Сімейна знижка», «Знижка іменинника»
export const DISCOUNT_NAME: Record<DiscountKind, string> = {
  ZSU: "Знижка ЗСУ",
  STUDENT: "Знижка студента",
  PENSIONER: "Знижка пенсіонера",
  FAMILY: "Сімейна знижка",
  BIRTHDAY: "Знижка іменинника",
};

// A club card for a period: «Разове відвідування» (0 months) doesn't count
const applies = (l: { section?: string; durationMonths?: number | null }) =>
  l.section === "club_card" && (l.durationMonths ?? 0) > 0;

// Off the first club card for a period, from the price list, rounded like the backend's permanentDiscountUahFor
export function permanentPreview(
  lines: { section?: string; durationMonths?: number | null; amountUah: number }[],
  percent: number | undefined,
): number {
  const line = percent ? lines.find(applies) : undefined;
  return line ? Math.round((line.amountUah * percent!) / 100) : 0;
}

// «знижка ЗСУ, −140 ₴» under a bought line
export function permanentNote(line: { permanentDiscountUah?: number; permanentDiscountKind?: DiscountKind | null }) {
  if (!line.permanentDiscountUah || !line.permanentDiscountKind) return null;
  const name = DISCOUNT_NAME[line.permanentDiscountKind];
  // «знижка ЗСУ»: only the first letter goes small
  return `${name[0].toLowerCase()}${name.slice(1)}, −${formatUah(line.permanentDiscountUah)}`;
}

// The trainer's line under «Знижка іменинника»
export function birthdayLine(b: BirthdayDiscount): string {
  switch (b.state) {
    case "free":
      return `Діє сьогодні, ${ddmm(b.givenOn)}`;
    case "held":
      return "Застосовано до покупки, що чекає оплати";
    case "used":
      return `Використано ${ddmm(b.givenOn)}`;
    case "expired":
      return `Видано ${ddmm(b.givenOn)}, не використано`;
  }
}
