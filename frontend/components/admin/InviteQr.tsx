"use client";
import { useState } from "react";
import type { MemberInviteLink } from "@/lib/api";
import { QrCode } from "@/components/ui/QrCode";
import { ddmm, kyivToday } from "@/lib/dates";

export const inviteUrl = (token: string) => `${window.location.origin}/invite?t=${encodeURIComponent(token)}`;

// The new client scans it with the phone camera in the gym, or the trainer sends the link
export function InviteQr({ invite }: { invite: MemberInviteLink }) {
  const url = inviteUrl(invite.token);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col space-y-3">
      <p className="text-subtle text-sm">
        Наведіть камеру телефона на код. Діє до {ddmm(kyivToday(new Date(invite.expiresAt)))}, один раз.
      </p>
      <QrCode value={url} size={220} label={`QR-код запрошення для ${invite.displayName}`} />
      <div className="flex items-center space-x-2 rounded-lg border border-line px-3 py-2">
        <span className="flex-1 min-w-0 truncate text-subtle text-xs">{url}</span>
        <button
          type="button"
          onClick={() =>
            navigator.clipboard.writeText(url).then(
              () => setCopied(true),
              () => undefined,
            )
          }
          className="shrink-0 text-accent text-sm hover:underline"
        >
          {copied ? "Скопійовано ✓" : "Скопіювати"}
        </button>
      </div>
    </div>
  );
}
