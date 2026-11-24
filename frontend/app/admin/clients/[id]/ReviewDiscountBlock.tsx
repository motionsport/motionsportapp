"use client";
import { useState } from "react";
import { api, type DiscountView } from "@/lib/api";
import { errorText } from "@/lib/apiErrors";
import { Modal } from "@/components/ui/Modal";
import { discountGivenLine, discountStatusLine } from "@/lib/reviewDiscount";

// «Знижка за відгук»: given once per client, for a new Google review the client showed the trainer
export function ReviewDiscountBlock({
  memberId,
  discount,
  percent,
  headingClass,
  onGiven,
}: {
  memberId: string;
  discount: DiscountView | null;
  percent: number;
  headingClass: string;
  onGiven: () => Promise<unknown> | void;
}) {
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const give = async () => {
    setSaving(true);
    setError("");
    try {
      await api.giveReviewDiscount(memberId);
      setAsking(false);
      await onGiven();
    } catch (err) {
      setAsking(false);
      setError(errorText(err, "Не вдалося дати знижку"));
      // Given meanwhile by another trainer: show it
      await onGiven();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h3 className={headingClass}>Знижка за відгук</h3>
      {discount ? (
        <>
          <p className="text-subtle text-xs">
            {discountGivenLine(discount)} · {discount.code}
          </p>
          <p className={`mt-1 ${discount.state === "free" ? "text-accent" : "text-heading"}`}>
            {discountStatusLine(discount)}
          </p>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="btn-secondary px-4 py-2.5 rounded-lg border text-xs font-semibold transition-colors"
        >
          Дати знижку
        </button>
      )}
      {error && (
        <p role="alert" className="text-danger text-xs mt-2">
          {error}
        </p>
      )}
      {asking && (
        <Modal onDismiss={() => setAsking(false)} canDismiss={!saving} labelledBy="review-discount-title">
          <h2 id="review-discount-title" className="font-geologica font-semibold text-lg text-heading mb-2 pr-8">
            Клієнт показав новий відгук у Google?
          </h2>
          <p className="text-subtle text-base mb-5">
            Знижка {percent}% дається один раз і діє місяць: на абонемент, групові або в барі.
          </p>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={give}
              disabled={saving}
              className="btn-primary flex-1 py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {saving ? "Збереження..." : "Так, дати"}
            </button>
            <button
              type="button"
              onClick={() => setAsking(false)}
              disabled={saving}
              className="btn-ghost flex-1 py-3 rounded-lg border text-sm transition-colors"
            >
              Ні
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
