"use client";
import { useEffect, useState } from "react";
import { api, CancelRefund } from "@/lib/api";
import { ddmm } from "@/lib/dates";
import { TYPE_LABEL } from "@/lib/trainingTypes";
import { formatUah } from "@/lib/prices";
import { ERROR_TEXT, errorText } from "@/lib/apiErrors";
import { Modal } from "@/components/ui/Modal";
import { refundNotice, type RefundAction } from "./refundNotice";

const SAVE_FAILED = "Не вдалося зберегти. Оновіть сторінку й спробуйте ще раз.";
// How long the message after an action stays
const NOTICE_MS = 5000;

// Half refunds after a late cancellation (2-24 h before), the training's trainer only. Online: «Повернути» sends
// the refund once (the app never sends it twice); cash: handed over. Or «Не списувати» while nothing was sent
export function CancelRefunds({ refunds, onDone }: { refunds: CancelRefund[]; onDone: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<CancelRefund | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);

  // The block hides with its last row, the message stays until it fades
  if (refunds.length === 0 && !notice) return null;

  const act = async (r: CancelRefund, action: RefundAction, run: () => Promise<{ status?: string } | unknown>) => {
    const id = r.id;
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      const res = (await run()) as { status?: "DUE" | "SENDING" | "DONE" } | undefined;
      setNotice(refundNotice(action, res?.status ?? "DONE", r));
    } catch (err) {
      setError(errorText(err, SAVE_FAILED));
    } finally {
      setBusyId(null);
      setConfirming(null);
      onDone();
    }
  };

  return (
    <section>
      <h2 className="font-geologica font-semibold text-heading uppercase mb-1">Повернути гроші</h2>
      <p className="text-muted text-xs mb-3">
        Клієнт скасував разове тренування менш ніж за добу: поверніть половину ціни або не списуйте.
      </p>
      <div className="flex flex-col space-y-3">
        {refunds.map((r) => {
          const busy = busyId === r.id;
          const online = r.method === "LIQPAY";
          return (
            <div key={r.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-baseline justify-between space-x-3">
                <span className="text-heading font-semibold">{r.displayName}</span>
                <span className="font-geologica text-heading tabular-nums">{formatUah(r.amountUah)}</span>
              </div>
              <div className="text-subtle text-xs mt-1">
                {TYPE_LABEL[r.trainingType]} {ddmm(r.localDate)} о {r.slotTime} ·{" "}
                {online ? "оплачено онлайн" : "оплачено готівкою: віддайте в руки"}
              </div>

              {r.status === "SENDING" ? (
                <>
                  <p className="text-warn text-sm mt-3">Очікує повернення {formatUah(r.amountUah)}</p>
                  <p className="text-subtle text-xs mt-1">
                    Повернення відправлено. Гроші підуть на картку клієнта, коли його виконає платіжна система: це може
                    зайняти кілька днів.
                    {r.liqpayPaymentId && <> Платіж {r.liqpayPaymentId} у кабінеті оплат → Повернення.</>}
                  </p>
                  <button
                    type="button"
                    onClick={() => act(r, "check", () => api.checkCancelRefund(r.id))}
                    disabled={busy}
                    className="btn-secondary w-full py-3 rounded-lg border text-sm mt-4 transition-colors disabled:opacity-60"
                  >
                    Перевірити
                  </button>
                  <button
                    type="button"
                    onClick={() => act(r, "done", () => api.markCancelRefundDone(r.id))}
                    disabled={busy}
                    className="block mx-auto text-subtle text-xs underline hover:text-body py-2 mt-1 transition-colors disabled:opacity-60"
                  >
                    Повернено (є в кабінеті оплат)
                  </button>
                </>
              ) : (
                <>
                  {r.lastError && (
                    <p role="alert" className="text-danger text-xs mt-3">
                      {ERROR_TEXT[r.lastError] ?? SAVE_FAILED}
                    </p>
                  )}
                  {r.lastError === "REFUNDED_ELSEWHERE" && (
                    <button
                      type="button"
                      onClick={() => act(r, "done", () => api.markCancelRefundDone(r.id))}
                      disabled={busy}
                      className="block text-subtle text-xs underline hover:text-body py-2 transition-colors disabled:opacity-60"
                    >
                      Повернено (є в кабінеті оплат)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => (online ? setConfirming(r) : act(r, "done", () => api.markCancelRefundDone(r.id)))}
                    disabled={busy}
                    className="btn-primary w-full py-3.5 rounded-lg font-semibold mt-4 transition-colors disabled:opacity-60"
                  >
                    {online ? "Повернути" : "Віддано"} {formatUah(r.amountUah)}
                  </button>
                  <button
                    type="button"
                    onClick={() => act(r, "waive", () => api.waiveCancelFee(r.bookingId))}
                    disabled={busy}
                    className="block mx-auto text-subtle text-xs underline hover:text-body py-2 mt-1 transition-colors disabled:opacity-60"
                  >
                    Не списувати
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
      {notice && (
        <p role="status" className="text-accent text-xs mt-2">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-danger text-xs mt-2">
          {error}
        </p>
      )}

      {confirming && (
        <Modal
          onDismiss={() => setConfirming(null)}
          canDismiss={busyId !== confirming.id}
          labelledBy="refund-confirm-title"
        >
          <h2 id="refund-confirm-title" className="font-geologica font-semibold text-lg text-heading mb-1">
            Повернути {formatUah(confirming.amountUah)}?
          </h2>
          <p className="text-body text-sm mb-4">
            Гроші підуть клієнту {confirming.displayName} на картку, з якої була оплата. Скасувати повернення потім не
            можна.
          </p>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => act(confirming, "refund", () => api.refundCancelRefund(confirming.id))}
              disabled={busyId === confirming.id}
              className="btn-primary flex-1 py-3 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
            >
              Повернути
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              disabled={busyId === confirming.id}
              className="btn-ghost flex-1 py-3 rounded-lg border text-sm transition-colors disabled:opacity-60"
            >
              Ні
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
