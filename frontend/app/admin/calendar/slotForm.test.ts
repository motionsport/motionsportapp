import { describe, expect, it } from "vitest";
import { timeOk } from "./slotForm";

describe("timeOk (the calendar's «Час»)", () => {
  it("a group training: only :00, :15, :30, :45 (the booking-open push runs every 15 minutes)", () => {
    expect(timeOk("18:30", false)).toBe(true);
    expect(timeOk("18:20", false)).toBe(false);
  });

  it("personal / split: any minute", () => {
    expect(timeOk("18:20", true)).toBe(true);
    expect(timeOk("09:07", true)).toBe(true);
  });

  it("a malformed time never passes", () => {
    expect(timeOk("", true)).toBe(false);
    expect(timeOk("24:00", true)).toBe(false);
    expect(timeOk("18:60", true)).toBe(false);
  });
});
