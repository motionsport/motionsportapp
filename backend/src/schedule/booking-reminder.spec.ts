import { DateTime } from 'luxon';
import { reminderLeadMinutes, reminderWindow } from './booking-reminder';

const at = (h: number) => DateTime.fromISO(`2026-11-19T${String(h).padStart(2, '0')}:00`, { zone: 'Europe/Kyiv' });
const hhmm = (d: { toFormat: (f: string) => string }) => d.toFormat('HH:mm');

describe('reminderWindow', () => {
  it('3 hours before the first group training, «встигніть» from an hour before', () => {
    const w = reminderWindow('2026-11-19', ['20:00', '19:00'], '14:00', at(5), 180)!;
    expect([hhmm(w.from), hhmm(w.softDeadline), hhmm(w.firstStart)]).toEqual(['16:00', '18:00', '19:00']);
  });

  it('a morning training (opened the day before) counts: from 6:00 for 9:00, then the evening', () => {
    const w = reminderWindow('2026-11-19', ['09:00', '19:00', '20:00'], '10:00', at(5), 180)!;
    expect([hhmm(w.from), hhmm(w.firstStart)]).toEqual(['06:00', '09:00']);
    const evening = reminderWindow('2026-11-19', ['09:00', '19:00', '20:00'], '10:00', at(9), 180)!;
    expect([hhmm(evening.from), hhmm(evening.firstStart)]).toEqual(['16:00', '19:00']);
  });

  it('booking opens after the reminder would start: none', () => {
    expect(reminderWindow('2026-11-19', ['16:00'], '14:00', at(5), 180)).toBeNull();
    expect(reminderWindow('2026-11-19', ['17:00'], '14:00', at(5), 180)).not.toBeNull();
  });

  it('no group training left: none', () => {
    expect(reminderWindow('2026-11-19', [], '14:00', at(5), 180)).toBeNull();
  });

  it('the lead comes from BOOKING_REMINDER_LEAD_MINUTES, 180 by default', () => {
    expect(reminderLeadMinutes({})).toBe(180);
    expect(reminderLeadMinutes({ BOOKING_REMINDER_LEAD_MINUTES: '480' })).toBe(480);
    const w = reminderWindow('2026-11-19', ['19:00'], '10:00', at(5), 480)!;
    expect(hhmm(w.from)).toBe('11:00');
  });
});
