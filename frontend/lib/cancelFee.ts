import type { Cancellation, CancelFeePreview } from "@/lib/api";
import { ddmm } from "@/lib/dates";

// Own cancellations in 30 days from which it counts as often: red on «Клієнти», the warning in «Скасувати»
export const FREQUENT_CANCELLATIONS = 3;

// Member's warning before cancelling; null = free
export function feeWarning(p: CancelFeePreview | null) {
  if (!p?.fee) return null;
  if (p.fee === "HALF") return `Тренування згорить, повернемо 50%${p.refundUah ? ` (${p.refundUah} ₴)` : ""}.`;
  return p.single ? "Тренування згорить, гроші не повертаються." : "З пакета спишеться 1 тренування.";
}

// «3-тє», «4-те», «7-ме»: the neuter ordinal (скасування)
export function ordinal(n: number) {
  const tens = n % 100;
  const last = n % 10;
  if (tens >= 11 && tens <= 19) return `${n}-те`;
  if (last === 3) return `${n}-тє`;
  if (last === 7 || last === 8) return `${n}-ме`;
  return `${n}-те`;
}

// Member's warning when cancelling often a training a package pays for; the date only once the package started
export function frequentCancelWarning(p: CancelFeePreview | null) {
  if (!p?.cancelNumber || p.cancelNumber < FREQUENT_CANCELLATIONS) return null;
  const lines = [`Це вже ${ordinal(p.cancelNumber)} скасування за місяць. Плануйте тренування заздалегідь.`];
  if (p.packUntil) lines.push(`Пакет діє до ${ddmm(p.packUntil)}, невикористані тренування згорять.`);
  return lines;
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
