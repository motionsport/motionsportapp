"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, MemberInviteLink, MemberInviteRow } from "@/lib/api";
import { errorText } from "@/lib/apiErrors";
import { ddmm, kyivToday } from "@/lib/dates";
import { Modal } from "@/components/ui/Modal";
import { InviteQr } from "@/components/admin/InviteQr";

// «+ Запросити нового клієнта» and the trainer's invites not used yet: «QR» (a new link, the old one stops working),
// «Скасувати»
export function MemberInvites() {
  const [rows, setRows] = useState<MemberInviteRow[]>([]);
  const [shown, setShown] = useState<MemberInviteLink | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api
      .getMemberInvites()
      .then(setRows)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(errorText(err, "Не вдалося змінити запрошення"));
    }
    load();
  };

  return (
    <section>
      <Link
        href="/admin/clients/invite"
        className="btn-primary block w-full py-3 rounded-lg font-medium text-sm text-center transition-colors"
      >
        + Запросити нового клієнта
      </Link>
      {rows.length > 0 && (
        <>
          <h2 className="font-geologica font-semibold text-heading uppercase text-xs tracking-wide mt-5 mb-2">
            Запрошення чекають
          </h2>
          <ul className="border-t border-line">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between space-x-3 py-2 border-b border-line text-sm">
                <span className="min-w-0 text-body">
                  {r.displayName} <span className="text-subtle">· до {ddmm(kyivToday(new Date(r.expiresAt)))}</span>
                </span>
                <span className="shrink-0 flex space-x-4">
                  <button
                    type="button"
                    onClick={() => run(async () => setShown(await api.relinkMemberInvite(r.id)))}
                    className="text-accent hover:underline"
                  >
                    QR
                  </button>
                  <button
                    type="button"
                    onClick={() => run(() => api.revokeMemberInvite(r.id))}
                    className="text-muted hover:text-danger transition-colors"
                  >
                    Скасувати
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {error && (
        <p role="alert" className="text-danger text-xs mt-2">
          {error}
        </p>
      )}
      {shown && (
        <Modal onDismiss={() => setShown(null)} labelledBy="invite-qr-title" variant="card">
          <h2 id="invite-qr-title" className="font-geologica font-semibold text-lg text-heading mb-3 pr-8">
            Запрошення для {shown.displayName}
          </h2>
          <InviteQr invite={shown} />
        </Modal>
      )}
    </section>
  );
}
