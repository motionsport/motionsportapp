import { ConflictException, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { ClockService } from '../clock/clock.service';
import { birthdayDiscounts, members } from '../database/schema';
import { lockMember } from '../booking/group-booking';
import { requireVisibleMember } from '../schedule/default-trainer';
import { apiError } from '../common/api-error';
import { loadBirthday, permanentKindOf } from './discount.store';
import { PERMANENT_DISCOUNT_PERCENT, type PermanentKind } from './rules';

// The trainer's side: the client's mark and «Знижка іменинника». A trainer who sees the client (own or unassigned)
@Injectable()
export class PermanentDiscountsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly clock: ClockService,
  ) {}

  private today() {
    return this.clock.now().toISODate()!;
  }

  // For the client page (GET /admin/members/:id/purchases carries the same)
  async viewFor(memberId: string) {
    return {
      percent: PERMANENT_DISCOUNT_PERCENT,
      kind: await permanentKindOf(this.database.db, memberId),
      birthday: await loadBirthday(this.database.db, memberId, this.today()),
    };
  }

  async setKind(trainerId: string, memberId: string, kind: PermanentKind | null) {
    await requireVisibleMember(this.database.db, trainerId, memberId);
    await this.database.db
      .update(members)
      .set({
        permanentDiscount: kind,
        permanentDiscountSetBy: trainerId,
        permanentDiscountSetAt: this.clock.now().toJSDate(),
      })
      .where(eq(members.id, memberId));
    return this.viewFor(memberId);
  }

  // Once a calendar year, valid today only
  async giveBirthday(trainerId: string, memberId: string) {
    await requireVisibleMember(this.database.db, trainerId, memberId);
    const today = this.today();
    await this.database.db.transaction(async (tx) => {
      await lockMember(tx, memberId);
      if (await loadBirthday(tx, memberId, today)) throw new ConflictException(apiError('BIRTHDAY_DISCOUNT_GIVEN'));
      await tx.insert(birthdayDiscounts).values({
        memberId,
        givenOn: today,
        givenByAdminId: trainerId,
        givenAt: this.clock.now().toJSDate(),
      });
    });
    return this.viewFor(memberId);
  }
}
