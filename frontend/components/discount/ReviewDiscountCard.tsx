"use client";
import { useState } from "react";
import { api, DiscountView } from "@/lib/api";
import { errorText } from "@/lib/apiErrors";
import { ddmm } from "@/lib/dates";
import { kyivTime } from "@/lib/kyivTime";
import { Modal } from "@/components/ui/Modal";

// Home page and «Абонемент і пакети»: a free discount with «Використати в барі», a held one as a line.
// Used / expired: nothing, except right after «Використати в барі» here (the member shows it at the bar)
export function ReviewDiscountCard({
  discount,
  percent,
  className = "",
}: {
  discount: DiscountView;
  percent: number;
  className?: string;
}) {
  const [usedAtBar, setUsedAtBar] = useState<DiscountView | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const spendAtBar = async () => {
    setBusy(true);
    setError("");
    try {
      setUsedAtBar(await api.useDiscountAtBar());
      setConfirming(false);
    } catch (err) {
      setError(errorText(err, "Не вдалося використати знижку. Спробуйте ще раз."));
    } finally {
      setBusy(false);
    }
  };

  const shown = usedAtBar ?? discount;
  if (!usedAtBar && shown.state !== "free" && shown.state !== "held") return null;

  return (
    <div className={`rounded-xl border border-teal/30 bg-teal/5 p-4 ${className}`}>
      {usedAtBar ? (
        <>
          <p className="text-heading font-medium">
            Використано в барі{usedAtBar.usedAt ? `, ${kyivTime(usedAtBar.usedAt)}` : ""}
          </p>
          <p className="font-geologica text-accent text-sm tracking-wide mt-1">{usedAtBar.code}</p>
        </>
      ) : (
        <>
          <p className="text-heading font-medium">
            🎁 Знижка {percent}% за відгук до {ddmm(shown.validUntil)}
          </p>
          {shown.state === "held" ? (
            <p className="text-subtle text-base mt-1">Знижку застосовано до покупки, що чекає оплати</p>
          ) : (
            <>
              <p className="text-body text-base mt-1">
                Промокод: <span className="font-geologica text-accent tracking-wide">{shown.code}</span>
              </p>
              <p className="text-subtle text-xs mt-1">На абонемент, групові або в барі</p>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="btn-secondary w-full py-3 rounded-lg border text-sm transition-colors mt-3"
              >
                Використати в барі
              </button>
            </>
          )}
        </>
      )}

      {confirming && (
        <Modal onDismiss={() => setConfirming(false)} canDismiss={!busy} labelledBy="bar-discount-title">
          <h2 id="bar-discount-title" className="font-geologica font-semibold text-lg text-heading mb-1 pr-8">
            Використати знижку в барі?
          </h2>
          <p className="text-body text-sm mb-4">Повернути не можна</p>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={spendAtBar}
              disabled={busy}
              className="btn-primary flex-1 py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              Так
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="btn-ghost flex-1 py-3 rounded-lg border text-sm transition-colors disabled:opacity-60"
            >
              Ні
            </button>
          </div>
          {error && (
            <p role="alert" className="text-danger text-sm mt-3">
              {error}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
