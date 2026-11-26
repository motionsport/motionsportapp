"use client";
import { useState } from "react";
import { api, type BirthdayDiscount, type PermanentKind } from "@/lib/api";
import { errorText } from "@/lib/apiErrors";
import { Modal } from "@/components/ui/Modal";
import { birthdayLine, PERMANENT_KINDS } from "@/lib/permanentDiscount";

// «Постійна знижка» (the client's mark: ЗСУ, студент, пенсіонер, сімейна) and «Знижка іменинника» (today only, once a
// year). The trainer sets them after seeing the document; the discount then goes on a club card for a period by itself
export function PermanentDiscountBlock({
  memberId,
  kind,
  birthday,
  percent,
  headingClass,
  onChanged,
}: {
  memberId: string;
  kind: PermanentKind | null;
  birthday: BirthdayDiscount | null;
  percent: number;
  headingClass: string;
  onChanged: () => Promise<unknown> | void;
}) {
  const [saving, setSaving] = useState(false);
  const [askingBirthday, setAskingBirthday] = useState(false);
  const [error, setError] = useState("");

  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    setSaving(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(errorText(err, fallback));
    } finally {
      setAskingBirthday(false);
      setSaving(false);
      await onChanged();
    }
  };

  const chip = (value: PermanentKind | null, label: string) => {
    const on = kind === value;
    return (
      <button
        key={label}
        type="button"
        aria-pressed={on}
        disabled={saving || on}
        onClick={() => run(() => api.setPermanentDiscount(memberId, value), "Не вдалося змінити знижку")}
        className={`m-1 rounded-full border px-3 py-1.5 text-xs transition-colors ${
          on
            ? "border-discount bg-discount/10 text-discount font-semibold"
            : "border-line bg-surface text-body hover:border-subtle"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <section>
      <h3 className={headingClass}>Постійна знижка {percent}%</h3>
      <p className="text-subtle text-xs mb-2">На абонемент у зал. Ставте, коли клієнт показав документ.</p>
      <div className="flex flex-wrap -m-1">
        {chip(null, "Немає")}
        {PERMANENT_KINDS.map((k) => chip(k.kind, k.label))}
      </div>

      <h3 className={`${headingClass} mt-4`}>Знижка іменинника {percent}%</h3>
      {birthday ? (
        <>
          <p className={birthday.state === "free" ? "text-discount" : "text-heading"}>{birthdayLine(birthday)}</p>
          <p className="text-subtle text-xs mt-1">
            Наступну можна дати в {Number(birthday.givenOn.slice(0, 4)) + 1} році
          </p>
        </>
      ) : kind ? (
        // They don't stack: the mark already gives the same 10%
        <p className="text-subtle text-xs">Не потрібна: у клієнта вже є постійна знижка.</p>
      ) : (
        <button
          type="button"
          onClick={() => setAskingBirthday(true)}
          disabled={saving}
          className="px-4 py-2.5 rounded-lg border border-line text-heading text-xs font-semibold hover:border-subtle transition-colors"
        >
          🎂 Дати знижку іменинника
        </button>
      )}

      {error && (
        <p role="alert" className="text-danger text-xs mt-2">
          {error}
        </p>
      )}

      {askingBirthday && (
        <Modal onDismiss={() => setAskingBirthday(false)} canDismiss={!saving} labelledBy="birthday-discount-title">
          <h2 id="birthday-discount-title" className="font-geologica font-semibold text-lg text-heading mb-2 pr-8">
            Клієнт показав документ, сьогодні день народження?
          </h2>
          <p className="text-subtle text-base mb-5">
            Знижка {percent}% на абонемент діє лише сьогодні. Наступну можна дати через рік.
          </p>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => run(() => api.giveBirthdayDiscount(memberId), "Не вдалося дати знижку")}
              disabled={saving}
              className="btn-primary flex-1 py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {saving ? "Збереження..." : "Так, дати"}
            </button>
            <button
              type="button"
              onClick={() => setAskingBirthday(false)}
              disabled={saving}
              className="btn-ghost flex-1 py-3 rounded-lg border text-sm transition-colors"
            >
              Ні
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
