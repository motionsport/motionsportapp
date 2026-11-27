"use client";
import { useState } from "react";
import Link from "next/link";
import { reloadTo } from "@/lib/loginRedirect";
import { api } from "@/lib/api";
import { PageLayout } from "@/components/ui/PageLayout";
import { errorText } from "@/lib/apiErrors";
import { SavedCodes } from "@/components/auth/SavedCodes";
import { PrivacyNote } from "@/components/auth/PrivacyNote";

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pinError, setPinError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    memberCode: string;
    recoveryCode: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPinError("");

    if (!/^\d{6}$/.test(pin)) {
      setPinError("PIN має містити рівно 6 цифр.");
      return;
    }

    setLoading(true);
    try {
      const data = await api.register(displayName.trim(), pin);
      setResult(data);
    } catch (err: unknown) {
      setError(errorText(err, "Помилка реєстрації."));
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <PageLayout>
        <h1 className="font-geologica font-semibold text-title sm:text-display text-heading uppercase mb-2">
          Вітаємо!
        </h1>
        <p className="text-muted text-sm mb-6">Збережіть ці дані. Код відновлення більше не покажеться.</p>

        <SavedCodes memberCode={result.memberCode} recoveryCode={result.recoveryCode} />

        <button
          type="button"
          onClick={() => reloadTo("/")}
          className="btn-primary w-full py-4 rounded-lg font-medium text-sm transition-colors"
        >
          Продовжити →
        </button>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <h1 className="font-geologica font-semibold text-title sm:text-display text-heading uppercase mb-2">
        Реєстрація
      </h1>
      <p className="text-body text-sm mb-8">
        Вже є код?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Увійти
        </Link>
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-body text-sm mb-1.5">{"Ваше ім'я"}</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            autoComplete="name"
            className="input-field w-full border rounded-lg px-4 py-3 text-sm focus:outline-none"
            placeholder="Іван"
          />
        </div>

        <div>
          <label className="block text-body text-sm mb-1.5">PIN-код (6 цифр)</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
              setPinError("");
            }}
            required
            autoComplete="new-password"
            className="input-field w-full border rounded-lg px-4 py-3 text-sm focus:outline-none"
            placeholder="••••••"
          />
          {pinError && (
            <p role="alert" className="text-danger text-xs mt-1">
              {pinError}
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-4 rounded-lg font-medium text-sm transition-colors disabled:opacity-60"
        >
          {loading ? "Зачекайте..." : "Зареєструватись"}
        </button>
        <PrivacyNote />
      </form>
    </PageLayout>
  );
}
