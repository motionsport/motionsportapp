import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DateTime } from 'luxon';
import { KY_ZONE } from '../schedule/training-types';

const FALLBACK_TEXT = 'Записуйтесь на тренування! Чекаємо вас сьогодні.';
const GEMINI_MODEL = 'gemini-3.5-flash-lite';
// Bump when the instructions change (ai_generations.prompt_version)
export const PROMPT_VERSION = 'v4';
// Gemini usually answers in about a second; the booking-open push waits for it, so not longer than this
const GEMINI_TIMEOUT_MS = 10_000;

// The gym's weekly programme by weekday (1 = понеділок). Picked in code, not by the model: a day outside it
// (вт, чт) once got «завтра пʼятниця, ручки». Change it here and bump PROMPT_VERSION
export const WEEKLY_TOPICS: Record<number, string> = {
  1: 'ноги',
  3: 'кругове тренування',
  5: 'руки',
};

// The trainer's topic for the day, else the programme's; none = the fallback text, no AI
export function dayTopic(topic: string | null | undefined, localDate?: string): string | null {
  if (topic?.trim()) return topic.trim();
  if (!localDate) return null;
  return WEEKLY_TOPICS[DateTime.fromISO(localDate, { zone: KY_ZONE }).weekday] ?? null;
}

const SYSTEM_INSTRUCTION = `Ти тренер жіночого фітнес-залу. Пишеш короткі мотиваційні оголошення українською мовою, щоб запросити записатися на групове тренування.

Вимоги до оголошення:
- 1-2 речення, максимум 150 символів
- тренування сьогодні: не згадуй інші дні (завтра, вчора, інші дні тижня)
- згадай тему тренування з запиту
- дружній, енергійний, мотивуючий тон
- можна 1-2 емодзі
- тільки текст оголошення, без пояснень і заголовків
- не називай зал
- без довгого тире (—), став кому або крапку`;

// The UI uses no long dash; the model sometimes writes one anyway
export function withoutLongDash(text: string) {
  return text
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/^,\s*/, '')
    .replace(/,\s*([.!?])/g, '$1');
}

export interface GenerateResult {
  text: string;
  model: string;
  source: 'ai' | 'fallback';
  latencyMs?: number;
  tokenUsage?: number;
  fallbackReason?: string;
}

@Injectable()
export class AnnouncementGeneratorService {
  private genAI: GoogleGenerativeAI | null = null;

  private ensureInit(): GoogleGenerativeAI | null {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    if (!this.genAI) this.genAI = new GoogleGenerativeAI(key);
    return this.genAI;
  }

  // The topic: the trainer's for the day, else the weekday's (dayTopic); none = the fallback text
  async generate(examples: string[], topic?: string | null, localDate?: string): Promise<GenerateResult> {
    const theme = dayTopic(topic, localDate);
    if (!theme) {
      return { text: FALLBACK_TEXT, model: GEMINI_MODEL, source: 'fallback', fallbackReason: 'no topic for this day' };
    }
    const ai = this.ensureInit();
    if (!ai) {
      return { text: FALLBACK_TEXT, model: GEMINI_MODEL, source: 'fallback', fallbackReason: 'GEMINI_API_KEY not set' };
    }

    const examplesText =
      examples.length > 0
        ? examples.map((e, i) => `${i + 1}. ${withoutLongDash(e)}`).join('\n')
        : '1. Сьогодні тренуємось! 💪 Записуйтесь, місця обмежені.';

    const day = localDate
      ? DateTime.fromISO(localDate, { zone: KY_ZONE }).setLocale('uk').toFormat('cccc, d MMMM')
      : null;

    const prompt = `Напиши одне оголошення про тренування сьогодні${day ? ` (${day})` : ''}.

Тема тренування: ${theme}

Стиль (приклади попередніх оголошень):
${examplesText}`;

    const start = Date.now();
    try {
      const geminiModel = ai.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction: SYSTEM_INSTRUCTION });
      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout after ${GEMINI_TIMEOUT_MS} ms`)), GEMINI_TIMEOUT_MS);
      });
      const result = await Promise.race([geminiModel.generateContent(prompt), timeout]).finally(() =>
        clearTimeout(timer),
      );
      const latencyMs = Date.now() - start;
      const raw = result.response.text().trim().replace(/\n+/g, ' ');
      const text = withoutLongDash(raw).substring(0, 300);
      const tokenUsage = result.response.usageMetadata?.totalTokenCount;

      if (!text) {
        return {
          text: FALLBACK_TEXT,
          model: GEMINI_MODEL,
          source: 'fallback',
          fallbackReason: 'empty response',
          latencyMs,
        };
      }
      return { text, model: GEMINI_MODEL, source: 'ai', latencyMs, tokenUsage };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const fallbackReason = err instanceof Error ? err.message.substring(0, 200) : String(err).substring(0, 200);
      return { text: FALLBACK_TEXT, model: GEMINI_MODEL, source: 'fallback', fallbackReason, latencyMs };
    }
  }
}
