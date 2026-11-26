import { describe, expect, it } from "vitest";
import { birthdayLine, permanentNote, permanentPreview } from "./permanentDiscount";

describe("permanentPreview", () => {
  it("10% off a club card for a period", () => {
    expect(permanentPreview([{ section: "club_card", durationMonths: 1, amountUah: 1400 }], 10)).toBe(140);
  });
  it("nothing on «Разове відвідування», group passes or trainer services", () => {
    expect(
      permanentPreview(
        [
          { section: "club_card", durationMonths: 0, amountUah: 250 },
          { section: "group", durationMonths: 1, amountUah: 2200 },
          { section: "assigned", durationMonths: 1, amountUah: 3600 },
        ],
        10,
      ),
    ).toBe(0);
  });
  it("nothing without a discount", () => {
    expect(permanentPreview([{ section: "club_card", durationMonths: 1, amountUah: 1400 }], undefined)).toBe(0);
  });
});

describe("permanentNote", () => {
  it("names the discount and the amount", () => {
    expect(permanentNote({ permanentDiscountUah: 140, permanentDiscountKind: "ZSU" })).toBe("знижка ЗСУ, −140 ₴");
    expect(permanentNote({ permanentDiscountUah: 126, permanentDiscountKind: "FAMILY" })).toBe(
      "сімейна знижка, −126 ₴",
    );
    expect(permanentNote({ permanentDiscountUah: 0, permanentDiscountKind: null })).toBeNull();
  });
});

describe("birthdayLine", () => {
  it("free today, then used or not", () => {
    expect(birthdayLine({ givenOn: "2026-11-26", state: "free" })).toBe("Діє сьогодні, 26.11");
    expect(birthdayLine({ givenOn: "2026-11-26", state: "expired" })).toBe("Видано 26.11, не використано");
  });
});
