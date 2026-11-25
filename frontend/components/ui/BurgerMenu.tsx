"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { reloadTo } from "@/lib/loginRedirect";
import { api } from "@/lib/api";

export type MenuLink = { href: string; label: string };

// The team's burger (trainer and owner pages), same on phone and desktop; «Вийти» goes to the team login
export function BurgerMenu({ links }: { links: MenuLink[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const logout = async () => {
    setOpen(false);
    // Deliberately ignored: signed out or not, the team login comes next
    await api.logout().catch(() => {});
    reloadTo("/admin/login");
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Закрити меню" : "Відкрити меню"}
        aria-expanded={open}
        aria-controls="team-menu"
        className="w-11 h-11 flex items-center justify-center rounded-lg border border-line text-body hover:text-heading hover:bg-surface transition-colors"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          {open ? (
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          ) : (
            <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {open && (
        <nav
          id="team-menu"
          className="absolute right-0 top-full mt-2 z-40 w-56 bg-surface border border-line rounded-xl py-2 shadow-lg shadow-black/40"
        >
          <ul>
            {links.map((link) => {
              const current = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    aria-current={current ? "page" : undefined}
                    className={`flex items-center px-4 py-2.5 text-sm transition-colors hover:bg-background ${current ? "text-accent" : "text-body hover:text-heading"}`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-line my-2" />
          <button
            type="button"
            onClick={logout}
            className="w-full text-left px-4 py-2.5 text-sm text-muted hover:text-danger hover:bg-background transition-colors"
          >
            Вийти
          </button>
        </nav>
      )}
    </div>
  );
}
