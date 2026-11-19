import { plural, trainingsCount } from "@/lib/plural";

// The package card's line under its dots: «Залишилось 9 днів: встигніть відходити 6 тренувань»
export function endingHint(days: number, left: number) {
  const time = days === 1 ? "Останній день" : `Залишилось ${plural(days, ["день", "дні", "днів"])}`;
  return `${time}: встигніть відходити ${trainingsCount(left)}`;
}
