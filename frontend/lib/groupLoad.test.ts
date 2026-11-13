import { describe, expect, it } from "vitest";
import { crowdedText, lighterHint, lighterSlot, lighterText, overNorm, seatsWord } from "./groupLoad";

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

  it("the least booked, the earlier on a tie", () => {
    const s19 = slot("a", "19:00", 8);
    const all = [s19, slot("b", "20:00", 5), slot("c", "18:00", 2), slot("d", "21:00", 2)];
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
  it("from 7 booked, when another time has fewer", () => {
    const other = slot("b", "20:00", 3);
    expect(lighterHint(slot("a", "19:00", 6), [other])).toBeNull();
    expect(lighterHint(slot("a", "19:00", 7), [other])?.id).toBe("b");
  });
});

describe("texts", () => {
  it("seat words", () => {
    expect([1, 2, 4, 5, 11, 12, 21, 22].map(seatsWord)).toEqual([
      "1 місце",
      "2 місця",
      "4 місця",
      "5 місць",
      "11 місць",
      "12 місць",
      "21 місце",
      "22 місця",
    ]);
  });

  it("the crowded time and the suggested one", () => {
    expect(crowdedText(slot("a", "19:00", 8))).toBe("На 19:00 вже 8 людей, тренуватись буде менш комфортно");
    expect(lighterText(slot("b", "20:00", 3))).toBe("На 20:00 вільно: 5 місць");
    expect(lighterText(slot("b", "20:00", 9))).toBe("На 20:00 людей менше: 9");
  });
});
