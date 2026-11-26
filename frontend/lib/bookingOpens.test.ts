import { describe, expect, it } from "vitest";
import { opensBadge, opensText } from "./bookingOpens";

// Thursday 26.11, 12:00 Kyiv
const NOW = "2026-11-26T10:00:00Z";

describe("opensText", () => {
  it("an opening on the training day: «о 16:00»", () => {
    expect(opensText("2026-11-26T14:00:00Z", "2026-11-26", NOW)).toBe("о 16:00");
  });

  it("a morning training opens the day before, said from today: «сьогодні» / «завтра» / a date", () => {
    expect(opensText("2026-11-26T14:00:00Z", "2026-11-27", NOW)).toBe("сьогодні о 16:00");
    expect(opensText("2026-11-27T14:00:00Z", "2026-11-28", NOW)).toBe("завтра о 16:00");
    expect(opensText("2026-11-29T14:00:00Z", "2026-11-30", NOW)).toBe("29.11 о 16:00");
  });
});

describe("opensBadge", () => {
  it("«До 16:00» on the training day, «Запис сьогодні о 16:00» / «Запис завтра о 16:00» the day before", () => {
    expect(opensBadge("2026-11-26T14:00:00Z", "2026-11-26", NOW)).toBe("До 16:00");
    expect(opensBadge("2026-11-26T14:00:00Z", "2026-11-27", NOW)).toBe("Запис сьогодні о 16:00");
    expect(opensBadge("2026-11-27T14:00:00Z", "2026-11-28", NOW)).toBe("Запис завтра о 16:00");
  });
});
