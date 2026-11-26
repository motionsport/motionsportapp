import type { CatalogItem } from "@/lib/api";

// «Рекомендовано» on the club card step after a trainer service (agreed 2026-11-26, the simple rule): one training →
// «Разове відвідування» (0 months), a package → the cards lasting as long as the package (a month). Several cards can
// be marked (all the month ones): fine
export function recommendedCard(card: CatalogItem, service: CatalogItem | undefined): boolean {
  if (!service) return false;
  if (service.trainingCount === 1) return card.durationMonths === 0;
  return card.durationMonths === (service.durationMonths ?? 1);
}
