import { plural, trainingsCount } from "@/lib/plural";
import { ddmm } from "@/lib/dates";
import type { AssignedSlotView } from "@/lib/api";

// An assigned training's card: the package that pays for it ends soon (backend packageEnding)
export function packageEndingWarning(e: AssignedSlotView["packageEnding"]) {
  if (!e) return null;
  return {
    title: e.endsInDays === 1 ? "Сьогодні останній день пакета" : `Пакет діє до ${ddmm(e.validUntil)}`,
    details: "Невикористані тренування згорять.",
  };
}

// The package card's line under its dots: «Залишилось 9 днів: встигніть відходити 6 тренувань»
export function endingHint(days: number, left: number) {
  const time = days === 1 ? "Останній день" : `Залишилось ${plural(days, ["день", "дні", "днів"])}`;
  return `${time}: встигніть відходити ${trainingsCount(left)}`;
}
