"use client";
import { useState } from "react";
import { api, Purchase, TransferDetails as Details } from "@/lib/api";
import { submitLiqPay } from "@/lib/liqpay";
import { errorText } from "@/lib/apiErrors";
import { formatUah, lineName } from "@/lib/prices";
import { TransferDetails } from "@/components/purchases/TransferDetails";

// `onChanged` reloads the page
export function PendingPurchase({
  pending,
  onChanged,
}: {
  pending: Purchase & { transfer: Details | null };
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pay = async () => {
    setBusy(true);
    setError("");
    try {
      const checkout = await api.checkoutPurchase(pending.id);
      if ("status" in checkout) {
        await onChanged(); // a previous attempt was paid after all
        setBusy(false);
      } else {
        submitLiqPay(checkout);
      }
    } catch (err) {
      // LiqPay switched off meanwhile: PAYMENT_METHOD_OFF says to cancel and pick another way
      setError(
        errorText(err, "Не вдалося перейти до оплати. Спробуйте ще раз.", {
          PAYMENT_METHOD_OFF: "Онлайн-оплату зараз вимкнено. Скасуйте покупку й оберіть інший спосіб.",
        }),
      );
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    setError("");
    try {
      await api.cancelPurchase(pending.id);
      await onChanged();
    } catch {
      setError("Не вдалося скасувати. Оновіть сторінку.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border-2 border-line bg-surface p-4">
        <div className="flex items-center justify-between space-x-3 mb-2">
          <span className="text-heading font-medium">Очікує оплати</span>
          <span className="font-geologica text-heading tabular-nums">{formatUah(pending.totalUah)}</span>
        </div>
        {pending.lines.map((l) => (
          <p key={lineName(l)} className="text-muted text-sm">
            {lineName(l)}
          </p>
        ))}
        {pending.method === "CASH" && (
          <p className="text-body text-sm mt-2">Тренер підтвердить, коли отримає готівку.</p>
        )}
        {pending.method === "TRANSFER" && (
          <>
            <p className="text-body text-sm mt-2 mb-3">Тренер підтвердить, коли гроші прийдуть на рахунок.</p>
            {pending.transfer && <TransferDetails transfer={pending.transfer} />}
          </>
        )}
        <div className="flex flex-col space-y-2 mt-3">
          {pending.method === "LIQPAY" && (
            <button
              type="button"
              onClick={pay}
              disabled={busy}
              className="btn-primary w-full py-3 rounded-lg text-sm transition-colors disabled:opacity-60"
            >
              {busy ? "Завантаження..." : "Оплатити"}
            </button>
          )}
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="btn-ghost w-full py-3 rounded-lg border text-sm transition-colors disabled:opacity-60"
          >
            Скасувати
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </>
  );
}
