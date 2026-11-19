import type { EndingPackage } from "@/lib/api";
import { ddmm } from "@/lib/dates";
import { TYPE_LABEL_PLURAL } from "@/lib/trainingTypes";

// «Пакет скоро закінчиться»: packages with trainings left and 10 days or fewer to go (the backend picks them).
// Warn colors, so it doesn't merge with the lime «Сьогодні тренування»
export default function EndingPackagesBanner({ packages }: { packages: EndingPackage[] }) {
  if (packages.length === 0) return null;
  return (
    <div className="rounded-xl border border-warn-line bg-linear-to-br from-warn/15 via-surface via-60% to-surface p-4 mb-5">
      <p className="font-geologica font-semibold text-sm text-heading uppercase">Пакет скоро закінчиться</p>
      <p className="text-base text-body mt-1">Тренування, які не встигнете, згорять</p>
      <ul className="mt-3 space-y-2">
        {packages.map((p) => (
          <li key={`${p.trainingType}-${p.validUntil}`} className="text-base text-subtle">
            {TYPE_LABEL_PLURAL[p.trainingType]}: <span className="text-warn font-semibold">ще {p.left}</span>, до{" "}
            {ddmm(p.validUntil)}
            {/* Personal and split are scheduled by the trainer */}
            {p.trainingType !== "group" && " · домовтеся з тренером"}
          </li>
        ))}
      </ul>
    </div>
  );
}
