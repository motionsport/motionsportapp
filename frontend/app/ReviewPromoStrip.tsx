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

// A strip above the header for a member with no review discount given: edge to edge on a phone, the page column's
// width on wider screens. Text centred on the whole strip; the ✕ sits over its right end (absolute) and hides it in this browser for a week (a cookie)
export default function ReviewPromoStrip({ percent }: { percent: number }) {
  const [hidden, setHidden] = useState(promoStripHidden);
  if (hidden) return null;

  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 sm:left-0 sm:w-full sm:translate-x-0 sm:mt-3 bg-background border-y sm:border sm:rounded-xl border-discount text-discount">
      <div className="relative max-w-xl mx-auto">
        <div className="flex items-center justify-center space-x-2 px-11 py-2.5 font-geologica font-bold text-xs uppercase tracking-wide">
          <GiftIcon />
          <span>Знижка {percent}% за відгук у Google</span>
        </div>
        <button
          type="button"
          onClick={() => {
            hidePromoStrip();
            setHidden(true);
          }}
          aria-label="Сховати"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-subtle text-xs hover:text-body transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
