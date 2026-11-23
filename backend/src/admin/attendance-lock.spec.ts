import { marksLocked, marksEditableUntil } from './attendance-lock';

describe('Marks close 3 days after the training', () => {
  it('the training day and the 3 days after it are open', () => {
    expect(marksLocked('2026-11-23', '2026-11-23')).toBe(false);
    expect(marksLocked('2026-11-23', '2026-11-26')).toBe(false);
  });

  it('from the 4th day on the training is closed', () => {
    expect(marksLocked('2026-11-23', '2026-11-27')).toBe(true);
    expect(marksLocked('2026-10-01', '2026-11-27')).toBe(true);
  });

  it('the last day changes can be made', () => {
    expect(marksEditableUntil('2026-11-23')).toBe('2026-11-26');
    expect(marksEditableUntil('2026-11-30')).toBe('2026-12-03');
  });
});
