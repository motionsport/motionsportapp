"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, CatalogItem, MyPurchases, PurchaseMethod, TransferDetails as Details } from "@/lib/api";
import { submitLiqPay } from "@/lib/liqpay";
import { errorText } from "@/lib/apiErrors";
import { Modal } from "@/components/ui/Modal";
import { formatUah, lineName } from "@/lib/prices";
import { TransferDetails } from "@/components/purchases/TransferDetails";

// Booking without a group pass: LiqPay books once paid; cash and transfer book at once, the trainer confirms the money
export function GroupPassModal({
  slotId,
  slotTime,
  onDismiss,
  onBooked,
}: {
  slotId: string;
  slotTime: string;
  onDismiss: () => void;
  onBooked: () => void;
}) {
  const [data, setData] = useState<MyPurchases | null>(null);
  // pick: the item for cash or a transfer (`manual`)
  const [step, setStep] = useState<"choose" | "pick" | "booked">("choose");
  const [manual, setManual] = useState<"CASH" | "TRANSFER">("CASH");
  const [transfer, setTransfer] = useState<Details | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getPurchases()
      .then(setData)
      .catch(() => setError("Не вдалося завантажити ціни. Спробуйте ще раз."));
  }, []);

  const passes = data?.catalog.groupPasses ?? [];
  const single = passes.find((p) => p.trainingCount === 1);
  const pass = passes.find((p) => (p.trainingCount ?? 0) > 1);

  const choose = (method: "CASH" | "TRANSFER") => {
    setManual(method);
    setStep("pick");
  };

  const buy = async (item: CatalogItem, method: PurchaseMethod) => {
    setBusy(true);
    setError("");
    try {
      const { checkout, transfer } = await api.createPurchase([item.id], method, slotId);
      if (method !== "LIQPAY") {
        setTransfer(transfer ?? null);
        setStep("booked");
        setBusy(false);
        onBooked();
      } else if (checkout && !("status" in checkout)) {
        submitLiqPay(checkout);
      }
    } catch (err) {
      setError(errorText(err, "Не вдалося оформити покупку. Спробуйте ще раз."));
      setBusy(false);
    }
  };

  return (
    <Modal onDismiss={onDismiss}>
      {step === "booked" ? (
        <>
          <h2 className="font-geologica font-semibold text-lg text-heading mb-1">Записано на {slotTime}</h2>
          {transfer ? (
            <>
              <p className="text-body text-sm mb-4">
                Перекажіть {formatUah(transfer.amountUah)} на рахунок. Тренер підтвердить, коли гроші прийдуть.
                Реквізити є й на сторінці «Абонемент і пакети».
              </p>
              <div className="mb-4">
                <TransferDetails transfer={transfer} />
              </div>
            </>
          ) : (
            <p className="text-body text-sm mb-4">Оплатіть тренеру в залі, і він підтвердить оплату.</p>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="btn-primary w-full py-3 rounded-lg text-sm font-medium transition-colors"
          >
            Добре
          </button>
        </>
      ) : (
        <>
          <h2 className="font-geologica font-semibold text-lg text-heading mb-1">Групове тренування {slotTime}</h2>
          <div className="mb-4" />

          {!data && !error && <p className="text-muted text-sm">Завантаження...</p>}

          {data && (
            <div className="flex flex-col space-y-2">
              {step === "choose" ? (
                <>
                  {data.methods.liqpay && single && (
                    <button
                      type="button"
                      onClick={() => buy(single, "LIQPAY")}
                      disabled={busy}
                      className="btn-primary w-full py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                    >
                      Купити разово · {formatUah(single.amountUah)}
                    </button>
                  )}
                  {data.methods.liqpay && pass && (
                    <button
                      type="button"
                      onClick={() => buy(pass, "LIQPAY")}
                      disabled={busy}
                      className="btn-primary w-full py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                    >
                      Купити пакет · {pass.optionLabel} · {formatUah(pass.amountUah)}
                    </button>
                  )}
                  {data.methods.transfer && (
                    <button
                      type="button"
                      onClick={() => choose("TRANSFER")}
                      disabled={busy}
                      className={`${data.methods.liqpay ? "btn-ghost border" : "btn-primary font-medium"} w-full py-3 rounded-lg text-sm transition-colors disabled:opacity-60`}
                    >
                      Оплатити переказом
                    </button>
                  )}
                  {data.methods.cash &&
                    (data.canPayCash ? (
                      <button
                        type="button"
                        onClick={() => choose("CASH")}
                        disabled={busy}
                        className="btn-ghost w-full py-3 rounded-lg border text-sm transition-colors disabled:opacity-60"
                      >
                        Оплатити готівкою
                      </button>
                    ) : (
                      <p className="text-muted text-xs">
                        Оплата тренувань готівкою з&apos;явиться, коли за вами закріплять тренера. Попросіть про це в
                        залі.
                      </p>
                    ))}
                  {!data.methods.liqpay && !data.methods.transfer && !(data.methods.cash && data.canPayCash) && (
                    <p className="text-body text-sm">Оплата зараз недоступна. Зверніться до тренера в залі.</p>
                  )}
                </>
              ) : (
                [single, pass]
                  .filter((x): x is CatalogItem => !!x)
                  .map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => buy(item, manual)}
                      disabled={busy}
                      className="btn-primary w-full py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                    >
                      {lineName(item)} · {formatUah(item.amountUah)}
                    </button>
                  ))
              )}
            </div>
          )}

          {error && (
            <p className="text-danger text-sm mt-3">
              {error}{" "}
              {error.includes("Абонемент і пакети") && (
                <Link href="/purchases" className="underline">
                  Відкрити
                </Link>
              )}
            </p>
          )}

          <button
            type="button"
            onClick={() => (step === "pick" ? setStep("choose") : onDismiss())}
            className="btn-ghost w-full py-3 rounded-lg border text-sm transition-colors mt-2"
          >
            Назад
          </button>
        </>
      )}
    </Modal>
  );
}
