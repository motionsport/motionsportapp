"use client";
import { useState } from "react";

// «Збережіть ці дані»: the member code and the one-time recovery code, with copy buttons. Sign-up and invite sign-up
export function SavedCodes({ memberCode, recoveryCode }: { memberCode: string; recoveryCode: string }) {
  const [copied, setCopied] = useState<"code" | "recovery" | null>(null);

  const copy = async (text: string, key: "code" | "recovery") => {
    // No clipboard (old browser, no https): the code stays on screen to copy by hand
    const ok = await navigator.clipboard.writeText(text).then(
      () => true,
      () => false,
    );
    if (!ok) return;
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <>
      <div className="bg-surface rounded-xl p-5 mb-4 space-y-4">
        <div>
          <p className="text-muted text-xs mb-1">Ваш код учасника</p>
          <div className="flex items-center justify-between">
            <span className="font-geologica font-semibold text-xl text-heading">{memberCode}</span>
            <button
              type="button"
              onClick={() => copy(memberCode, "code")}
              className="text-accent text-sm hover:underline ml-2"
            >
              {copied === "code" ? "Скопійовано ✓" : "Копіювати"}
            </button>
          </div>
        </div>

        <div>
          <p className="text-muted text-xs mb-1">Код відновлення</p>
          <div className="flex items-center justify-between space-x-2">
            <span className="font-mono text-sm text-body break-all">{recoveryCode}</span>
            <button
              type="button"
              onClick={() => copy(recoveryCode, "recovery")}
              className="text-accent text-sm hover:underline shrink-0"
            >
              {copied === "recovery" ? "Скопійовано ✓" : "Копіювати"}
            </button>
          </div>
        </div>
      </div>

      <p className="text-danger text-sm mb-6">
        ⚠ Збережіть код відновлення зараз. Якщо забудете PIN, він потрібен для відновлення доступу.
      </p>
    </>
  );
}
