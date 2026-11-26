import { shownSlots } from './training-types';

describe('shownSlots — one training a time on a day', () => {
  const s = (id: string, slotTime: string, status: string) => ({ id, slotTime, status });

  it('a cancelled training stays («Скасовано») while nothing replaced it', () => {
    const slots = [s('a', '19:30', 'ACTIVE'), s('b', '21:00', 'CANCELLED')];
    expect(shownSlots(slots).map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('added again at that time: only the active one', () => {
    const slots = [s('b', '21:00', 'CANCELLED'), s('c', '21:00', 'ACTIVE')];
    expect(shownSlots(slots).map((x) => x.id)).toEqual(['c']);
  });

  it('cancelled twice at the same time: one card', () => {
    const slots = [s('b', '21:00', 'CANCELLED'), s('d', '21:00', 'CANCELLED')];
    expect(shownSlots(slots).map((x) => x.id)).toEqual(['b']);
  });
});
