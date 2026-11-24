import { discountUahFor, discountable, discountState, newDiscountCode } from './rules';

describe('discountUahFor', () => {
  it.each([
    [1400, 70],
    [250, 13],
    [230, 12],
    [208, 10],
  ])('5%% of %i is %i', (amount, expected) => {
    expect(discountUahFor(amount)).toBe(expected);
  });
});

describe('discountable', () => {
  it('club card and group yes, assigned no', () => {
    expect(discountable('club_card')).toBe(true);
    expect(discountable('group')).toBe(true);
    expect(discountable('assigned')).toBe(false);
  });
});

describe('discountState', () => {
  const base = { validUntil: '2026-12-01', usedVia: null, purchaseStatus: null };
  it('used at the bar', () => {
    expect(discountState({ ...base, usedVia: 'BAR' }, '2026-11-25')).toBe('used');
  });
  it('PAID is used even after the end date', () => {
    expect(discountState({ ...base, purchaseStatus: 'PAID' }, '2027-01-01')).toBe('used');
  });
  it('PENDING is held', () => {
    expect(discountState({ ...base, purchaseStatus: 'PENDING' }, '2026-11-25')).toBe('held');
  });
  it('CANCELLED within the term is free again', () => {
    expect(discountState({ ...base, purchaseStatus: 'CANCELLED' }, '2026-11-25')).toBe('free');
  });
  it('REJECTED after the term is expired', () => {
    expect(discountState({ ...base, purchaseStatus: 'REJECTED' }, '2026-12-02')).toBe('expired');
  });
  it('last day is still free', () => {
    expect(discountState(base, '2026-12-01')).toBe('free');
  });
});

describe('newDiscountCode', () => {
  it('has the MG5 shape, no dashes', () => {
    for (let i = 0; i < 50; i++) expect(newDiscountCode()).toMatch(/^MG5[A-HJ-NP-Z2-9]{4}$/);
  });
  it('uses the injected random', () => {
    expect(newDiscountCode(() => 0)).toBe('MG5AAAA');
  });
});
