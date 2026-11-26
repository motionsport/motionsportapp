import { describe, expect, it } from "vitest";
import type { CatalogItem } from "@/lib/api";
import { recommendedCard } from "./recommend";

const item = (over: Partial<CatalogItem>): CatalogItem => ({
  id: "x",
  title: "t",
  optionLabel: null,
  amountUah: 100,
  durationMonths: null,
  trainingType: null,
  trainingCount: null,
  ...over,
});
const single = item({ durationMonths: 0 });
const month = item({ durationMonths: 1 });
const threeMonths = item({ durationMonths: 3 });

describe("recommendedCard", () => {
  it("one training: «Разове відвідування»", () => {
    const one = item({ trainingType: "personal", trainingCount: 1, durationMonths: 1 });
    expect([single, month, threeMonths].map((c) => recommendedCard(c, one))).toEqual([true, false, false]);
  });
  it("a package: the cards lasting as long as it (a month)", () => {
    const twelve = item({ trainingType: "personal", trainingCount: 12, durationMonths: 1 });
    expect([single, month, threeMonths].map((c) => recommendedCard(c, twelve))).toEqual([false, true, false]);
  });
  it("no trainer service chosen (a club card alone): nothing", () => {
    expect(recommendedCard(month, undefined)).toBe(false);
  });
});
