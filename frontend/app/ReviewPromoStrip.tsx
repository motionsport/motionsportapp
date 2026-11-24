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

// A running strip above the header, edge to edge, for a member with no review discount given;
// the ✕ hides it in this browser for a week (a cookie). With reduced motion it stands still
export default function ReviewPromoStrip({ percent }: { percent: number }) {
  const [hidden, setHidden] = useState(promoStripHidden);
  if (hidden) return null;

  const text = `Знижка ${percent}% за відгук у Google: покажіть його тренеру`;
  // One copy: the text twice, so the strip never runs out on a wide screen
  const copy = (
    <span className="flex shrink-0 items-center">
      {[0, 1].map((i) => (
        <span key={i} className="flex items-center space-x-2 pr-8">
          <GiftIcon />
          <span>{text}</span>
        </span>
      ))}
    </span>
  );

  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 bg-background border-y border-teal text-accent">
      <div className="flex items-center">
        <p className="sr-only">{text}</p>
        <div
          aria-hidden="true"
          className="flex-1 overflow-hidden whitespace-nowrap font-geologica font-bold text-xs uppercase tracking-wide py-2"
        >
          <div className="promo-marquee flex w-max">
            {copy}
            {copy}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            hidePromoStrip();
            setHidden(true);
          }}
          aria-label="Сховати"
          className="w-9 h-9 shrink-0 flex items-center justify-center bg-background text-subtle text-xs hover:text-body transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
