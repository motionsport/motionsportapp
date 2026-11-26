import { describe, expect, it } from "vitest";
import { opensBadge, opensText } from "./bookingOpens";

// Thursday 26.11, 12:00 Kyiv; the trainer opens at 16:00
const NOW = "2026-11-26T10:00:00Z";
const THU_16 = "2026-11-26T14:00:00Z";
const FRI_16 = "2026-11-27T14:00:00Z";

describe("opensText", () => {
  it("the day is counted from today: сьогодні / завтра / a date", () => {
    expect(opensText(THU_16, NOW)).toBe("Запис відкриється сьогодні о 16:00");
    expect(opensText(FRI_16, NOW)).toBe("Запис відкриється завтра о 16:00");
    expect(opensText("2026-11-29T14:00:00Z", NOW)).toBe("Запис відкриється 29.11 о 16:00");
  });
});

describe("opensBadge", () => {
  // Friday: 9:00 opens on Thursday, 19:00 and 20:00 on Friday
  const friday = [
    { status: "ACTIVE", started: false, bookingOpenAt: THU_16 },
    { status: "ACTIVE", started: false, bookingOpenAt: FRI_16 },
    { status: "ACTIVE", started: false, bookingOpenAt: FRI_16 },
  ];

  it("a morning one opens next: «на ранкове групове … сьогодні»", () => {
    expect(opensBadge(THU_16, "2026-11-27", friday, NOW)).toBe("Запис на ранкове групове відкриється сьогодні о 16:00");
  });

  it("the evening ones next (the morning one started): «на вечірні групові»", () => {
    const fridayNoon = "2026-11-27T10:00:00Z";
    const slots = [{ ...friday[0], started: true }, friday[1], friday[2]];
    expect(opensBadge(FRI_16, "2026-11-27", slots, fridayNoon)).toBe(
      "Запис на вечірні групові відкриється сьогодні о 16:00",
    );
  });

  it("one evening training: «на вечірнє групове»", () => {
    expect(
      opensBadge(
        THU_16,
        "2026-11-26",
        [friday[0]].map((s) => ({ ...s })),
        NOW,
      ),
    ).toBe("Запис на вечірнє групове відкриється сьогодні о 16:00");
  });
});
