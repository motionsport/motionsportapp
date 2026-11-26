import { openingText } from './opening-text';

describe('openingText — the booking-open push', () => {
  it('only the evening', () => {
    expect(openingText(['19:00', '20:00'], [])).toBe('Записуйтесь на вечірні групові сьогодні о 19:00 і 20:00');
    expect(openingText(['19:00'], [])).toBe('Записуйтесь на вечірнє групове сьогодні о 19:00');
  });

  it("only tomorrow's morning", () => {
    expect(openingText([], ['09:00'])).toBe('Записуйтесь на ранкове групове завтра о 9:00');
    expect(openingText([], ['08:00', '09:30'])).toBe('Записуйтесь на ранкові групові завтра о 8:00 і 9:30');
  });

  it('both', () => {
    expect(openingText(['19:00', '20:00'], ['09:00'])).toBe(
      'Записуйтесь на вечірні групові сьогодні о 19:00 і 20:00 та на ранкове завтра о 9:00',
    );
  });

  it('three times: commas, then «і»', () => {
    expect(openingText(['20:00', '18:00', '19:00'], [])).toBe(
      'Записуйтесь на вечірні групові сьогодні о 18:00, 19:00 і 20:00',
    );
  });
});
