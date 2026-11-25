"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, statusOf } from "@/lib/api";
import { toAdminLogin } from "@/lib/adminAuth";

const FIELD = "input-field w-full border rounded-lg px-4 py-3 text-sm focus:outline-none";
const MIN_PASSWORD = 10;

// «Мій пароль» of a trainer or the owner; their other sessions are revoked. Who may open it is the layout's job
export function PasswordSection() {
  const router = useRouter();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setDone(false);
    if (next.length < MIN_PASSWORD) return setError(`Новий пароль: щонайменше ${MIN_PASSWORD} символів.`);
    if (next !== repeat) return setError("Паролі не збігаються.");
    setBusy(true);
    try {
      await api.changePassword(current, next);
      setCurrent("");
      setNext("");
      setRepeat("");
      setDone(true);
    } catch (err) {
      if (statusOf(err) !== 401) {
        setError("Не вдалося змінити пароль. Спробуйте ще раз.");
      } else {
        // 401 = a wrong current password, or the session ended meanwhile: ask which
        await api
          .me()
          .then(() => setError("Поточний пароль невірний."))
          .catch((e: unknown) => toAdminLogin(e, router));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h2 className="font-geologica font-semibold text-heading uppercase mb-2">Змінити пароль</h2>
      <p className="text-subtle text-sm mb-4">На інших пристроях доведеться увійти знову.</p>
      <form onSubmit={submit} className="space-y-4">
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Поточний пароль"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          className={FIELD}
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder={`Новий пароль (від ${MIN_PASSWORD} символів)`}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          className={FIELD}
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Повторіть новий пароль"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          required
          className={FIELD}
        />
        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
        {done && <p className="text-accent text-sm">Пароль змінено.</p>}
        <button
          type="submit"
          disabled={busy}
          className="btn-secondary w-full py-3 rounded-lg font-medium text-sm disabled:opacity-60"
        >
          {busy ? "Зачекайте..." : "Змінити пароль"}
        </button>
      </form>
    </section>
  );
}
