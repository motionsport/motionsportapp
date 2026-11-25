import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { announcementExamples, announcements, aiGenerations } from '../database/schema';
import { AnnouncementGeneratorService, PROMPT_VERSION } from './announcement-generator.service';
import { trainingDayOn } from '../schedule/training-day.store';
import { trainerTopicOn } from '../trainer-schedule/trainer-schedule.store';

// The cron makes the announcement only when it has no text yet. Anything the trainer did (generated, wrote,
// took it down) is left alone: what members see is the trainer's call, and the cron runs every 15 minutes
export function needsAutoAnnouncement(ann: { text: string | null } | null | undefined): boolean {
  return !!ann && !ann.text;
}

// Each trainer's own announcement of the day and own style examples; members see their trainer's
@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly generator: AnnouncementGeneratorService,
  ) {}

  listExamples(trainerId: string) {
    return this.database.db
      .select()
      .from(announcementExamples)
      .where(eq(announcementExamples.trainerId, trainerId))
      .orderBy(announcementExamples.createdAt);
  }

  async addExample(trainerId: string, text: string) {
    const [row] = await this.database.db.insert(announcementExamples).values({ trainerId, text }).returning();
    return row;
  }

  // Only the trainer's own: another trainer's id deletes nothing
  async deleteExample(trainerId: string, id: string) {
    await this.database.db
      .delete(announcementExamples)
      .where(and(eq(announcementExamples.id, id), eq(announcementExamples.trainerId, trainerId)));
    return { ok: true };
  }

  async getOrCreateForDate(localDate: string, trainerId: string) {
    const day = await trainingDayOn(this.database.db, localDate);
    if (!day) return null;

    const mine = and(eq(announcements.trainingDayId, day.id), eq(announcements.trainerId, trainerId));
    const [existing] = await this.database.db.select().from(announcements).where(mine).limit(1);
    if (existing) return existing;

    // Two requests at once (the page and the cron): the second finds the first's row
    await this.database.db
      .insert(announcements)
      .values({ trainingDayId: day.id, trainerId })
      .onConflictDoNothing({ target: [announcements.trainingDayId, announcements.trainerId] });
    const [created] = await this.database.db.select().from(announcements).where(mine).limit(1);
    return created;
  }

  async generateAndSave(localDate: string, trainerId: string) {
    return this.generateInto(localDate, trainerId, { publish: false });
  }

  async updateText(localDate: string, trainerId: string, text: string) {
    return this.setOn(localDate, trainerId, { text, source: 'manual', publishedAt: null });
  }

  async publish(localDate: string, trainerId: string) {
    return this.setOn(localDate, trainerId, { publishedAt: new Date() });
  }

  async unpublish(localDate: string, trainerId: string) {
    return this.setOn(localDate, trainerId, { publishedAt: null });
  }

  // The booking-open cron, from 15 minutes before this trainer's opening: once (needsAutoAnnouncement)
  async autoGenerate(localDate: string, trainerId: string): Promise<void> {
    const ann = await this.getOrCreateForDate(localDate, trainerId);
    if (!needsAutoAnnouncement(ann)) return;
    await this.generateInto(localDate, trainerId, { publish: true });
  }

  private async setOn(localDate: string, trainerId: string, set: Partial<typeof announcements.$inferInsert>) {
    const ann = await this.getOrCreateForDate(localDate, trainerId);
    if (!ann) return null;
    const [updated] = await this.database.db
      .update(announcements)
      .set({ ...set, updatedAt: new Date() })
      .where(eq(announcements.id, ann.id))
      .returning();
    return updated;
  }

  // The trainer's topic for that weekday and their examples; every attempt is logged in ai_generations
  private async generateInto(localDate: string, trainerId: string, { publish }: { publish: boolean }) {
    const ann = await this.getOrCreateForDate(localDate, trainerId);
    if (!ann) return null;

    const [exampleRows, topic] = await Promise.all([
      this.listExamples(trainerId),
      trainerTopicOn(this.database.db, trainerId, localDate),
    ]);
    const result = await this.generator.generate(
      exampleRows.map((e) => e.text),
      topic,
      localDate,
    );

    const now = new Date();
    const [updated] = await this.database.db
      .update(announcements)
      .set({ text: result.text, source: result.source, publishedAt: publish ? now : null, updatedAt: now })
      .where(eq(announcements.id, ann.id))
      .returning();

    await this.database.db.insert(aiGenerations).values({
      announcementId: ann.id,
      provider: 'google',
      model: result.model,
      promptVersion: PROMPT_VERSION,
      latencyMs: result.latencyMs ?? null,
      tokenUsage: result.tokenUsage ?? null,
      status: result.source === 'ai' ? 'success' : 'fallback',
      fallbackReason: result.fallbackReason ?? null,
    });

    return updated;
  }
}
