import { reminderLeadMinutes, reminderWindow } from './booking-reminder';

const hhmm = (d: { toFormat: (f: string) => string }) => d.toFormat('HH:mm');

describe('reminderWindow', () => {
  it('3 hours before the first group training, «встигніть» from an hour before', () => {
    const w = reminderWindow('2026-11-19', ['20:00', '19:00'], '14:00', 180)!;
    expect([hhmm(w.from), hhmm(w.softDeadline), hhmm(w.firstStart)]).toEqual(['16:00', '18:00', '19:00']);
  });

  it('a training before the opening time does not count', () => {
    const w = reminderWindow('2026-11-19', ['09:00', '19:00'], '10:00', 180)!;
    expect(hhmm(w.firstStart)).toBe('19:00');
  });

  it('booking opens after the reminder would start: none', () => {
    expect(reminderWindow('2026-11-19', ['16:00'], '14:00', 180)).toBeNull();
    expect(reminderWindow('2026-11-19', ['17:00'], '14:00', 180)).not.toBeNull();
  });

  it('no group training after the opening: none', () => {
    expect(reminderWindow('2026-11-19', [], '14:00', 180)).toBeNull();
    expect(reminderWindow('2026-11-19', ['10:00'], '14:00', 180)).toBeNull();
  });

  it('the lead comes from BOOKING_REMINDER_LEAD_MINUTES, 180 by default', () => {
    expect(reminderLeadMinutes({})).toBe(180);
    expect(reminderLeadMinutes({ BOOKING_REMINDER_LEAD_MINUTES: '480' })).toBe(480);
    const w = reminderWindow('2026-11-19', ['19:00'], '10:00', 480)!;
    expect(hhmm(w.from)).toBe('11:00');
  });
});
