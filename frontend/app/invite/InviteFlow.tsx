"use client";
import { useEffect, useState } from "react";
import { api, MemberInvitePreview, statusOf } from "@/lib/api";
import { PageLayout } from "@/components/ui/PageLayout";
import { WarnNote } from "@/components/ui/WarnNote";
import { QrCode } from "@/components/ui/QrCode";
import { SavedCodes } from "@/components/auth/SavedCodes";
import { PrivacyNote } from "@/components/auth/PrivacyNote";
import { InstallSteps } from "@/components/pwa/InstallSteps";
import { errorText } from "@/lib/apiErrors";
import { installEnv, type InstallEnv } from "@/lib/installEnv";
import { ddmm } from "@/lib/dates";
import { trainingsCount } from "@/lib/plural";
import { reloadTo } from "@/lib/loginRedirect";

const title = "font-geologica font-semibold text-title sm:text-display text-heading uppercase mb-2";

// The client's side of a trainer's invite: the PIN first (in the browser), the codes, then install the app and sign in
// there (an installed app on iPhone doesn't see what Safari had, so the invite can't wait until after installing)
export function InviteFlow({ token }: { token: string }) {
  const [env, setEnv] = useState<InstallEnv | null>(null);
  const [preview, setPreview] = useState<MemberInvitePreview | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<{ memberCode: string; recoveryCode: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the browser, which the server can't see
    setEnv(installEnv(navigator.userAgent, standalone, navigator.maxTouchPoints));
    if (!token) {
      setInvalid(true);
      return;
    }
    api
      .getMemberInvite(token)
      .then(setPreview)
      .catch((err) =>
        statusOf(err) === 404 ? setInvalid(true) : setError(errorText(err, "Не вдалося відкрити запрошення.")),
      );
  }, [token]);

  const link = typeof window === "undefined" ? "" : window.location.href;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(pin)) return setError("PIN має містити рівно 6 цифр.");
    if (pin !== pin2) return setError("PIN не збігається.");
    setBusy(true);
    try {
      setCodes(await api.registerByInvite(token, pin));
    } catch (err) {
      setError(errorText(err, "Не вдалося зареєструватися."));
    } finally {
      setBusy(false);
    }
  };

  if (!env || (!preview && !invalid && !error)) return <PageLayout loading />;

  if (invalid)
    return (
      <PageLayout className="text-center">
        <h1 className={title}>Запрошення недійсне</h1>
        <p className="text-body text-sm">Попросіть тренера нове.</p>
      </PageLayout>
    );

  // A computer: the link is for the phone
  if (env === "desktop")
    return (
      <PageLayout className="text-center">
        <h1 className={title}>Відкрийте на телефоні</h1>
        <p className="text-subtle text-sm mb-5">Наведіть камеру телефона на код.</p>
        <QrCode value={link} size={200} label="QR-код запрошення" />
      </PageLayout>
    );

  // A messenger's own browser can't install the app
  if (env === "inApp")
    return (
      <PageLayout>
        <h1 className={title}>Вітаємо{preview ? `, ${preview.displayName}` : ""}!</h1>
        <WarnNote title="Відкрийте це посилання в Safari (iPhone) або Chrome (Android)" className="mb-4">
          Звідси застосунок не встановити. Або натисніть ⋯ угорі і «Відкрити в браузері».
        </WarnNote>
        <button
          type="button"
          onClick={() =>
            navigator.clipboard.writeText(link).then(
              () => setCopied(true),
              () => undefined,
            )
          }
          className="btn-secondary w-full py-3 rounded-lg border text-sm transition-colors"
        >
          {copied ? "Скопійовано ✓" : "Скопіювати посилання"}
        </button>
      </PageLayout>
    );

  if (codes)
    return (
      <PageLayout>
        <h1 className={title}>Збережіть коди</h1>
        <p className="text-muted text-sm mb-6">Збережіть ці дані. Код відновлення більше не покажеться.</p>
        <SavedCodes memberCode={codes.memberCode} recoveryCode={codes.recoveryCode} />
        {env === "installed" ? (
          <button
            type="button"
            onClick={() => reloadTo("/")}
            className="btn-primary w-full py-4 rounded-lg font-medium text-sm transition-colors"
          >
            Продовжити →
          </button>
        ) : (
          <>
            <h2 className="font-geologica font-semibold text-heading uppercase mb-3">Встановіть застосунок</h2>
            <InstallSteps env={env} />
          </>
        )}
      </PageLayout>
    );

  return (
    <PageLayout>
      <h1 className={title}>Вітаємо, {preview?.displayName}!</h1>
      {/* What the trainer brought over, as cards like on «Абонемент і пакети», so the client can check it is theirs */}
      {preview && (preview.clubCard || preview.packages.length > 0) && (
        <section className="mb-6">
          <h2 className="font-geologica font-semibold text-heading uppercase text-xs tracking-wide mb-2">
            Вже чекає на вас
          </h2>
          <div className="flex flex-col space-y-2">
            {preview.clubCard && (
              <div className="rounded-xl border border-line bg-surface px-4 py-3">
                <p className="text-heading font-semibold">Абонемент · {preview.clubCard.label}</p>
                <p className="text-subtle text-xs mt-1">
                  {preview.clubCard.validUntil ? `Діє до ${ddmm(preview.clubCard.validUntil)}` : "Чекає активації"}
                </p>
              </div>
            )}
            {preview.packages.map((p, i) => (
              <div key={i} className="rounded-xl border border-line bg-surface px-4 py-3">
                <p className="text-heading font-semibold">
                  {p.trainingType === "group" ? `Групові · ${p.label}` : p.label}
                </p>
                <p className="text-subtle text-xs mt-1">
                  Залишилось {trainingsCount(p.left)}, до {ddmm(p.validUntil)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="invite-pin" className="block text-body text-sm mb-1.5">
            Придумайте PIN (6 цифр)
          </label>
          <input
            id="invite-pin"
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoComplete="new-password"
            className="input-field w-full border rounded-lg px-4 py-3 text-sm focus:outline-none"
            placeholder="••••••"
          />
        </div>
        <div>
          <label htmlFor="invite-pin2" className="block text-body text-sm mb-1.5">
            Ще раз
          </label>
          <input
            id="invite-pin2"
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin2}
            onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoComplete="new-password"
            className="input-field w-full border rounded-lg px-4 py-3 text-sm focus:outline-none"
            placeholder="••••••"
          />
        </div>
        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !preview}
          className="btn-primary w-full py-4 rounded-lg font-medium text-sm transition-colors disabled:opacity-60"
        >
          {busy ? "Зачекайте..." : "Далі"}
        </button>
        <PrivacyNote />
      </form>
    </PageLayout>
  );
}
