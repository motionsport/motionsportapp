import { describe, expect, it } from "vitest";
import { endingHint, packageEndingWarning } from "./endingPackages";

describe("endingHint", () => {
  it("days and trainings left", () => {
    expect(endingHint(9, 6)).toBe("Залишилось 9 днів: встигніть відходити 6 тренувань");
    expect(endingHint(2, 1)).toBe("Залишилось 2 дні: встигніть відходити 1 тренування");
  });

  it("the last day", () => {
    expect(endingHint(1, 3)).toBe("Останній день: встигніть відходити 3 тренування");
  });
});

describe("packageEndingWarning (an assigned training card)", () => {
  it("nothing when the package isn't ending soon", () => {
    expect(packageEndingWarning(null)).toBeNull();
  });

  it("the last day says today", () => {
    expect(packageEndingWarning({ validUntil: "2026-11-23", endsInDays: 1 })).toEqual({
      title: "Сьогодні останній день пакета",
      details: "Невикористані тренування згорять.",
    });
  });

  it("other days: the date", () => {
    expect(packageEndingWarning({ validUntil: "2026-11-27", endsInDays: 5 })).toEqual({
      title: "Пакет діє до 27.11",
      details: "Невикористані тренування згорять.",
    });
  });
});
