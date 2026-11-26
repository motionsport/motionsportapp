import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SaveScheduleDto } from './dto/save-schedule.dto';
import { TrainerScheduleService } from './trainer-schedule.service';
import { TrainerScheduleController } from './trainer-schedule.controller';
import { loadTrainerSchedule } from './trainer-schedule.store';
import { LEGACY_DEFAULT, type TrainerSchedule } from './rules';
import { AdminGuard } from '../common/guards/admin.guard';
import { trainerSchedules, trainerScheduleTimes, trainerScheduleTopics } from '../database/schema';

// Each awaited read takes the next result; inserts / deletes recorded with their table
function makeDb(results: unknown[][]) {
  const queue = [...results];
  const writes: { op: string; table: unknown; values?: unknown }[] = [];
  function link(result?: () => unknown): any {
    const chain: any = {
      then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
        Promise.resolve(result ? result() : (queue.shift() ?? [])).then(resolve, reject),
    };
    for (const m of ['from', 'where', 'orderBy', 'limit', 'onConflictDoUpdate', 'returning']) {
      chain[m] = jest.fn(() => chain);
    }
    return chain;
  }
  const db: any = {
    select: jest.fn(() => link()),
    insert: jest.fn((table: unknown) => {
      const chain = link(() => []);
      chain.values = jest.fn((values: unknown) => {
        writes.push({ op: 'insert', table, values });
        return chain;
      });
      return chain;
    }),
    delete: jest.fn((table: unknown) => {
      writes.push({ op: 'delete', table });
      return link(() => []);
    }),
  };
  db.transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(db));
  return { db, writes };
}

const SCHEDULE: TrainerSchedule = {
  bookingOpensAt: '12:00',
  autoCreate: true,
  times: [
    { weekday: 2, slotTime: '18:00' },
    { weekday: 4, slotTime: '18:00' },
  ],
  topics: [{ weekday: 2, topic: 'спина' }],
};

describe('loadTrainerSchedule', () => {
  it('a saved schedule comes back as saved, times and topics in week order', async () => {
    const { db } = makeDb([
      [{ bookingOpensAt: '12:00', autoCreate: true }],
      [
        { weekday: 4, slotTime: '18:00' },
        { weekday: 2, slotTime: '18:00' },
      ],
      SCHEDULE.topics,
    ]);
    expect(await loadTrainerSchedule(db, 't2')).toEqual(SCHEDULE);
  });

  it('the first trainer without a saved schedule keeps the old Mon/Wed/Fri one', async () => {
    const { db } = makeDb([[], [{ id: 't1' }]]);
    expect(await loadTrainerSchedule(db, 't1')).toEqual(LEGACY_DEFAULT);
  });

  it('another trainer without a saved schedule has none, nothing created ahead', async () => {
    const { db } = makeDb([[], [{ id: 't1' }]]);
    expect(await loadTrainerSchedule(db, 't2')).toEqual({
      bookingOpensAt: '14:00',
      autoCreate: false,
      times: [],
      topics: [],
    });
  });
});

describe('TrainerScheduleService.save', () => {
  const schedule = {
    ensureGroupSlots: jest
      .fn()
      .mockResolvedValue({ added: 3, skipped: [{ date: '2026-10-27', slotTime: '10:00', reason: 'cancelled' }] }),
  };
  beforeEach(() => schedule.ensureGroupSlots.mockClear());

  it('a schedule that breaks the rules: 400, nothing written', async () => {
    const { db, writes } = makeDb([]);
    const svc = new TrainerScheduleService({ db } as any, schedule as any);
    await expect(svc.save('t2', { ...SCHEDULE, bookingOpensAt: '14:05' })).rejects.toThrow(
      new BadRequestException('Time must be in 15-minute steps'),
    );
    expect(writes).toEqual([]);
    expect(schedule.ensureGroupSlots).not.toHaveBeenCalled();
  });

  it('saves the settings and replaces the times and topics in one transaction, then returns them', async () => {
    const { db, writes } = makeDb([[{ bookingOpensAt: '12:00', autoCreate: true }], SCHEDULE.times, SCHEDULE.topics]);
    const svc = new TrainerScheduleService({ db } as any, schedule as any);
    expect(await svc.save('t2', SCHEDULE)).toEqual({
      ...SCHEDULE,
      added: 3,
      skipped: [{ date: '2026-10-27', slotTime: '10:00', reason: 'cancelled' }],
    });
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(schedule.ensureGroupSlots).toHaveBeenCalledWith('t2', { force: true });
    expect(writes).toEqual([
      {
        op: 'insert',
        table: trainerSchedules,
        values: { trainerId: 't2', bookingOpensAt: '12:00', autoCreate: true, updatedAt: expect.any(Date) },
      },
      { op: 'delete', table: trainerScheduleTimes },
      {
        op: 'insert',
        table: trainerScheduleTimes,
        values: [
          { trainerId: 't2', weekday: 2, slotTime: '18:00' },
          { trainerId: 't2', weekday: 4, slotTime: '18:00' },
        ],
      },
      { op: 'delete', table: trainerScheduleTopics },
      { op: 'insert', table: trainerScheduleTopics, values: [{ trainerId: 't2', weekday: 2, topic: 'спина' }] },
    ]);
  });

  it('topics are trimmed; an empty one is no topic for that weekday', async () => {
    const { db, writes } = makeDb([[{ bookingOpensAt: '12:00', autoCreate: true }], SCHEDULE.times, []]);
    const svc = new TrainerScheduleService({ db } as any, schedule as any);
    await svc.save('t2', {
      ...SCHEDULE,
      topics: [
        { weekday: 2, topic: '  спина ' },
        { weekday: 4, topic: ' ' },
      ],
    });
    expect(writes.at(-1)).toEqual({
      op: 'insert',
      table: trainerScheduleTopics,
      values: [{ trainerId: 't2', weekday: 2, topic: 'спина' }],
    });
  });

  it('adding the trainings failing after the save still reports the schedule as saved', async () => {
    const { db } = makeDb([[{ bookingOpensAt: '12:00', autoCreate: true }], SCHEDULE.times, SCHEDULE.topics]);
    const failing = { ensureGroupSlots: jest.fn().mockRejectedValue(new Error('db down')) };
    const svc = new TrainerScheduleService({ db } as any, failing as any);
    await expect(svc.save('t2', SCHEDULE)).resolves.toEqual(SCHEDULE);
  });

  it('the schedule endpoints are for trainers only', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, TrainerScheduleController)).toContain(AdminGuard);
  });
});

describe('SaveScheduleDto', () => {
  it('checks every time row: a weekday out of 1–7 or a time not HH:MM is rejected', async () => {
    const bad = plainToInstance(SaveScheduleDto, {
      bookingOpensAt: '14:00',
      autoCreate: true,
      times: [{ weekday: 9, slotTime: '7pm' }],
      topics: [],
    });
    const errors = await validate(bad);
    expect(errors.map((e) => e.property)).toEqual(['times']);
    expect(await validate(plainToInstance(SaveScheduleDto, { ...SCHEDULE }))).toEqual([]);
  });

  it('checks every topic row: a weekday out of 1–7 is rejected', async () => {
    const bad = plainToInstance(SaveScheduleDto, { ...SCHEDULE, topics: [{ weekday: 0, topic: 'ноги' }] });
    expect((await validate(bad)).map((e) => e.property)).toEqual(['topics']);
  });
});
