"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, MemberInviteLink, PermanentKind, PriceListItem, TrainingType } from "@/lib/api";
import { PageLayout } from "@/components/ui/PageLayout";
import { AdminMenu } from "@/components/admin/AdminMenu";
import { InviteQr } from "@/components/admin/InviteQr";
import { errorText } from "@/lib/apiErrors";
import { kyivToday } from "@/lib/dates";
import { lineName } from "@/lib/prices";
import { TYPE_LABEL_PLURAL } from "@/lib/trainingTypes";
import { PERMANENT_KINDS } from "@/lib/permanentDiscount";

type PackageRow = { priceItemId: string; left: string; validUntil: string };

const label = "block text-body text-sm mb-1.5";
const field = "input-field w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none";
const section = "font-geologica font-semibold text-heading uppercase text-xs tracking-wide mt-6 mb-2";

// «Запросити нового клієнта»: what a client who already paid before the app has; the link brings it over (no money in
// the stats). Then the QR for the client to scan in the gym
export default function InviteClientPage() {
  const [cards, setCards] = useState<PriceListItem[]>([]);
  // Trainer services and group passes, as the price list sells them
  const [packs, setPacks] = useState<PriceListItem[]>([]);
  const [name, setName] = useState("");
  const [cardId, setCardId] = useState("");
  const [cardUntil, setCardUntil] = useState("");
  const [cardWaiting, setCardWaiting] = useState(false);
  const [rows, setRows] = useState<PackageRow[]>([]);
  const [discount, setDiscount] = useState<PermanentKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<MemberInviteLink | null>(null);
  const today = kyivToday();

  useEffect(() => {
    api
      .getPriceList()
      .then((items) => {
        setCards(items.filter((i) => i.section === "club_card"));
        setPacks(items.filter((i) => i.section !== "club_card" && (i.trainingCount ?? 0) > 0));
      })
      .catch(() => setError("Не вдалося завантажити абонементи"));
  }, []);

  const setRow = (i: number, patch: Partial<PackageRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) return setError("Вкажіть ім'я клієнта.");
    if (cardId && !cardWaiting && !cardUntil) return setError("Вкажіть, до якої дати діє абонемент.");
    const sizeOf = (id: string) => packs.find((p) => p.id === id)?.trainingCount ?? 0;
    if (
      rows.some(
        (r) => !r.priceItemId || !r.validUntil || !(Number(r.left) >= 1 && Number(r.left) <= sizeOf(r.priceItemId)),
      )
    )
      return setError("У пакеті виберіть пакет, скільки лишилось (не більше, ніж у пакеті) і до якої дати.");
    setBusy(true);
    try {
      setCreated(
        await api.createMemberInvite({
          displayName: name.trim(),
          clubCard: cardId ? { priceItemId: cardId, validUntil: cardWaiting ? null : cardUntil } : null,
          packages: rows.map((r) => ({ priceItemId: r.priceItemId, left: Number(r.left), validUntil: r.validUntil })),
          permanentDiscount: discount,
        }),
      );
    } catch (err) {
      setError(errorText(err, "Не вдалося створити запрошення"));
    } finally {
      setBusy(false);
    }
  };

  if (created)
    return (
      <PageLayout variant="top" action={<AdminMenu />}>
        <h1 className="font-geologica font-semibold text-title text-heading uppercase mb-4">
          Запрошення для {created.displayName}
        </h1>
        <InviteQr invite={created} />
        <Link
          href="/admin/clients"
          className="btn-ghost block w-full py-3 rounded-lg border text-sm text-center transition-colors mt-6"
        >
          Готово
        </Link>
      </PageLayout>
    );

  return (
    <PageLayout variant="top" action={<AdminMenu />}>
      <Link href="/admin/clients" className="text-subtle text-sm hover:text-body transition-colors">
        ← Назад
      </Link>
      <h1 className="font-geologica font-semibold text-title text-heading uppercase mt-3 mb-1">Новий клієнт</h1>
      <p className="text-subtle text-xs mb-2">Що в клієнта вже оплачено до застосунку. У статистику це не йде.</p>

      <form onSubmit={submit}>
        <label htmlFor="invite-name" className={`${label} mt-4`}>
          {"Ім'я"}
        </label>
        <input
          id="invite-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          className={field}
          placeholder="Оля"
        />

        <h2 className={section}>Абонемент (клубна карта)</h2>
        <select aria-label="Абонемент" value={cardId} onChange={(e) => setCardId(e.target.value)} className={field}>
          <option value="">Немає</option>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {lineName(c)}
            </option>
          ))}
        </select>
        {cardId && (
          <div className="flex items-center space-x-3 mt-2">
            <label className="flex-1 text-subtle text-xs">
              Діє до
              <input
                type="date"
                value={cardUntil}
                min={today}
                disabled={cardWaiting}
                onChange={(e) => setCardUntil(e.target.value)}
                className={`${field} mt-1 disabled:opacity-40`}
              />
            </label>
            <label className="flex items-center space-x-2 text-sm text-body pt-4">
              <input type="checkbox" checked={cardWaiting} onChange={(e) => setCardWaiting(e.target.checked)} />
              <span>чекає активації</span>
            </label>
          </div>
        )}

        <h2 className={section}>Пакети</h2>
        <div className="flex flex-col space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-3 flex flex-col space-y-2">
              {/* The package on its own line; under it «Лишилось» and «Діє до» side by side, same height */}
              <label className="text-subtle text-xs">
                Пакет
                <select
                  value={r.priceItemId}
                  onChange={(e) => setRow(i, { priceItemId: e.target.value })}
                  className={`${field} mt-1`}
                >
                  <option value="">Виберіть пакет</option>
                  {(["personal", "split", "group"] as TrainingType[]).map((t) => (
                    <optgroup key={t} label={TYPE_LABEL_PLURAL[t]}>
                      {packs
                        .filter((p) => p.trainingType === t)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {/* «Пакет · 10 занять» reads oddly under the field's own «Пакет» label */}
                            {t === "group" ? `Групові · ${p.optionLabel ?? p.title}` : lineName(p)}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <div className="flex space-x-2">
                <label className="w-28 shrink-0 text-subtle text-xs">
                  Лишилось
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={packs.find((p) => p.id === r.priceItemId)?.trainingCount ?? 30}
                    value={r.left}
                    onChange={(e) => setRow(i, { left: e.target.value })}
                    className={`${field} mt-1`}
                  />
                </label>
                <label className="flex-1 min-w-0 text-subtle text-xs">
                  Діє до
                  <input
                    type="date"
                    value={r.validUntil}
                    min={today}
                    onChange={(e) => setRow(i, { validUntil: e.target.value })}
                    className={`${field} mt-1`}
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                className="self-start text-muted text-xs hover:text-danger transition-colors"
              >
                Прибрати
              </button>
            </div>
          ))}
        </div>
        {rows.length < 5 && (
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, { priceItemId: "", left: "", validUntil: "" }])}
            className="text-accent text-sm hover:underline mt-2"
          >
            + Додати пакет
          </button>
        )}

        <h2 className={section}>Постійна знижка 10%</h2>
        <div className="flex flex-wrap -m-1">
          {[{ kind: null as PermanentKind | null, label: "Немає" }, ...PERMANENT_KINDS].map((k) => (
            <button
              key={k.label}
              type="button"
              aria-pressed={discount === k.kind}
              onClick={() => setDiscount(k.kind)}
              className={`m-1 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                discount === k.kind
                  ? "border-discount bg-discount/10 text-discount font-semibold"
                  : "border-line bg-surface text-body hover:border-subtle"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="text-danger text-sm mt-4">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="btn-primary w-full py-4 rounded-lg font-medium text-sm transition-colors disabled:opacity-60 mt-6"
        >
          {busy ? "Створення..." : "Створити запрошення"}
        </button>
      </form>
    </PageLayout>
  );
}
