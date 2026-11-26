import { describe, expect, it } from "vitest";
import { opensBadge, opensText } from "./bookingOpens";

describe("opensText", () => {
  it("an opening on the training day: «о 10:00»", () => {
    expect(opensText("2026-11-25T08:00:00Z", "2026-11-25")).toBe("о 10:00");
  });

  it("a morning training opens the day before: «напередодні о 10:00»", () => {
    expect(opensText("2026-11-24T08:00:00Z", "2026-11-25")).toBe("напередодні о 10:00");
  });
});

describe("opensBadge", () => {
  it("«До 10:00» on the day, «Напередодні о 10:00» the day before", () => {
    expect(opensBadge("2026-11-25T08:00:00Z", "2026-11-25")).toBe("До 10:00");
    expect(opensBadge("2026-11-24T08:00:00Z", "2026-11-25")).toBe("Напередодні о 10:00");
  });
});
