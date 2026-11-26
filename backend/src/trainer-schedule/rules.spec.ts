import { getTableConfig } from 'drizzle-orm/pg-core';
import { groupTimeError, LEGACY_DEFAULT, scheduleError, slotOpensAt } from './rules';
import { trainerSchedules, trainerScheduleTimes } from '../database/schema';

describe('Trainer schedule rules', () => {
  it('group trainings are from 06:00 to 21:00', () => {
    expect(groupTimeError('05:45', [])).toBe('Group trainings are from 06:00 to 21:00');
    expect(groupTimeError('21:15', [])).toBe('Group trainings are from 06:00 to 21:00');
    expect(groupTimeError('06:00', [])).toBeNull();
    expect(groupTimeError('21:00', [])).toBeNull();
  });

  it('a group training may start at any minute, a malformed time is refused', () => {
    expect(groupTimeError('19:10', [])).toBeNull();
    expect(groupTimeError('7:00', [])).toBe('Invalid time');
    expect(groupTimeError('19:60', [])).toBe('Invalid time');
  });

  it('two group trainings of a day are at least an hour apart', () => {
    expect(groupTimeError('19:30', ['19:00'])).toBe('Group trainings must be at least an hour apart');
    expect(groupTimeError('18:15', ['19:00'])).toBe('Group trainings must be at least an hour apart');
    expect(groupTimeError('20:00', ['19:00'])).toBeNull();
  });

  it('a training at or before the opening time is allowed (it opens the day before)', () => {
    expect(
      scheduleError({
        bookingOpensAt: '10:00',
        autoCreate: true,
        topics: [],
        times: [
          { weekday: 3, slotTime: '09:00' },
          { weekday: 3, slotTime: '19:00' },
        ],
      }),
    ).toBeNull();
  });

  it('rejects an unknown weekday, a bad time and the same time twice on a day', () => {
    expect(
      scheduleError({
        bookingOpensAt: '14:00',
        autoCreate: true,
        topics: [],
        times: [{ weekday: 8, slotTime: '19:00' }],
      }),
    ).toBe('Unknown weekday');
    expect(scheduleError({ bookingOpensAt: '14:05', autoCreate: true, topics: [], times: [] })).toBe(
      'Time must be in 15-minute steps',
    );
    expect(
      scheduleError({
        bookingOpensAt: '14:00',
        autoCreate: true,
        topics: [],
        times: [
          { weekday: 1, slotTime: '19:00' },
          { weekday: 1, slotTime: '19:00' },
        ],
      }),
    ).toBe('Group trainings must be at least an hour apart');
  });

  it('a topic per weekday, 1 to 60 characters', () => {
    const base = { bookingOpensAt: '14:00', autoCreate: true, times: [] };
    expect(scheduleError({ ...base, topics: [{ weekday: 1, topic: 'ноги' }] })).toBeNull();
    expect(scheduleError({ ...base, topics: [{ weekday: 1, topic: 'я'.repeat(61) }] })).toBe(
      'Topic must be 1 to 60 characters',
    );
    expect(scheduleError({ ...base, topics: [{ weekday: 1, topic: '  ' }] })).toBe('Topic must be 1 to 60 characters');
    expect(
      scheduleError({
        ...base,
        topics: [
          { weekday: 1, topic: 'ноги' },
          { weekday: 1, topic: 'руки' },
        ],
      }),
    ).toBe('One topic per weekday');
    expect(scheduleError({ ...base, topics: [{ weekday: 0, topic: 'ноги' }] })).toBe('Unknown weekday');
  });

  it('the same time on different days is fine; the current schedule is valid', () => {
    expect(
      scheduleError({
        bookingOpensAt: '14:00',
        autoCreate: true,
        topics: [],
        times: [
          { weekday: 1, slotTime: '19:00' },
          { weekday: 3, slotTime: '19:00' },
        ],
      }),
    ).toBeNull();
    expect(scheduleError(LEGACY_DEFAULT)).toBeNull();
    expect(LEGACY_DEFAULT.times.map((t) => `${t.weekday} ${t.slotTime}`)).toEqual([
      '1 19:00',
      '1 20:00',
      '3 19:00',
      '3 20:00',
      '5 19:00',
      '5 20:00',
    ]);
  });

  it('booking opens on the training day at the trainer time, in Kyiv', () => {
    expect(slotOpensAt('2026-10-26', '19:00', '14:00').toISO()).toBe('2026-10-26T14:00:00.000+02:00');
  });

  it('a morning training (at or before the opening) opens the calendar day before', () => {
    // Wednesday 9:00 with opening 10:00 opens on Tuesday 10:00
    expect(slotOpensAt('2026-11-25', '09:00', '10:00').toISO()).toBe('2026-11-24T10:00:00.000+02:00');
    expect(slotOpensAt('2026-11-25', '10:00', '10:00').toISO()).toBe('2026-11-24T10:00:00.000+02:00');
    expect(slotOpensAt('2026-11-25', '10:15', '10:00').toISO()).toBe('2026-11-25T10:00:00.000+02:00');
  });
});

describe('Trainer schedule tables', () => {
  // The DB rejects off-grid times whatever writes them
  it('both time columns carry a format CHECK', () => {
    const checks = (table: Parameters<typeof getTableConfig>[0]) => getTableConfig(table).checks.map((c) => c.name);
    expect(checks(trainerScheduleTimes)).toContain('trainer_schedule_times_slot_time_check');
    expect(checks(trainerSchedules)).toContain('trainer_schedules_booking_opens_at_check');
  });
});
