"use client";
import { useState } from "react";
import { hidePromoStrip, promoStripHidden } from "@/lib/reviewDiscount";

// Home page, for a member with no review discount given; the ✕ hides it in this browser
export default function ReviewPromoStrip({ percent }: { percent: number }) {
  const [hidden, setHidden] = useState(promoStripHidden);
  if (hidden) return null;

  return (
    <div className="flex items-start justify-between space-x-3 rounded-xl border border-teal bg-teal/10 pl-4 pr-1 py-2 mb-5">
      <p className="text-accent text-base font-medium py-1.5">
        Залиште відгук у Google і отримайте знижку {percent}%: покажіть відгук тренеру
      </p>
      <button
        type="button"
        onClick={() => {
          hidePromoStrip();
          setHidden(true);
        }}
        aria-label="Сховати"
        className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-subtle text-base hover:text-body transition-colors"
      >
        ✕
      </button>
    </div>
  );
}
