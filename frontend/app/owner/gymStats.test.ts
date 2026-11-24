import { describe, expect, it } from "vitest";
import type { GymStats } from "@/lib/api";
import { formatUah } from "@/lib/prices";
import { discountSummaryIn, discountSummaryText, gymCards, gymMonthsWithData } from "./gymStats";

const rev = (total: number, month = "2026-11", discount = 0, discounted = 0) => ({
  allTime: { clubCards: total, personal: 0, split: 0, group: 0, total, discount, discounted },
  months: [{ month, clubCards: total, personal: 0, split: 0, group: 0, total, discount, discounted }],
});

const none = { given: 0, bar: 0, reception: 0, receptionUah: 0, purchases: 0, purchasesUah: 0 };

const stats: GymStats = {
  trainers: [
    {
      id: "t1",
      username: "admin",
      disabledAt: null,
      revenue: rev(1000, "2026-11", 70, 1),
      present: { allTime: 9, months: [{ month: "2026-11", present: 9 }] },
    },
    {
      id: "t2",
      username: "olena",
      disabledAt: "2026-11-01T10:00:00.000Z",
      revenue: rev(300, "2026-11", 26, 2),
      present: { allTime: 2, months: [{ month: "2026-11", present: 2 }] },
    },
  ],
  unassigned: { revenue: rev(500) },
  reviewDiscounts: {
    allTime: { given: 12, bar: 3, reception: 1, receptionUah: 70, purchases: 5, purchasesUah: 350 },
    months: [{ month: "2026-11", given: 4, bar: 1, reception: 0, receptionUah: 0, purchases: 2, purchasesUah: 140 }],
  },
};

describe("gymCards (the owner's cards)", () => {
  it("«Весь зал» first with everything summed, then trainers in order, «Без тренера» last", () => {
    const cards = gymCards(stats, "2026-11");
    expect(cards.map((c) => c.title)).toEqual(["Весь зал", "admin", "olena", "Без тренера"]);
    expect(cards[0].revenue.total).toBe(1800);
    expect(cards[0].present).toBe(11);
    expect(cards[2].disabled).toBe(true);
    expect(cards[3].present).toBeNull();
  });

  it("«Весь зал» sums the review discounts too", () => {
    const gym = gymCards(stats, "2026-11")[0].revenue;
    expect(gym.discount).toBe(96);
    expect(gym.discounted).toBe(3);
  });

  it("all time uses the all-time numbers", () => {
    expect(gymCards(stats, "all")[0].revenue.total).toBe(1800);
  });

  it("a month without data: zeros, and no «Без тренера» card", () => {
    const cards = gymCards(stats, "2026-09");
    expect(cards.map((c) => c.title)).toEqual(["Весь зал", "admin", "olena"]);
    expect(cards.every((c) => c.revenue.total === 0 && c.present === 0)).toBe(true);
  });
});

describe("discountSummaryIn (review discounts at the top)", () => {
  it("the picked month, or all time", () => {
    expect(discountSummaryIn(stats, "2026-11").given).toBe(4);
    expect(discountSummaryIn(stats, "all").given).toBe(12);
  });

  it("zeros for a month without data", () => {
    expect(discountSummaryIn(stats, "2026-09")).toEqual(none);
  });
});

describe("discountSummaryText", () => {
  it("given, used and where", () => {
    expect(discountSummaryText(stats.reviewDiscounts.allTime)).toBe(
      `Знижки за відгук: видано 12, використано 9 (бар 3, рецепція 1: −${formatUah(70)}, покупки 5: −${formatUah(350)})`,
    );
  });

  it("only the places used", () => {
    expect(discountSummaryText({ ...none, given: 2, purchases: 1, purchasesUah: 70 })).toBe(
      `Знижки за відгук: видано 2, використано 1 (покупки 1: −${formatUah(70)})`,
    );
    expect(discountSummaryText({ ...none, given: 2 })).toBe("Знижки за відгук: видано 2, використано 0");
  });

  it("nothing when all is zero", () => {
    expect(discountSummaryText(none)).toBeNull();
  });
});

describe("gymMonthsWithData", () => {
  it("a month with only review discounts counts too", () => {
    const only = {
      ...stats,
      reviewDiscounts: { ...stats.reviewDiscounts, months: [{ ...none, month: "2026-08", given: 1 }] },
    };
    expect(gymMonthsWithData(only)).toContain("2026-08");
  });
});
