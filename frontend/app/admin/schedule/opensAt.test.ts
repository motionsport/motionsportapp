import { describe, expect, it } from "vitest";
import { opensAtError } from "./opensAt";

describe("opensAtError («Запис відкривається о»)", () => {
  it("a quarter of an hour is fine", () => {
    expect(opensAtError("14:00")).toBeNull();
    expect(opensAtError("10:45")).toBeNull();
  });

  it("another minute: offers the four times of that hour", () => {
    expect(opensAtError("10:10")).toBe("Запис може відкриватися лише о 10:00, 10:15, 10:30 або 10:45");
    expect(opensAtError("09:52")).toBe("Запис може відкриватися лише о 09:00, 09:15, 09:30 або 09:45");
  });

  it("no time", () => {
    expect(opensAtError("")).toBe("Вкажіть, о котрій відкривається запис, наприклад 14:00");
  });
});
