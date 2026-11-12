"use client";
import { useState } from "react";
import type { TransferDetails as Details } from "@/lib/api";
import { formatUah } from "@/lib/prices";

// IBAN in groups of four, easier to check by eye
const spaced = (iban: string) => iban.replace(/(.{4})/g, "$1 ").trim();

function CopyRow({ label, value, shown = value }: { label: string; value: string; shown?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard (old browser, no https): the value stays on screen to copy by hand
    }
  };
  return (
    <div className="flex items-start justify-between space-x-3 py-2 border-b border-line last:border-b-0">
      <div className="min-w-0">
        <p className="text-subtle text-xs">{label}</p>
        <p className="text-heading text-base break-words select-all">{shown}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 text-accent text-xs underline hover:text-teal-light py-1"
        aria-label={`Скопіювати: ${label}`}
      >
        {copied ? "Скопійовано" : "Скопіювати"}
      </button>
    </div>
  );
}

// The gym's account for a transfer. Members pay from the same phone, so no QR picture: a bank's own link opens its app
// with the details filled in (the generic NBU link only showed the NBU page); other banks: copy the details by hand
export function TransferDetails({ transfer }: { transfer: Details }) {
  return (
    <div className="space-y-3">
      <p className="rounded-xl border border-warn-line bg-warn-bg px-4 py-3 text-sm text-warn">
        Обов&apos;язково вкажіть призначення з кодом {transfer.code}: за ним тренер знайде ваш переказ.
      </p>
      <div className="flex space-x-2">
        <a
          href={transfer.bankLinks.privat24}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex-1 py-3 rounded-lg text-sm text-center transition-colors"
        >
          Оплатити в Приват24
        </a>
        <a
          href={transfer.bankLinks.monobank}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex-1 py-3 rounded-lg text-sm text-center transition-colors"
        >
          Оплатити в monobank
        </a>
      </div>
      <p className="text-subtle text-xs">Інший банк: скопіюйте реквізити нижче.</p>
      <div className="rounded-xl border border-line bg-surface px-4 py-1">
        <CopyRow label="Сума" value={String(transfer.amountUah)} shown={formatUah(transfer.amountUah)} />
        <CopyRow label="Отримувач" value={transfer.recipient} />
        <CopyRow label="IBAN" value={transfer.iban} shown={spaced(transfer.iban)} />
        <CopyRow label="ЄДРПОУ / РНОКПП" value={transfer.taxId} />
        <CopyRow label="Призначення" value={transfer.purpose} />
      </div>
    </div>
  );
}
