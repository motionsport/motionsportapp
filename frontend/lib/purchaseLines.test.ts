import { describe, expect, it } from "vitest";
import { lineNote } from "./purchaseLines";

describe("lineNote", () => {
  it("the special offer's gym visit is a gift", () => {
    expect(lineNote({ gift: true, discountUah: 0 })).toBe("подарунок");
  });
  it("a discounted line keeps its discount note", () => {
    expect(lineNote({ discountUah: 70 })).toBe("знижка за відгук, −70 ₴");
  });
  it("nothing for a plain line", () => {
    expect(lineNote({ discountUah: 0 })).toBeNull();
  });
});
