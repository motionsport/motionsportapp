"use client";
import { useState } from "react";
import { hidePromoStrip, promoStripHidden } from "@/lib/reviewDiscount";

function GiftIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
    </svg>
  );
}

// A strip above the header, edge to edge, for a member with no review discount given; the text and ✕ sit
// in the page column, so nothing important is at the screen's edges. «?» opens how to get it; the ✕ hides the strip
// in this browser for a week (a cookie)
export default function ReviewPromoStrip({ percent }: { percent: number }) {
  const [hidden, setHidden] = useState(promoStripHidden);
  const [howOpen, setHowOpen] = useState(false);
  if (hidden) return null;

  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 bg-background border-y border-teal text-accent">
      <div className="max-w-xl mx-auto flex items-center space-x-1 pl-5 pr-2">
        <div className="flex-1 flex items-center justify-center space-x-2 font-geologica font-bold text-xs uppercase tracking-wide">
          <GiftIcon />
          <span>Знижка {percent}% за відгук у Google</span>
          <button
            type="button"
            onClick={() => setHowOpen((v) => !v)}
            aria-expanded={howOpen}
            aria-controls="review-promo-how"
            aria-label="Як отримати знижку"
            className="w-8 h-8 shrink-0 flex items-center justify-center group"
          >
            <span className="w-5 h-5 flex items-center justify-center rounded-full border border-teal text-accent group-hover:bg-teal group-hover:text-on-teal transition-colors">
              ?
            </span>
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            hidePromoStrip();
            setHidden(true);
          }}
          aria-label="Сховати"
          className="w-9 h-9 shrink-0 flex items-center justify-center text-subtle text-xs hover:text-body transition-colors"
        >
          ✕
        </button>
      </div>
      {howOpen && (
        <p id="review-promo-how" className="max-w-xl mx-auto px-5 pb-2 -mt-1 text-center text-xs text-body">
          Покажіть відгук тренеру
        </p>
      )}
    </div>
  );
}
