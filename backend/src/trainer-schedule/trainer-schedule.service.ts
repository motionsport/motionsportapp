import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { ScheduleService } from '../schedule/schedule.service';
import { trainerSchedules, trainerScheduleTimes, trainerScheduleTopics } from '../database/schema';
import { scheduleError, type TrainerSchedule } from './rules';
import { ruleError } from '../common/api-error';
import { loadTrainerSchedule } from './trainer-schedule.store';

@Injectable()
export class TrainerScheduleService {
  private readonly logger = new Logger(TrainerScheduleService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly schedule: ScheduleService,
  ) {}

  get(trainerId: string) {
    return loadTrainerSchedule(this.database.db, trainerId);
  }

  // Replaces the week's times and topics as a whole; an empty topic = none for that weekday
  async save(trainerId: string, input: TrainerSchedule) {
    const schedule = {
      ...input,
      topics: input.topics.map((t) => ({ ...t, topic: t.topic.trim() })).filter((t) => t.topic),
    };
    const error = scheduleError(schedule);
    if (error) throw new BadRequestException(ruleError(error));

    await this.database.db.transaction(async (tx) => {
      const settings = {
        bookingOpensAt: schedule.bookingOpensAt,
        autoCreate: schedule.autoCreate,
        updatedAt: new Date(),
      };
      await tx
        .insert(trainerSchedules)
        .values({ trainerId, ...settings })
        .onConflictDoUpdate({ target: trainerSchedules.trainerId, set: settings });
      await tx.delete(trainerScheduleTimes).where(eq(trainerScheduleTimes.trainerId, trainerId));
      if (schedule.times.length > 0) {
        await tx
          .insert(trainerScheduleTimes)
          .values(schedule.times.map((t) => ({ trainerId, weekday: t.weekday, slotTime: t.slotTime })));
      }
      await tx.delete(trainerScheduleTopics).where(eq(trainerScheduleTopics.trainerId, trainerId));
      if (schedule.topics.length > 0) {
        await tx
          .insert(trainerScheduleTopics)
          .values(schedule.topics.map((t) => ({ trainerId, weekday: t.weekday, topic: t.topic })));
      }
    });
    const saved = await loadTrainerSchedule(this.database.db, trainerId);
    // The schedule is already committed: if adding slots fails, the next schedule load adds them
    try {
      return { ...saved, ...(await this.schedule.ensureGroupSlots(trainerId, { force: true })) };
    } catch (err) {
      this.logger.warn(`Group trainings for trainer ${trainerId} not added after saving: ${String(err)}`);
      return saved;
    }
  }
}
