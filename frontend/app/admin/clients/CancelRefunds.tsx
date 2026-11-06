"use client";
import { useState } from "react";
import { api, CancelRefund } from "@/lib/api";
import { ddmm } from "@/lib/dates";
import { TYPE_LABEL } from "@/lib/trainingTypes";
import { formatUah } from "@/lib/prices";
import { ERROR_TEXT, errorText } from "@/lib/apiErrors";
import { Modal } from "@/components/ui/Modal";

const SAVE_FAILED = "Не вдалося зберегти. Оновіть сторінку й спробуйте ще раз.";

// Half refunds after a late cancellation (2-24 h before), the training's trainer only. Online: «Повернути» sends
// the refund once (the app never sends it twice); cash: handed over. Or «Не списувати» while nothing was sent
export function CancelRefunds({ refunds, onDone }: { refunds: CancelRefund[]; onDone: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<CancelRefund | null>(null);

  if (refunds.length === 0) return null;

  const act = async (id: string, run: () => Promise<unknown>) => {
    setBusyId(id);
    setError("");
    try {
      await run();
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
                  <p className="text-warn text-sm mt-3">Повертаємо {formatUah(r.amountUah)}…</p>
                  <p className="text-subtle text-xs mt-1">
                    {r.liqpayPaymentId && <>Платіж {r.liqpayPaymentId}. </>}
                    Якщо довго, знайдіть його в кабінеті оплат → Повернення.
                  </p>
                  <button
                    type="button"
                    onClick={() => act(r.id, () => api.checkCancelRefund(r.id))}
                    disabled={busy}
                    className="btn-secondary w-full py-3 rounded-lg border text-sm mt-4 transition-colors disabled:opacity-60"
                  >
                    Перевірити
                  </button>
                  <button
                    type="button"
                    onClick={() => act(r.id, () => api.markCancelRefundDone(r.id))}
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
                  <button
                    type="button"
                    onClick={() => (online ? setConfirming(r) : act(r.id, () => api.markCancelRefundDone(r.id)))}
                    disabled={busy}
                    className="btn-primary w-full py-3.5 rounded-lg font-semibold mt-4 transition-colors disabled:opacity-60"
                  >
                    {online ? "Повернути" : "Віддано"} {formatUah(r.amountUah)}
                  </button>
                  <button
                    type="button"
                    onClick={() => act(r.id, () => api.waiveCancelFee(r.bookingId))}
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
              onClick={() => act(confirming.id, () => api.refundCancelRefund(confirming.id))}
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
