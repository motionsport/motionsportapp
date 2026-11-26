import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { ClockService } from '../clock/clock.service';
import { priceItems, priceChanges, admins, owners } from '../database/schema';
import type { UpdatePriceDto } from './dto/update-price.dto';

const CHANGES_LIMIT = 30;

// Who changed it: the owner's name, or a trainer's username for changes made before 2026-11-23
const priceAuthor = sql<string | null>`coalesce(${owners.name}, ${admins.username})`;
const changeAuthor = sql<string>`coalesce(${owners.name}, ${admins.username})`;

@Injectable()
export class PricesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly clock: ClockService,
  ) {}

  async getPrices() {
    const items = await this.database.db
      .select({
        id: priceItems.id,
        section: priceItems.section,
        title: priceItems.title,
        optionLabel: priceItems.optionLabel,
        amountUah: priceItems.amountUah,
        updatedBy: priceAuthor,
        updatedAt: priceItems.updatedAt,
      })
      .from(priceItems)
      .leftJoin(admins, eq(admins.id, priceItems.updatedBy))
      .leftJoin(owners, eq(owners.id, priceItems.updatedByOwnerId))
      .orderBy(asc(priceItems.sortOrder));

    const changes = await this.database.db
      .select({
        id: priceChanges.id,
        title: priceItems.title,
        optionLabel: priceItems.optionLabel,
        oldAmountUah: priceChanges.oldAmountUah,
        newAmountUah: priceChanges.newAmountUah,
        changedBy: changeAuthor,
        changedAt: priceChanges.changedAt,
      })
      .from(priceChanges)
      .innerJoin(priceItems, eq(priceItems.id, priceChanges.priceItemId))
      // Either author: trainers' old changes and the owner's new ones both stay in the history
      .leftJoin(admins, eq(admins.id, priceChanges.changedBy))
      .leftJoin(owners, eq(owners.id, priceChanges.changedByOwnerId))
      .orderBy(desc(priceChanges.changedAt))
      .limit(CHANGES_LIMIT);

    return {
      // Seeded values have no author, so no updatedAt
      items: items.map((i) => ({ ...i, updatedAt: i.updatedBy ? i.updatedAt.toISOString() : null })),
      changes: changes.map((c) => ({ ...c, changedAt: c.changedAt.toISOString() })),
    };
  }

  // Member and trainer view: no author names
  async getMemberPrices() {
    return this.database.db
      .select({
        id: priceItems.id,
        section: priceItems.section,
        title: priceItems.title,
        optionLabel: priceItems.optionLabel,
        amountUah: priceItems.amountUah,
        // A club card's months (0 = «Разове відвідування»): the trainer's reception preview of the permanent discount
        durationMonths: priceItems.durationMonths,
      })
      .from(priceItems)
      .orderBy(asc(priceItems.sortOrder));
  }

  // Compare-and-set on the amount the owner saw: concurrent edits can't silently overwrite each other
  async updatePrice(ownerId: string, id: string, dto: UpdatePriceDto) {
    if (dto.amountUah === dto.expectedAmountUah) {
      const current = await this.current(id);
      if (current.amountUah !== dto.expectedAmountUah) throw this.changedMeanwhile(current);
      return { id, amountUah: current.amountUah };
    }

    const now = this.clock.now().toJSDate();
    return this.database.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(priceItems)
        .set({ amountUah: dto.amountUah, updatedBy: null, updatedByOwnerId: ownerId, updatedAt: now })
        .where(and(eq(priceItems.id, id), eq(priceItems.amountUah, dto.expectedAmountUah)))
        .returning({ id: priceItems.id, amountUah: priceItems.amountUah });
      if (!updated) throw this.changedMeanwhile(await this.current(id));

      await tx.insert(priceChanges).values({
        priceItemId: id,
        oldAmountUah: dto.expectedAmountUah,
        newAmountUah: dto.amountUah,
        changedByOwnerId: ownerId,
        changedAt: now,
      });
      return updated;
    });
  }

  private async current(id: string) {
    const [item] = await this.database.db
      .select({ amountUah: priceItems.amountUah, updatedBy: priceAuthor })
      .from(priceItems)
      .leftJoin(admins, eq(admins.id, priceItems.updatedBy))
      .leftJoin(owners, eq(owners.id, priceItems.updatedByOwnerId))
      .where(eq(priceItems.id, id))
      .limit(1);
    if (!item) throw new NotFoundException('Price not found');
    return item;
  }

  private changedMeanwhile(current: { amountUah: number; updatedBy: string | null }) {
    return new ConflictException({
      statusCode: 409,
      message: 'Price was changed by another owner',
      amountUah: current.amountUah,
      updatedBy: current.updatedBy,
    });
  }
}
