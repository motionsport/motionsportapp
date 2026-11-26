import { birthdayState, permanentApplies, permanentDiscountUahFor } from './rules';

describe('permanent discount rules', () => {
  it('10% with normal rounding', () => {
    expect(permanentDiscountUahFor(1400)).toBe(140);
    expect(permanentDiscountUahFor(1255)).toBe(126);
  });

  it('only a club card for a period: not «Разове відвідування», not group passes, not trainer services', () => {
    expect(permanentApplies('club_card', 1)).toBe(true);
    expect(permanentApplies('club_card', 0)).toBe(false);
    expect(permanentApplies('group', 1)).toBe(false);
    expect(permanentApplies('assigned', 1)).toBe(false);
  });

  it('birthday: free on its day only; held by a pending purchase; used by a paid one or a reception card', () => {
    const b = { givenOn: '2026-11-26', clubCardId: null, purchaseStatus: null };
    expect(birthdayState(b, '2026-11-26')).toBe('free');
    expect(birthdayState(b, '2026-11-27')).toBe('expired');
    expect(birthdayState({ ...b, purchaseStatus: 'PENDING' }, '2026-11-26')).toBe('held');
    expect(birthdayState({ ...b, purchaseStatus: 'REJECTED' }, '2026-11-26')).toBe('free');
    expect(birthdayState({ ...b, purchaseStatus: 'PAID' }, '2026-11-27')).toBe('used');
    expect(birthdayState({ ...b, clubCardId: 'c1' }, '2026-11-26')).toBe('used');
  });
});
