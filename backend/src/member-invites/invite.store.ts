import { and, eq, gt, isNull } from 'drizzle-orm';
import type { DatabaseService } from '../database/database.service';
import { clubCards, memberInvites, packages, priceItems } from '../database/schema';
import { hashToken } from '../auth/token';
import { activateByFor, validUntilFor } from '../purchases/validity';
import type { PermanentKind } from '../permanent-discounts/rules';

type Db = DatabaseService['db'];
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Q = Db | Tx;

// What the trainer filled in. clubCard.validUntil null = waits for activation (first ✓ or «Активувати з сьогодні»)
export type MemberInvitePayload = {
  clubCard: { priceItemId: string; validUntil: string | null } | null;
  packages: { trainingType: string; left: number; validUntil: string }[];
  permanentDiscount: PermanentKind | null;
};

// A brought-over package's name, as the price list calls them (the frontend prefixes group ones with «Групові ·»)
const PACKAGE_LABEL: Record<string, string> = { personal: 'Персональне', split: 'Спліт', group: 'Пакет' };

export const liveInvite = (token: string, now: Date) =>
  and(
    eq(memberInvites.tokenHash, hashToken(token)),
    isNull(memberInvites.usedAt),
    isNull(memberInvites.revokedAt),
    gt(memberInvites.expiresAt, now),
  );

const cardLabel = (title: string, optionLabel: string | null) => (optionLabel ? `${title} · ${optionLabel}` : title);

// For the client's page before the PIN: their name and what is waiting
export async function invitePreview(db: Q, token: string, now: Date) {
  const [invite] = await db
    .select({ displayName: memberInvites.displayName, payload: memberInvites.payload })
    .from(memberInvites)
    .where(liveInvite(token, now))
    .limit(1);
  if (!invite) return null;
  const payload = invite.payload as MemberInvitePayload;
  let clubCard: { label: string; validUntil: string | null } | null = null;
  if (payload.clubCard) {
    const [item] = await db
      .select({ title: priceItems.title, optionLabel: priceItems.optionLabel })
      .from(priceItems)
      .where(eq(priceItems.id, payload.clubCard.priceItemId))
      .limit(1);
    if (item) clubCard = { label: cardLabel(item.title, item.optionLabel), validUntil: payload.clubCard.validUntil };
  }
  return {
    displayName: invite.displayName,
    clubCard,
    packages: payload.packages.map((p) => ({ trainingType: p.trainingType, left: p.left, validUntil: p.validUntil })),
  };
}

// Inside the sign-up transaction: the club card and packages the client already paid for. Not purchases, so no money
// in stats: the card like a reception one (paid_uah null), packages with no purchase line
export async function grantInvite(
  tx: Tx,
  memberId: string,
  trainerId: string,
  payload: MemberInvitePayload,
  today: string,
) {
  if (payload.clubCard) {
    const [item] = await tx
      .select({
        title: priceItems.title,
        optionLabel: priceItems.optionLabel,
        durationMonths: priceItems.durationMonths,
      })
      .from(priceItems)
      .where(eq(priceItems.id, payload.clubCard.priceItemId))
      .limit(1);
    if (item) {
      const until = payload.clubCard.validUntil;
      await tx.insert(clubCards).values({
        memberId,
        purchaseItemId: null,
        label: cardLabel(item.title, item.optionLabel),
        // With a date: running from today to it; without: waiting
        validFrom: until ? today : null,
        validUntil: until,
        durationMonths: item.durationMonths ?? 0,
        activateBy: activateByFor(today),
        addedBy: trainerId,
        paidUah: null,
      });
    }
  }
  for (const p of payload.packages) {
    await tx.insert(packages).values({
      memberId,
      purchaseItemId: null,
      label: PACKAGE_LABEL[p.trainingType] ?? p.trainingType,
      addedBy: trainerId,
      trainingType: p.trainingType,
      total: p.left,
      durationMonths: 1,
      purchasedOn: today,
      activateBy: activateByFor(today),
      // Already running: from today to the date the trainer gave
      activatedOn: today,
      validUntil: p.validUntil < today ? validUntilFor(today, 0) : p.validUntil,
    });
  }
}
