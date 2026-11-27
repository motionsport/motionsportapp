"use client";
import { useEffect, useState } from "react";
import { ensurePushSubscribed, PUSH_CHANGE, pushPermission, type PushPermission } from "@/lib/pushUtils";

// At the bottom of the home page, always: whether this phone gets pushes («Запис відкрито» comes by itself). Not asked
// yet: «Увімкнути», and the phone asks after the tap (iPhone requires it). Said no: it can't be asked again, so where to
// turn them on. No push at all (Safari on iPhone outside the installed app): nothing
export function PushStatus() {
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const read = () => setPermission(pushPermission());
    read();
    window.addEventListener(PUSH_CHANGE, read);
    return () => window.removeEventListener(PUSH_CHANGE, read);
  }, []);

  if (!permission || permission === "unsupported") return null;

  if (permission === "granted")
    return <p className="text-subtle text-xs text-center mt-8">🔔 Сповіщення на телефоні увімкнено</p>;

  if (permission === "denied")
    return (
      <p className="text-subtle text-xs text-center mt-8">
        🔕 Сповіщення вимкнені · увімкнути можна в налаштуваннях телефона
      </p>
    );

  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3 mt-8">
      <p className="text-heading text-sm font-semibold">🔔 Увімкніть сповіщення</p>
      <p className="text-subtle text-xs mt-1">Дізнаєтесь першими, коли відкриється запис.</p>
      <button
        type="button"
        onClick={async () => {
          setBusy(true);
          await ensurePushSubscribed();
          setBusy(false);
        }}
        disabled={busy}
        className="btn-primary w-full py-3 rounded-lg text-sm transition-colors disabled:opacity-60 mt-3"
      >
        {busy ? "Зачекайте..." : "Увімкнути"}
      </button>
    </div>
  );
}
