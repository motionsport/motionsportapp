import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { DatabaseService } from '../database/database.service';
import { clubCards, packages, priceItems, purchaseItems } from '../database/schema';

type Db = DatabaseService['db'];
type Q = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

// «Спеціальна пропозиція» (agreed 2026-11-26, the gym's stories): a new client buying one personal or split training
// gets a single gym visit free. New = never had a club card or a package (reception cards too), so it works once
// with no flag: the first purchase makes the client not new. Only through the offer (`specialOffer` on
// POST /purchases), not through «З тренером». The gift card starts with that training's first mark (syncSpend)
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

const giftCardOf = (tx: Q, purchaseId: string) =>
  inArray(
    clubCards.purchaseItemId,
    tx
      .select({ id: purchaseItems.id })
      .from(purchaseItems)
      .where(and(eq(purchaseItems.purchaseId, purchaseId), eq(purchaseItems.gift, true))),
  );

// The gift card of this purchase lives the day its training is first marked (syncSpend activates the package).
// A card the trainer already activated by hand is left alone
export async function startGiftCard(tx: Q, purchaseId: string, date: string) {
  await tx
    .update(clubCards)
    .set({
      validFrom: date,
      // Matches validity.ts and activateCard
      validUntil: sql`(${date}::date + make_interval(months => ${clubCards.durationMonths}))::date`,
    })
    .where(and(giftCardOf(tx, purchaseId), isNull(clubCards.validFrom)));
}

// «Не списувати» put the package back to waiting: the gift card started that day waits with it
export async function unstartGiftCard(tx: Q, purchaseId: string, date: string) {
  await tx
    .update(clubCards)
    .set({ validFrom: null, validUntil: null })
    .where(and(giftCardOf(tx, purchaseId), eq(clubCards.validFrom, date)));
}
