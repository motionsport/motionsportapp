import { describe, expect, it } from "vitest";
import type { GymStats } from "@/lib/api";
import { gymCards } from "./gymStats";

const rev = (total: number, month = "2026-11") => ({
  allTime: { clubCards: total, personal: 0, split: 0, group: 0, total },
  months: [{ month, clubCards: total, personal: 0, split: 0, group: 0, total }],
});

const stats: GymStats = {
  trainers: [
    {
      id: "t1",
      username: "admin",
      disabledAt: null,
      revenue: rev(1000),
      present: { allTime: 9, months: [{ month: "2026-11", present: 9 }] },
    },
    {
      id: "t2",
      username: "olena",
      disabledAt: "2026-11-01T10:00:00.000Z",
      revenue: rev(300),
      present: { allTime: 2, months: [{ month: "2026-11", present: 2 }] },
    },
  ],
  unassigned: { revenue: rev(500) },
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

  it("all time uses the all-time numbers", () => {
    expect(gymCards(stats, "all")[0].revenue.total).toBe(1800);
  });

  it("a month without data: zeros, and no «Без тренера» card", () => {
    const cards = gymCards(stats, "2026-09");
    expect(cards.map((c) => c.title)).toEqual(["Весь зал", "admin", "olena"]);
    expect(cards.every((c) => c.revenue.total === 0 && c.present === 0)).toBe(true);
  });
});
