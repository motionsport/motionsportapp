import { describe, expect, it } from "vitest";
import { cancelPrompt, cancelWarning, feeLabel, feeWarning, frequentCancelWarning } from "@/lib/cancelFee";

describe("feeWarning (the member's «Скасувати»)", () => {
  it("says nothing when cancelling is free or the preview hasn't come", () => {
    expect(feeWarning(null)).toBeNull();
    expect(feeWarning({ fee: null, single: false, refundUah: null, cancelNumber: null, packUntil: null })).toBeNull();
  });

  it("a single training under 2 hours burns, no money back", () => {
    expect(feeWarning({ fee: "FULL", single: true, refundUah: null, cancelNumber: null, packUntil: null })).toBe(
      "Тренування згорить, гроші не повертаються.",
    );
  });

  it("a pass loses one training", () => {
    expect(feeWarning({ fee: "FULL", single: false, refundUah: null, cancelNumber: null, packUntil: null })).toBe(
      "З пакета спишеться 1 тренування.",
    );
  });

  it("a single personal training 2–12 hours ahead gets half back, with the sum when known", () => {
    expect(feeWarning({ fee: "HALF", single: true, refundUah: 300, cancelNumber: null, packUntil: null })).toBe(
      "Тренування згорить, повернемо 50% (300 ₴) готівкою.",
    );
    expect(feeWarning({ fee: "HALF", single: true, refundUah: null, cancelNumber: null, packUntil: null })).toBe(
      "Тренування згорить, повернемо 50% готівкою.",
    );
  });
});

describe("feeLabel (the trainer's «Скасували»)", () => {
  const fee = { kind: "FULL" as const, waived: false, refundUah: null, refundDone: false, refundSending: false };

  it("a spent training", () => {
    expect(feeLabel(fee)).toBe("списано");
  });

  it("half to return, then returned", () => {
    expect(feeLabel({ ...fee, kind: "HALF", refundUah: 300 })).toBe("поверне власник: 300 ₴");
    expect(feeLabel({ ...fee, kind: "HALF", refundUah: 300, refundDone: true })).toBe("повернено 300 ₴");
    expect(feeLabel({ ...fee, kind: "HALF", refundUah: 300, refundSending: true })).toBe("очікує повернення 300 ₴");
  });

  it("half without a sum reads as spent", () => {
    expect(feeLabel({ ...fee, kind: "HALF" })).toBe("списано");
  });

  it("«Не списувати» wins over everything", () => {
    expect(feeLabel({ ...fee, waived: true })).toBe("не списано");
    expect(feeLabel({ ...fee, kind: "HALF", refundUah: 300, waived: true })).toBe("не списано");
  });
});

describe("frequentCancelWarning (the member's «Скасувати», from the 3rd cancellation)", () => {
  const p = { fee: null, single: false, refundUah: null };

  it("says nothing before the 3rd, for a training no package pays for, or before the preview comes", () => {
    expect(frequentCancelWarning(null)).toBeNull();
    expect(frequentCancelWarning({ ...p, cancelNumber: null, packUntil: null })).toBeNull();
    expect(frequentCancelWarning({ ...p, cancelNumber: 2, packUntil: "2026-11-27" })).toBeNull();
  });

  it("a started package: the number and its end date", () => {
    expect(frequentCancelWarning({ ...p, cancelNumber: 3, packUntil: "2026-11-27" }, "2026-11-23")).toEqual({
      title: "Скасувань за місяць: 3",
      details: ["Плануйте тренування заздалегідь.", "Пакет діє до 27.11, невикористані тренування згорять."],
    });
  });

  it("the package's last day is today: says so instead of the date", () => {
    expect(frequentCancelWarning({ ...p, cancelNumber: 3, packUntil: "2026-11-23" }, "2026-11-23")).toEqual({
      title: "Скасувань за місяць: 3",
      details: ["Плануйте тренування заздалегідь.", "Сьогодні останній день пакета, невикористані тренування згорять."],
    });
  });

  it("a package not started yet: the number only", () => {
    expect(frequentCancelWarning({ ...p, cancelNumber: 4, packUntil: null })).toEqual({
      title: "Скасувань за місяць: 4",
      details: ["Плануйте тренування заздалегідь."],
    });
  });
});

describe("cancelWarning (one block in «Скасувати»)", () => {
  const none = { fee: null, single: false, refundUah: null, cancelNumber: null, packUntil: null };

  it("nothing to warn about", () => {
    expect(cancelWarning(null, "2026-11-23")).toBeNull();
    expect(cancelWarning(none, "2026-11-23")).toBeNull();
  });

  it("a fee only: the fee is the title", () => {
    expect(cancelWarning({ ...none, fee: "FULL" }, "2026-11-23")).toEqual({
      title: "Скасування зараз: з пакета спишеться 1 тренування.",
      details: [],
    });
  });

  it("often only: the count is the title", () => {
    expect(cancelWarning({ ...none, cancelNumber: 4, packUntil: "2026-11-27" }, "2026-11-23")).toEqual({
      title: "Скасувань за місяць: 4",
      details: ["Плануйте тренування заздалегідь.", "Пакет діє до 27.11, невикористані тренування згорять."],
    });
  });

  it("the package's last day: no fee line (what's left burns tonight anyway)", () => {
    expect(cancelWarning({ ...none, fee: "FULL", cancelNumber: 4, packUntil: "2026-11-23" }, "2026-11-23")).toEqual({
      title: "Скасувань за місяць: 4",
      details: ["Плануйте тренування заздалегідь.", "Сьогодні останній день пакета, невикористані тренування згорять."],
    });
    expect(cancelWarning({ ...none, fee: "FULL", cancelNumber: 1, packUntil: "2026-11-23" }, "2026-11-23")).toEqual({
      title: "Сьогодні останній день пакета",
      details: ["Невикористані тренування згорять."],
    });
  });

  it("both: the fee on top, the count and the date under it", () => {
    expect(cancelWarning({ ...none, fee: "FULL", cancelNumber: 4, packUntil: "2026-11-27" }, "2026-11-23")).toEqual({
      title: "Скасування зараз: з пакета спишеться 1 тренування.",
      details: [
        "Скасувань за місяць: 4. Плануйте тренування заздалегідь.",
        "Пакет діє до 27.11, невикористані тренування згорять.",
      ],
    });
  });
});

describe("cancelPrompt (the text over the reason field)", () => {
  const free = { fee: null, single: false, refundUah: null, cancelNumber: null, packUntil: null };
  const usual = { prompt: "Чому скасовуєте запис?", placeholder: "Напишіть причину..." };

  it("a free personal or split cancel asks when to move it", () => {
    expect(cancelPrompt(true, free)).toEqual({
      prompt: "Чому скасовуєте і коли вам зручно перенести?",
      placeholder: "Наприклад: захворіла, можу в четвер після 18:00",
    });
  });

  it("the usual question: a late cancel, a group training, or no answer about the fee yet", () => {
    expect(cancelPrompt(true, { ...free, fee: "FULL" })).toEqual(usual);
    expect(cancelPrompt(false, free)).toEqual(usual);
    expect(cancelPrompt(true, null)).toEqual(usual);
  });
});
