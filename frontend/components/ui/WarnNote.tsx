import type { ReactNode } from "react";

// A warning block: the ⚠ triangle, the main line in warn, an optional explanation under it in subtle
// («Записалось мало людей», «Скасувань за місяць: 3», «Скасування зараз: …»). Margins come from the caller
export function WarnNote({
  title,
  children,
  className = "",
}: {
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-start space-x-2.5 rounded-xl border border-warn-line bg-warn-bg px-3 py-2.5 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="text-warn w-5 h-5 mt-0.5 shrink-0"
      >
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
      <div className="min-w-0">
        <p className="text-warn text-base font-medium">{title}</p>
        {children && <div className="text-subtle text-xs mt-1 space-y-1">{children}</div>}
      </div>
    </div>
  );
}
