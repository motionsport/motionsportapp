import { ConflictException, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { ClockService } from '../clock/clock.service';
import { reviewDiscounts } from '../database/schema';
import { lockMember } from '../booking/group-booking';
import { requireVisibleMember } from '../schedule/default-trainer';
import { plusMonths } from '../purchases/validity';
import { apiError } from '../common/api-error';
import { loadDiscount, useDiscountAtBar } from './discount.store';
import { newDiscountCode, REVIEW_DISCOUNT_PERCENT } from './rules';

const CODE_ATTEMPTS = 5;

@Injectable()
export class ReviewDiscountsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly clock: ClockService,
  ) {}

  private today() {
    return this.clock.now().toISODate()!;
  }

  // The percent rides along: the frontend has no copy of it
  async mine(memberId: string) {
    return { percent: REVIEW_DISCOUNT_PERCENT, discount: await loadDiscount(this.database.db, memberId, this.today()) };
  }

  // «Знижка за відгук»: the trainer gives it once to a client
  async give(trainerId: string, memberId: string) {
    await requireVisibleMember(this.database.db, trainerId, memberId);
    const now = this.clock.now();
    const today = this.today();
    await this.database.db.transaction(async (tx) => {
      await lockMember(tx, memberId);
      const [existing] = await tx
        .select({ id: reviewDiscounts.id })
        .from(reviewDiscounts)
        .where(eq(reviewDiscounts.memberId, memberId))
        .limit(1);
      if (existing) throw new ConflictException(apiError('DISCOUNT_GIVEN'));
      // The UNIQUE on code is the final guard; this only avoids the rare repeat
      let code = newDiscountCode();
      for (let i = 1; i < CODE_ATTEMPTS; i++) {
        const [taken] = await tx
          .select({ id: reviewDiscounts.id })
          .from(reviewDiscounts)
          .where(eq(reviewDiscounts.code, code))
          .limit(1);
        if (!taken) break;
        code = newDiscountCode();
      }
      await tx.insert(reviewDiscounts).values({
        memberId,
        code,
        givenByAdminId: trainerId,
        givenAt: now.toJSDate(),
        validUntil: plusMonths(today, 1),
      });
    });
    return loadDiscount(this.database.db, memberId, today);
  }

  // «Використати в барі»: shown to the bar, the member marks it used
  async useAtBar(memberId: string) {
    const now = this.clock.now();
    const today = this.today();
    await this.database.db.transaction(async (tx) => {
      await lockMember(tx, memberId);
      await useDiscountAtBar(tx, memberId, today, now.toJSDate());
    });
    return loadDiscount(this.database.db, memberId, today);
  }
}
