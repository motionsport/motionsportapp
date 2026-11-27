"use client";
import { useEffect, useState } from "react";
import type { InstallEnv } from "@/lib/installEnv";

const iconProps = {
  width: "1.15em",
  height: "1.15em",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className: "inline-block align-[-0.2em] ml-1 text-heading",
};
// The same shapes as Safari's own buttons, so the member finds them: a box with an arrow up, a box with a plus
const ShareIcon = () => (
  <svg {...iconProps}>
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
);
const AddIcon = () => (
  <svg {...iconProps} strokeWidth={1.8} className="inline-block align-[-0.2em] mx-1 text-heading">
    <rect x="3" y="3" width="18" height="18" rx="4" ry="4" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

// Chrome's install prompt event (not in the DOM types)
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// «Встановіть застосунок»: Android one button (when Chrome offers it, else the menu item), iPhone three steps
// (Apple gives no button). After installing, the member opens Motion Gym from the home screen and signs in
export function InstallSteps({ env }: { env: InstallEnv }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const steps =
    env === "ios"
      ? [
          <>
            Унизу Safari натисніть «Поділитися» <ShareIcon />
          </>,
          <>
            Виберіть <AddIcon /> «На Початковий екран»
          </>,
          "Відкрийте Motion Gym з екрана телефона",
        ]
      : [
          "Відкрийте меню ⋮ угорі Chrome",
          "Виберіть «Встановити застосунок» або «Додати на головний екран»",
          "Відкрийте Motion Gym з екрана телефона",
        ];

  return (
    <div className="flex flex-col space-y-3">
      {installed ? (
        <p className="rounded-xl border border-teal bg-teal/10 px-4 py-3 text-sm text-accent">
          Встановлено. Відкрийте Motion Gym з екрана телефона і увійдіть кодом учасника та PIN.
        </p>
      ) : env === "android" && prompt ? (
        <button
          type="button"
          onClick={async () => {
            await prompt.prompt();
            const { outcome } = await prompt.userChoice;
            if (outcome === "accepted") setInstalled(true);
            setPrompt(null);
          }}
          className="btn-primary w-full py-4 rounded-lg font-medium text-sm transition-colors"
        >
          Встановити застосунок
        </button>
      ) : (
        <ol className="flex flex-col space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start space-x-3 text-sm text-body">
              <span className="shrink-0 w-6 h-6 rounded-full bg-teal/10 text-accent text-xs flex items-center justify-center">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      )}
      {!installed && (
        <p className="text-subtle text-xs">
          Потім увійдіть у застосунку кодом учасника та PIN. Так ви отримуватимете сповіщення про запис.
        </p>
      )}
    </div>
  );
}
