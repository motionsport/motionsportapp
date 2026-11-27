"use client";
import { useState } from "react";
import { api, type OwnerRefund } from "@/lib/api";
import { PageLayout } from "@/components/ui/PageLayout";
import { OwnerMenu } from "@/components/owner/OwnerMenu";
import { errorText } from "@/lib/apiErrors";
import { useAdminData } from "@/lib/useAdminData";
import { formatUah } from "@/lib/prices";
import { ddmm } from "@/lib/dates";
import { TYPE_LABEL } from "@/lib/trainingTypes";

// The owner's «Повернення»: half of a single personal / split training after a late cancellation (2 to 12 hours
// before it), every trainer's. Always cash, only the owner: hand it to the client, then «Віддано». A trainer's
// «Не списувати» takes it off the list (the training goes back to the client instead)
export default function OwnerRefundsPage() {
  const { data, error, reload } = useAdminData(api.getOwnerRefunds);
  const [asking, setAsking] = useState<OwnerRefund | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const give = async (r: OwnerRefund) => {
    setBusy(true);
    setActionError("");
    try {
      await api.giveOwnerRefund(r.id);
    } catch (err) {
      setActionError(
        errorText(err, "Не вдалося зберегти. Оновіть сторінку.", {
          MONEY_RETURNED: "Це повернення вже позначено як віддане.",
        }),
      );
    } finally {
      setBusy(false);
      setAsking(null);
      await reload();
    }
  };

  return (
    <PageLayout variant="top" loading={!data && error == null} action={<OwnerMenu />}>
      <h1 className="font-geologica font-semibold text-title sm:text-display text-heading uppercase mb-2">
        Повернення
      </h1>
      <p className="text-subtle text-xs mb-6">
        Половина вартості разового персонального чи спліту, коли клієнт скасував пізно (від 2 до 12 годин до початку).
        Повертаєте готівкою, потім натисніть «Віддано». Тренер може натиснути «Не списувати»: тоді тренування
        повертається клієнту, а повернення зникає звідси.
      </p>

      {error != null && !data && (
        <p role="alert" className="text-danger text-sm">
          Не вдалося завантажити. Оновіть сторінку.
        </p>
      )}
      {actionError && (
        <p role="alert" className="text-danger text-sm mb-4">
          {actionError}
        </p>
      )}

      {data && data.length === 0 && <p className="text-muted text-sm">Повертати нічого не треба.</p>}

      <div className="flex flex-col space-y-3">
        {data?.map((r) => (
          <div key={r.id} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between space-x-3">
              <span className="text-heading font-semibold">{r.displayName}</span>
              <span className="font-geologica text-heading tabular-nums text-sm">{formatUah(r.amountUah)}</span>
            </div>
            <p className="text-subtle text-xs mt-1">
              {TYPE_LABEL[r.trainingType]} {ddmm(r.localDate)} о {r.slotTime} · тренер {r.trainer}
            </p>
            {asking?.id === r.id ? (
              <div className="mt-3">
                <p className="text-body text-sm mb-3">Віддали клієнту {formatUah(r.amountUah)} готівкою?</p>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => give(r)}
                    disabled={busy}
                    className="btn-primary flex-1 py-3 rounded-lg text-sm transition-colors disabled:opacity-60"
                  >
                    {busy ? "Збереження..." : "Так, віддано"}
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
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAsking(r)}
                disabled={busy}
                className="btn-primary w-full py-3 rounded-lg text-sm transition-colors disabled:opacity-60 mt-3"
              >
                Віддано {formatUah(r.amountUah)}
              </button>
            )}
          </div>
        ))}
      </div>
    </PageLayout>
  );
}
