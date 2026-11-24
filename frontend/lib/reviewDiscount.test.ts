import { afterEach, describe, expect, it, vi } from "vitest";
import type { DiscountView } from "./api";
import { formatUah } from "./prices";
import {
  discountGivenLine,
  discountNote,
  discountPreview,
  discountStatusLine,
  hidePromoStrip,
  promoStripHidden,
  showDiscountToggle,
} from "./reviewDiscount";

describe("discountPreview (mirrors the backend's discountUahFor)", () => {
  it("a percent off the club card, not the trainer service", () => {
    expect(
      discountPreview(
        [
          { section: "club_card", amountUah: 1400 },
          { section: "assigned", amountUah: 600 },
        ],
        5,
      ),
    ).toEqual({ discountUah: 70, payUah: 1930 });
  });

  it("nothing off a trainer service alone", () => {
    expect(discountPreview([{ section: "assigned", amountUah: 600 }], 5)).toEqual({ discountUah: 0, payUah: 600 });
  });

  it("another percent is used as given", () => {
    expect(discountPreview([{ section: "club_card", amountUah: 1000 }], 10)).toEqual({ discountUah: 100, payUah: 900 });
  });

  it("a group pass, rounded like the backend (half a hryvnia goes up)", () => {
    expect(discountPreview([{ section: "group", amountUah: 250 }], 5)).toEqual({ discountUah: 13, payUah: 237 });
  });

  it("only the first discountable line", () => {
    expect(
      discountPreview(
        [
          { section: "club_card", amountUah: 1000 },
          { section: "group", amountUah: 1000 },
        ],
        5,
      ),
    ).toEqual({ discountUah: 50, payUah: 1950 });
  });
});

describe("showDiscountToggle", () => {
  const card = [{ section: "club_card", amountUah: 1400 }];

  it("a free discount, a discountable line and cash or transfer", () => {
    expect(showDiscountToggle("free", card, true, 5)).toBe(true);
  });

  it("not when held, used or none", () => {
    expect(showDiscountToggle("held", card, true, 5)).toBe(false);
    expect(showDiscountToggle(null, card, true, 5)).toBe(false);
  });

  it("not without a discountable line or a manual method", () => {
    expect(showDiscountToggle("free", [{ section: "assigned", amountUah: 600 }], true, 5)).toBe(false);
    expect(showDiscountToggle("free", card, false, 5)).toBe(false);
  });
});

describe("discountNote", () => {
  it("the line's discount", () => {
    expect(discountNote({ discountUah: 70 })).toBe("знижка за відгук, −70 ₴");
  });

  it("nothing without one", () => {
    expect(discountNote({ discountUah: 0 })).toBeNull();
    expect(discountNote({})).toBeNull();
  });
});

describe("promo strip flag", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("hidden after hidePromoStrip, for a week", () => {
    let jar = "other=x";
    const set: string[] = [];
    vi.stubGlobal("document", {
      get cookie() {
        return jar;
      },
      set cookie(v: string) {
        set.push(v);
        jar = `${jar}; ${v.split(";")[0]}`;
      },
    });
    expect(promoStripHidden()).toBe(false);
    hidePromoStrip();
    expect(set[0]).toBe("mg_review_promo_hidden=1; max-age=604800; path=/; SameSite=Lax");
    expect(promoStripHidden()).toBe(true);
  });

  it("cookies off: shown, and hiding doesn't throw", () => {
    vi.stubGlobal("document", {
      get cookie(): string {
        throw new Error("off");
      },
      set cookie(_v: string) {
        throw new Error("off");
      },
    });
    expect(promoStripHidden()).toBe(false);
    expect(() => hidePromoStrip()).not.toThrow();
  });
});

describe("the trainer's «Знижка за відгук» block", () => {
  const base: DiscountView = {
    code: "MG5K7Q2",
    validUntil: "2026-12-24",
    givenAt: "2026-11-24T09:00:00.000Z",
    givenBy: "admin",
    state: "free",
    usedAt: null,
    usedVia: null,
    usedOn: null,
  };
  const used = (usedVia: DiscountView["usedVia"], usedOn: DiscountView["usedOn"] = null): DiscountView => ({
    ...base,
    state: "used",
    usedAt: "2026-11-30T22:30:00.000Z", // 00:30 on 01.12 in Kyiv
    usedVia,
    usedOn,
  });

  it("who gave it and until when", () => {
    expect(discountGivenLine(base)).toBe("Видано 24.11 (admin), діє до 24.12");
  });

  it("a line per state", () => {
    expect(discountStatusLine(base)).toBe("Не використано");
    expect(discountStatusLine({ ...base, state: "held" })).toBe("Застосовано до покупки, що чекає оплати");
    expect(discountStatusLine({ ...base, state: "expired" })).toBe("Згоріла 24.12");
  });

  it("used: where, the day in Kyiv and what it went on", () => {
    const card = { title: "Абонемент на місяць", discountUah: 70 };
    expect(discountStatusLine(used("BAR"))).toBe("Використано 01.12 у барі");
    expect(discountStatusLine(used("RECEPTION", card))).toBe(
      `Використано 01.12 на рецепції: Абонемент на місяць, −${formatUah(70)}`,
    );
    expect(discountStatusLine(used("PURCHASE", card))).toBe(
      `Використано 01.12: Абонемент на місяць, −${formatUah(70)}`,
    );
  });
});
