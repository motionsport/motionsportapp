import { describe, expect, it } from "vitest";
import { monthKeysUpToNow } from "@/lib/statsMonths";

describe("monthKeysUpToNow (months to step through, oldest first)", () => {
  it("at least the last 12 months up to the current one, zero months included", () => {
    const keys = monthKeysUpToNow([], "2026-11-23");
    expect(keys).toHaveLength(12);
    expect(keys[0]).toBe("2025-12");
    expect(keys[11]).toBe("2026-11");
  });

  it("goes back to the first month with data when it is older", () => {
    const keys = monthKeysUpToNow(["2025-06", "2026-10"], "2026-11-23");
    expect(keys[0]).toBe("2025-06");
    expect(keys.at(-1)).toBe("2026-11");
    expect(keys).toHaveLength(18);
  });
});
