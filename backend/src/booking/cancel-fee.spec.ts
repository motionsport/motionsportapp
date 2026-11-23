import { cancelFee, frequentCancel, halfBack } from './cancel-fee';

const H = 60 * 60 * 1000;

describe('cancel fee', () => {
  it('group: free from 2 hours before, spent under that (single or pass)', () => {
    expect(cancelFee('group', 2 * H, 1)).toBeNull();
    expect(cancelFee('group', 2 * H - 1, 1)).toBe('FULL');
    expect(cancelFee('group', 30 * 60 * 1000, 10)).toBe('FULL');
  });

  it('personal / split pass: free from 12 hours before, one training spent under that', () => {
    expect(cancelFee('personal', 12 * H, 8)).toBeNull();
    expect(cancelFee('personal', 12 * H - 1, 8)).toBe('FULL');
    expect(cancelFee('split', H, 6)).toBe('FULL');
  });

  it('a single personal / split training: half back from 2 to 12 hours, nothing under 2 hours', () => {
    expect(cancelFee('personal', 12 * H, 1)).toBeNull();
    expect(cancelFee('split', 12 * H - 1, 1)).toBe('HALF');
    expect(cancelFee('personal', 2 * H, 1)).toBe('HALF');
    expect(cancelFee('personal', 2 * H - 1, 1)).toBe('FULL');
  });

  it('nothing pays for it: no fee', () => {
    expect(cancelFee('group', 0, null)).toBeNull();
    expect(cancelFee('personal', H, null)).toBeNull();
  });

  it('half back in whole hryvnias', () => {
    expect(halfBack(700)).toBe(350);
    expect(halfBack(375)).toBe(187);
  });
});

describe('frequent cancel', () => {
  it('no package pays (no payer or a single training): no number, no date', () => {
    expect(frequentCancel(null, 4)).toEqual({ cancelNumber: null, packUntil: null });
    expect(frequentCancel({ total: 1, validUntil: '2026-11-27' }, 4)).toEqual({ cancelNumber: null, packUntil: null });
  });

  it('a package: this cancellation counts, the end date once started', () => {
    expect(frequentCancel({ total: 10, validUntil: '2026-11-27' }, 2)).toEqual({
      cancelNumber: 3,
      packUntil: '2026-11-27',
    });
    expect(frequentCancel({ total: 10, validUntil: null }, 0)).toEqual({ cancelNumber: 1, packUntil: null });
  });
});
