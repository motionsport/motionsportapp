import type { Cancellation, CancelFeePreview } from "@/lib/api";
import { ddmm, kyivToday } from "@/lib/dates";

// Own cancellations in 30 days from which it counts as often: red on «Клієнти», the warning in «Скасувати»
export const FREQUENT_CANCELLATIONS = 3;

// Member's warning before cancelling; null = free
export function feeWarning(p: CancelFeePreview | null) {
  if (!p?.fee) return null;
  if (p.fee === "HALF") return `Тренування згорить, повернемо 50%${p.refundUah ? ` (${p.refundUah} ₴)` : ""}.`;
  return p.single ? "Тренування згорить, гроші не повертаються." : "З пакета спишеться 1 тренування.";
}

// The question over the reason field. A free cancel of a personal / split training also asks when to move it
// (one field: it goes to the trainer as the reason). No answer about the fee yet = the usual question
export function cancelPrompt(assigned: boolean, p: CancelFeePreview | null) {
  if (assigned && p && !p.fee) {
    return {
      prompt: "Чому скасовуєте і коли вам зручно перенести?",
      placeholder: "Наприклад: захворіла, можу в четвер після 18:00",
    };
  }
  return { prompt: "Чому скасовуєте запис?", placeholder: "Напишіть причину..." };
}

// Member's warning when cancelling often a training a package pays for; the date only once the package started
export function frequentCancelWarning(p: CancelFeePreview | null, today = kyivToday()) {
  if (!p?.cancelNumber || p.cancelNumber < FREQUENT_CANCELLATIONS) return null;
  const details = ["Плануйте тренування заздалегідь."];
  if (p.packUntil === today) details.push("Сьогодні останній день пакета, невикористані тренування згорять.");
  else if (p.packUntil) details.push(`Пакет діє до ${ddmm(p.packUntil)}, невикористані тренування згорять.`);
  return { title: `Скасувань за місяць: ${p.cancelNumber}`, details };
}

// «Скасувати»: one warn block. The fee (what happens now) on top, the cancellation count and the package's end under it
// On the package's last day the fee says nothing (what's left burns tonight anyway): the package's end instead
export function cancelWarning(p: CancelFeePreview | null, today = kyivToday()) {
  const lastDay = !!p?.packUntil && p.packUntil === today;
  const fee = lastDay ? null : feeWarning(p);
  const often = frequentCancelWarning(p, today);
  if (!fee && !often && lastDay && p?.fee) {
    return { title: "Сьогодні останній день пакета", details: ["Невикористані тренування згорять."] };
  }
  if (!fee) return often;
  const title = `Скасування зараз: ${fee.charAt(0).toLowerCase() + fee.slice(1)}`;
  if (!often) return { title, details: [] as string[] };
  const [plan, ...rest] = often.details;
  return { title, details: [`${often.title}. ${plan}`, ...rest] };
}

// Trainer's fee tag on a cancellation
export function feeLabel(fee: NonNullable<Cancellation["fee"]>) {
  if (fee.waived) return "не списано";
  if (fee.kind === "HALF" && fee.refundUah) {
    if (fee.refundDone) return `повернено ${fee.refundUah} ₴`;
    // Sent, the money not gone yet (LiqPay may wait for new payments)
    if (fee.refundSending) return `очікує повернення ${fee.refundUah} ₴`;
    return `повернути ${fee.refundUah} ₴`;
  }
  return "списано";
}
