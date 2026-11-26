import { eq, inArray } from 'drizzle-orm';
import type { DatabaseService } from '../database/database.service';
import { clubCards, packages, priceItems } from '../database/schema';

type Db = DatabaseService['db'];
type Q = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

// «Спеціальна пропозиція» (agreed 2026-11-26, the gym's stories): a new client buying one personal or split training
// gets a single gym visit free. New = never had a club card or a package (reception cards too), so it works once
// with no flag: the first purchase makes the client not new. Only through the offer (`specialOffer` on
// POST /purchases), not through «З тренером». The gift card starts like any waiting card: with the first ✓ on a
// personal / split training (startWaitingCard)
export const GIFT_CARD_CODE = 'club_single';

export async function isNewClient(db: Q, memberId: string) {
  const [card] = await db.select({ id: clubCards.id }).from(clubCards).where(eq(clubCards.memberId, memberId)).limit(1);
  if (card) return false;
  const [pack] = await db.select({ id: packages.id }).from(packages).where(eq(packages.memberId, memberId)).limit(1);
  return !pack;
}

// The gift price item and the single trainer services the offer is for
export async function offerItems(db: Q) {
  const rows = await db
    .select({
      id: priceItems.id,
      code: priceItems.code,
      section: priceItems.section,
      title: priceItems.title,
      optionLabel: priceItems.optionLabel,
      trainingCount: priceItems.trainingCount,
    })
    .from(priceItems)
    .where(inArray(priceItems.section, ['club_card', 'assigned']));
  return {
    gift: rows.find((r) => r.code === GIFT_CARD_CODE) ?? null,
    services: rows.filter((r) => r.section === 'assigned' && r.trainingCount === 1),
  };
}

// For «Абонемент і пакети»: null when the member can't take the offer
export async function specialOfferFor(db: Q, memberId: string) {
  if (!(await isNewClient(db, memberId))) return null;
  const { gift, services } = await offerItems(db);
  return gift && services.length ? { serviceIds: services.map((s) => s.id) } : null;
}
