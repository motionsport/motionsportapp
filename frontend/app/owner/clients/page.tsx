"use client";
import { useCallback, useEffect, useState } from "react";
import { api, OwnerMember } from "@/lib/api";
import { PageLayout } from "@/components/ui/PageLayout";
import { OwnerMenu } from "@/components/owner/OwnerMenu";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { errorText } from "@/lib/apiErrors";
import { toAdminLogin } from "@/lib/adminAuth";
import { ddmm, kyivToday } from "@/lib/dates";

// The owner's «Клієнти»: find a client, «Вимкнути» (can't sign in, bookings ahead and an unpaid purchase cancelled,
// trainers don't see them; history and stats stay) / «Увімкнути»
export default function OwnerClientsPage() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<OwnerMember[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [asking, setAsking] = useState<OwnerMember | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (q: string) => {
    try {
      setRows(await api.getOwnerMembers(q));
      setLoadError(false);
    } catch (err) {
      if (!toAdminLogin(err)) setLoadError(true);
    }
  }, []);

  // Search as you type, a little after the last key
  useEffect(() => {
    const t = setTimeout(() => load(query), 250);
    return () => clearTimeout(t);
  }, [query, load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      setAsking(null);
      await load(query);
    } catch (err) {
      setError(errorText(err, "Не вдалося змінити клієнта"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageLayout variant="top" loading={!rows && !loadError} action={<OwnerMenu />}>
      <h1 className="font-geologica font-semibold text-title sm:text-display text-heading uppercase mb-6">Клієнти</h1>

      <input
        id="owner-clients-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ім'я або код учасника"
        className="input-field w-full border rounded-lg px-4 py-3 text-sm focus:outline-none mb-4"
      />

      {loadError && (
        <p role="alert" className="text-danger text-sm">
          Не вдалося завантажити клієнтів.
        </p>
      )}
      {error && (
        <p role="alert" className="text-danger text-sm mb-3">
          {error}
        </p>
      )}

      {rows && rows.length === 0 && <p className="text-subtle text-sm">Нікого не знайдено</p>}
      {rows && rows.length > 0 && (
        <ul className="border-t border-line">
          {rows.map((m) => (
            <li key={m.id} className="flex items-center justify-between space-x-3 py-3 border-b border-line">
              <div className="min-w-0">
                <p className={`flex flex-wrap items-center -m-1 ${m.disabledAt ? "text-subtle" : "text-heading"}`}>
                  <span className="m-1">{m.displayName}</span>
                  {m.disabledAt && (
                    <Badge tone="danger" className="m-1">
                      вимкнено з {ddmm(kyivToday(new Date(m.disabledAt)))}
                    </Badge>
                  )}
                </p>
                <p className="text-subtle text-xs">
                  {m.memberCode} · {m.trainer ?? "без тренера"}
                </p>
              </div>
              {m.disabledAt ? (
                <button
                  type="button"
                  onClick={() => run(() => api.enableMember(m.id))}
                  disabled={busy}
                  className="shrink-0 text-sm text-accent hover:underline disabled:opacity-60"
                >
                  Увімкнути
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setAsking(m);
                  }}
                  className="shrink-0 text-sm text-muted hover:text-danger transition-colors"
                >
                  Вимкнути
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {asking && (
        <Modal onDismiss={() => setAsking(null)} canDismiss={!busy} labelledBy="disable-member-title" variant="card">
          <h2 id="disable-member-title" className="font-geologica font-semibold text-lg text-heading mb-2 pr-8">
            Вимкнути {asking.displayName}?
          </h2>
          <p className="text-subtle text-base mb-5">
            Клієнт не зможе увійти, тренери його не бачитимуть. Записи наперед і неоплачена покупка скасуються.
            Абонемент і пакети лишаються, історія теж. Увімкнути можна будь-коли.
          </p>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => run(() => api.disableMember(asking.id))}
              disabled={busy}
              className="btn-danger flex-1 py-3 rounded-lg text-sm transition-colors disabled:opacity-60"
            >
              {busy ? "Збереження..." : "Вимкнути"}
            </button>
            <button
              type="button"
              onClick={() => setAsking(null)}
              disabled={busy}
              className="btn-ghost flex-1 py-3 rounded-lg border text-sm transition-colors"
            >
              Ні
            </button>
          </div>
        </Modal>
      )}
    </PageLayout>
  );
}
