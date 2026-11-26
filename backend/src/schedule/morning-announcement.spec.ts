import { morningAnnouncement } from './morning-announcement';
import { timeList } from './time-list';

describe('morningAnnouncement', () => {
  it('names the day and the time', () => {
    expect(morningAnnouncement('2026-11-25', ['09:00'])).toBe(
      'Записуйтесь на ранкове тренування! Чекаємо вас у середу о 9:00.',
    );
    expect(morningAnnouncement('2026-11-27', ['08:00', '09:30'])).toBe(
      'Записуйтесь на ранкові тренування! Чекаємо вас у пʼятницю о 8:00 і 9:30.',
    );
  });
});

describe('timeList', () => {
  it('one, two, three times', () => {
    expect(timeList(['09:00'])).toBe('9:00');
    expect(timeList(['20:00', '19:00'])).toBe('19:00 і 20:00');
    expect(timeList(['20:00', '18:00', '19:00'])).toBe('18:00, 19:00 і 20:00');
  });
});
