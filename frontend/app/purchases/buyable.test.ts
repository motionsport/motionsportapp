import { describe, expect, it } from "vitest";
import type { TrainingPackage } from "@/lib/api";
import { buyableServiceTypes } from "./buyable";

const pkg = (trainingType: TrainingPackage["trainingType"], left: number, state: TrainingPackage["state"]) =>
  ({ trainingType, left, state }) as TrainingPackage;

describe("buyableServiceTypes", () => {
  it("nothing left: both types", () => {
    expect(buyableServiceTypes([])).toEqual(["personal", "split"]);
    expect(buyableServiceTypes([pkg("personal", 0, "used")])).toEqual(["personal", "split"]);
  });

  it("split left: personal only; personal left: split only", () => {
    expect(buyableServiceTypes([pkg("split", 6, "waiting"), pkg("personal", 0, "used")])).toEqual(["personal"]);
    expect(buyableServiceTypes([pkg("personal", 3, "active")])).toEqual(["split"]);
  });

  it("both left: none", () => {
    expect(buyableServiceTypes([pkg("split", 1, "active"), pkg("personal", 2, "waiting")])).toEqual([]);
  });

  it("burned or expired trainings don't count, and group passes don't either", () => {
    expect(buyableServiceTypes([pkg("split", 4, "burned"), pkg("personal", 2, "expired")])).toEqual([
      "personal",
      "split",
    ]);
    expect(buyableServiceTypes([pkg("group", 10, "active")])).toEqual(["personal", "split"]);
  });
});
