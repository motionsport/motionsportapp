import { describe, expect, it } from "vitest";
import { crowdedText, lighterHint, lighterSlot, lighterText, overNorm } from "./groupLoad";

const slot = (id: string, slotTime: string, bookedCount: number, extra: object = {}) => ({
  id,
  slotTime,
  status: "ACTIVE" as const,
  bookedCount,
  capacity: 15,
  norm: 8,
  ...extra,
});

describe("overNorm", () => {
  it("the 9th person is past the norm, the 8th is not", () => {
    expect(overNorm(slot("a", "19:00", 7))).toBe(false);
    expect(overNorm(slot("a", "19:00", 8))).toBe(true);
  });

  it("a member with a guest needs two seats", () => {
    expect(overNorm(slot("a", "19:00", 7), 2)).toBe(true);
  });
});

describe("lighterSlot", () => {
  it("another time with fewer people", () => {
    const s19 = slot("a", "19:00", 8);
    expect(lighterSlot(s19, [s19, slot("b", "20:00", 3)])?.id).toBe("b");
  });

  it("the nearest later time, even when an earlier one is lighter", () => {
    const s19 = slot("a", "19:00", 8);
    const all = [s19, slot("d", "21:00", 2), slot("b", "20:00", 5), slot("c", "18:00", 0)];
    expect(lighterSlot(s19, all)?.id).toBe("b");
  });

  it("the last training of the day: the nearest earlier one", () => {
    const s21 = slot("a", "21:00", 8);
    const all = [slot("c", "18:00", 0), s21, slot("b", "20:00", 5)];
    expect(lighterSlot(s21, all)?.id).toBe("b");
  });

  it("nothing lighter later: the nearest earlier one", () => {
    const s19 = slot("a", "19:00", 8);
    const all = [s19, slot("b", "20:00", 9), slot("c", "18:00", 4), slot("d", "17:00", 1)];
    expect(lighterSlot(s19, all)?.id).toBe("c");
  });

  it("none with as many or more people", () => {
    const s19 = slot("a", "19:00", 8);
    expect(lighterSlot(s19, [s19, slot("b", "20:00", 8)])).toBeNull();
  });

  it("skips started, cancelled, late-cancelled and full times", () => {
    const s19 = slot("a", "19:00", 9);
    const all = [
      s19,
      slot("b", "18:00", 1, { started: true }),
      slot("c", "20:00", 1, { status: "CANCELLED" }),
      slot("d", "21:00", 1, { lateCancelled: true }),
    ];
    expect(lighterSlot(s19, all)).toBeNull();
  });

  it("needs room for the guest too", () => {
    const s19 = { ...slot("a", "19:00", 15), capacity: 16 };
    expect(lighterSlot(s19, [s19, slot("b", "20:00", 14)], 2)).toBeNull();
    expect(lighterSlot(s19, [s19, slot("b", "20:00", 13)], 2)?.id).toBe("b");
  });
});

describe("lighterHint", () => {
  it("6 or more booked and another time 3 or more people fewer", () => {
    expect(lighterHint(slot("a", "19:00", 6), [slot("b", "20:00", 3)])?.id).toBe("b");
    expect(lighterHint(slot("a", "19:00", 9), [slot("b", "20:00", 6)])?.id).toBe("b");
  });

  it("fewer than 6 booked: no hint, however big the gap", () => {
    expect(lighterHint(slot("a", "19:00", 3), [slot("b", "20:00", 0)])).toBeNull();
    expect(lighterHint(slot("a", "19:00", 5), [slot("b", "20:00", 0)])).toBeNull();
  });

  it("a gap of 2 or less: no hint", () => {
    expect(lighterHint(slot("a", "19:00", 7), [slot("b", "20:00", 5)])).toBeNull();
    expect(lighterHint(slot("a", "19:00", 8), [slot("b", "20:00", 6)])).toBeNull();
  });

  it("skips a later time that is only a little lighter for an earlier one 3 fewer", () => {
    expect(lighterHint(slot("a", "19:00", 8), [slot("b", "20:00", 7), slot("c", "18:00", 4)])?.id).toBe("c");
  });
});

describe("texts", () => {
  it("the crowded time and the suggested one", () => {
    expect(crowdedText(slot("a", "19:00", 8))).toBe("На 19:00 вже 8 людей, тренуватись буде менш комфортно");
    expect(lighterText(slot("b", "20:00", 3))).toBe("На 20:00 вільніше");
    expect(lighterText(slot("b", "20:00", 9))).toBe("На 20:00 вільніше");
  });
});
