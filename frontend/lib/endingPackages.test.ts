import { describe, expect, it } from "vitest";
import { endingHint } from "./endingPackages";

describe("endingHint", () => {
  it("days and trainings left", () => {
    expect(endingHint(9, 6)).toBe("Залишилось 9 днів: встигніть відходити 6 тренувань");
    expect(endingHint(2, 1)).toBe("Залишилось 2 дні: встигніть відходити 1 тренування");
  });

  it("the last day", () => {
    expect(endingHint(1, 3)).toBe("Останній день: встигніть відходити 3 тренування");
  });
});
