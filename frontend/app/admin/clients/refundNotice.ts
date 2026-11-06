import { formatUah } from "@/lib/prices";

export type RefundAction = "refund" | "check" | "done" | "waive";

// Short message after an action in «Повернути гроші»; status = the row's state the server answered
export function refundNotice(
  action: RefundAction,
  status: "DUE" | "SENDING" | "DONE",
  r: { amountUah: number; displayName: string },
): string {
  const amount = formatUah(r.amountUah);
  if (action === "waive") return `Не списано: тренування повернулось клієнту ${r.displayName}.`;
  if (action === "done") return `Позначено: ${amount} повернено клієнту ${r.displayName}.`;
  if (status === "DONE") return `Повернено ${amount}: гроші пішли клієнту ${r.displayName}.`;
  if (action === "refund") {
    return `Повернення ${amount} відправлено. Гроші підуть клієнту, коли платіжна система його виконає.`;
  }
  return "Ще не повернено: платіжна система чекає. Перевірте пізніше.";
}
