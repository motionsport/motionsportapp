import { describe, expect, it } from "vitest";
import { refundNotice } from "./refundNotice";

describe("refundNotice: what the trainer is told after an action in «Повернути гроші»", () => {
  const r = { amountUah: 300, displayName: "Оля" };

  it("refund accepted: sent, the money goes later", () => {
    expect(refundNotice("refund", "SENDING", r)).toBe(
      "Повернення 300 ₴ відправлено. Гроші підуть клієнту, коли платіжна система його виконає.",
    );
  });

  it("check finds the money gone, or a refund already done", () => {
    expect(refundNotice("check", "DONE", r)).toBe("Повернено 300 ₴: гроші пішли клієнту Оля.");
    expect(refundNotice("refund", "DONE", r)).toBe("Повернено 300 ₴: гроші пішли клієнту Оля.");
  });

  it("check while still waiting", () => {
    expect(refundNotice("check", "SENDING", r)).toBe("Ще не повернено: платіжна система чекає. Перевірте пізніше.");
  });

  it("marked by hand, waived", () => {
    expect(refundNotice("done", "DONE", r)).toBe("Позначено: 300 ₴ повернено клієнту Оля.");
    expect(refundNotice("waive", "DONE", r)).toBe("Не списано: тренування повернулось клієнту Оля.");
  });
});
