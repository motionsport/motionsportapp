import { describe, expect, it } from "vitest";
import { marksLocked } from "@/lib/marksLock";

describe("marksLocked (same rule as the backend: the training day and 3 days after it)", () => {
  it("open up to the 3rd day after", () => {
    expect(marksLocked("2026-11-23", "2026-11-23")).toBe(false);
    expect(marksLocked("2026-11-23", "2026-11-26")).toBe(false);
  });

  it("closed from the 4th day, also across a month end", () => {
    expect(marksLocked("2026-11-23", "2026-11-27")).toBe(true);
    expect(marksLocked("2026-11-30", "2026-12-03")).toBe(false);
    expect(marksLocked("2026-11-30", "2026-12-04")).toBe(true);
  });
});
