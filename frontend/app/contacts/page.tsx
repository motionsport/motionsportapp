import Image from "next/image";
import Link from "next/link";
import { PageLayout } from "@/components/ui/PageLayout";
import gymMap from "./gym-map.jpg";

// The gym's opening hours and where it is, the same for everyone: nothing to load. Members only, like «Ціни» (proxy.ts)
const HOURS = [
  { label: "Будні", days: "Пн – Пт", from: "07:00", to: "21:00" },
  { label: "Вихідні", days: "Сб – Нд", from: "10:00", to: "16:00" },
];

// A screenshot of Google Maps, not an embedded map: an embed needs a Google Cloud project with billing and a key.
// A tap opens the gym's own card in Google Maps (its «Поділитися» link; on a phone the maps app, with a route)
const MAPS_URL = "https://maps.app.goo.gl/UqHfyjoJ7aZR1YN27";

export default function HoursPage() {
  const back = (
    <Link href="/purchases" className="text-muted text-sm hover:text-body transition-colors">
      ← Абонемент і пакети
    </Link>
  );

  return (
    <PageLayout variant="top" action={back}>
      <h1 className="font-geologica font-semibold text-title sm:text-display text-heading uppercase mb-6">
        Графік і адреса
      </h1>
      <div className="grid grid-cols-2 -m-1.5">
        {HOURS.map((h) => (
          <div key={h.label} className="m-1.5 rounded-xl border border-line bg-surface p-4">
            <div className="text-subtle text-xs font-semibold uppercase tracking-wide">{h.label}</div>
            <div className="text-heading font-medium mt-1">{h.days}</div>
            <div className="font-geologica text-heading text-2xl leading-tight tabular-nums mt-3">
              {h.from}
              <span className="block text-subtle text-xs font-sans">до</span>
              {h.to}
            </div>
          </div>
        ))}
      </div>

      <a
        href={MAPS_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Відкрити Motion Gym у Google Maps"
        className="block mt-6 rounded-xl border border-line overflow-hidden hover:border-teal transition-colors"
      >
        <Image src={gymMap} alt="Мапа: Motion Gym біля Центрального парку в Ірпені" placeholder="blur" sizes="36rem" />
      </a>
      <p className="text-heading font-medium mt-3">Ірпінь, вулиця Лісова, 4т</p>
      <p className="text-subtle text-xs mt-1">
        Район Центрального парку, поруч є паркування. Натисніть на мапу, щоб прокласти маршрут.
      </p>
    </PageLayout>
  );
}
