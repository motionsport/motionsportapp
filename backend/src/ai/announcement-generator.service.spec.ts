import { AnnouncementGeneratorService, dayTopic, withoutLongDash } from './announcement-generator.service';

const MONDAY = '2026-10-26';
const THURSDAY = '2026-10-29';

const GYM_NAMES = ['MotionSport', 'Motion Gym', 'MotionGym', 'мотіонспорт', 'моушн джим'];

let capturedPrompt = '';
let capturedSystem = '';

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockImplementation((opts: { systemInstruction?: string }) => {
      capturedSystem = opts.systemInstruction ?? '';
      return {
        generateContent: jest.fn().mockImplementation((prompt: string) => {
          capturedPrompt = prompt;
          return Promise.resolve({
            response: {
              text: () => 'Записуйтесь на тренування сьогодні! 💪',
              usageMetadata: { totalTokenCount: 20 },
            },
          });
        }),
      };
    }),
  })),
}));

describe('AnnouncementGeneratorService', () => {
  let service: AnnouncementGeneratorService;

  beforeEach(() => {
    capturedPrompt = '';
    capturedSystem = '';
    service = new AnnouncementGeneratorService();
  });

  describe('when GEMINI_API_KEY is not set', () => {
    beforeEach(() => {
      delete process.env.GEMINI_API_KEY;
    });

    it('returns fallback text', async () => {
      const result = await service.generate([]);
      expect(result.source).toBe('fallback');
      expect(result.text).toBeTruthy();
    });

    it('does not call Gemini API', async () => {
      const { GoogleGenerativeAI } = jest.requireMock('@google/generative-ai');
      GoogleGenerativeAI.mockClear();
      await service.generate([]);
      expect(GoogleGenerativeAI).not.toHaveBeenCalled();
    });
  });

  describe('when GEMINI_API_KEY is set', () => {
    beforeEach(() => {
      process.env.GEMINI_API_KEY = 'test-key';
    });
    afterEach(() => {
      delete process.env.GEMINI_API_KEY;
    });

    it('returns AI-generated text', async () => {
      const result = await service.generate(['Приклад 1'], null, MONDAY);
      expect(result.source).toBe('ai');
      expect(result.text).toBe('Записуйтесь на тренування сьогодні! 💪');
    });

    it('prompt and system instruction do not mention the gym name', async () => {
      await service.generate(['Приклад оголошення'], null, MONDAY);
      for (const name of GYM_NAMES) {
        expect(capturedPrompt.toLowerCase()).not.toContain(name.toLowerCase());
        expect(capturedSystem.toLowerCase()).not.toContain(name.toLowerCase());
      }
    });

    it("the weekday's topic goes into the prompt, picked in code (Mon legs, Wed circuit, Fri arms)", async () => {
      await service.generate([], null, MONDAY);
      expect(capturedPrompt).toContain('понеділок, 26 жовтня');
      expect(capturedPrompt).toContain('Тема тренування: ноги');
    });

    it('a day outside the programme with no topic of its own: the fallback text, no AI', async () => {
      capturedPrompt = '';
      const result = await service.generate([], null, THURSDAY);
      expect(result).toMatchObject({ source: 'fallback', fallbackReason: 'no topic for this day' });
      expect(capturedPrompt).toBe('');
    });

    it('the model is told not to mention other days', async () => {
      await service.generate([], null, MONDAY);
      expect(capturedSystem).toContain('не згадуй інші дні');
    });

    it('prompt includes provided examples', async () => {
      await service.generate(['Перший приклад', 'Другий приклад'], null, MONDAY);
      expect(capturedPrompt).toContain('Перший приклад');
      expect(capturedPrompt).toContain('Другий приклад');
    });

    it("the trainer's topic for the day wins over the programme, any weekday", async () => {
      await service.generate([], 'Спина', MONDAY);
      expect(capturedPrompt).toContain('Тема тренування: Спина');
      await service.generate([], 'Спина', THURSDAY);
      expect(capturedPrompt).toContain('Тема тренування: Спина');
    });

    it('Gemini silent for 10 seconds: the fallback text, so the push never waits longer', async () => {
      jest.useFakeTimers();
      const { GoogleGenerativeAI } = jest.requireMock('@google/generative-ai');
      GoogleGenerativeAI.mockImplementationOnce(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({ generateContent: () => new Promise(() => {}) }),
      }));
      (service as any).genAI = null;
      const pending = service.generate([], null, MONDAY);
      await jest.advanceTimersByTimeAsync(10_000);
      const result = await pending;
      jest.useRealTimers();
      expect(result).toMatchObject({ source: 'fallback', text: 'Записуйтесь на тренування! Чекаємо вас сьогодні.' });
      expect(result.fallbackReason).toContain('timeout');
    });

    it('returns fallback when Gemini returns empty text', async () => {
      const { GoogleGenerativeAI } = jest.requireMock('@google/generative-ai');
      GoogleGenerativeAI.mockImplementationOnce(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContent: jest.fn().mockResolvedValue({
            response: { text: () => '', usageMetadata: {} },
          }),
        }),
      }));
      (service as any).genAI = null;
      const result = await service.generate([], null, MONDAY);
      expect(result.source).toBe('fallback');
    });
  });
});

describe('dayTopic', () => {
  it("the trainer's topic, else the weekday's, else none", () => {
    expect(dayTopic(' Спина ', THURSDAY)).toBe('Спина');
    expect(dayTopic(null, MONDAY)).toBe('ноги');
    expect(dayTopic(null, '2026-10-28')).toBe('кругове тренування');
    expect(dayTopic(null, '2026-10-30')).toBe('руки');
    expect(dayTopic(null, THURSDAY)).toBeNull();
    expect(dayTopic('  ', THURSDAY)).toBeNull();
  });
});

describe('withoutLongDash', () => {
  it('puts a comma for a long dash, never one before the end mark', () => {
    expect(withoutLongDash('Записуйтесь — місця обмежені.')).toBe('Записуйтесь, місця обмежені.');
    expect(withoutLongDash('Ноги сьогодні —!')).toBe('Ноги сьогодні!');
    expect(withoutLongDash('— Ноги сьогодні')).toBe('Ноги сьогодні');
    expect(withoutLongDash('Без тире 💪')).toBe('Без тире 💪');
  });
});
