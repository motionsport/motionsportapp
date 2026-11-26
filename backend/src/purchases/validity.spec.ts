import {
  cardUsableOn,
  activateByFor,
  cardState,
  endsInDays,
  packageEnding,
  passState,
  passUsableOn,
  validUntilFor,
} from './validity';

describe('Validity — dates', () => {
  it('a month to activate, to the same date (or the month end)', () => {
    expect(activateByFor('2026-10-23')).toBe('2027-01-23');
    expect(activateByFor('2026-01-31')).toBe('2026-04-30');
  });

  it('valid for its months from activation; 0 months = that day only', () => {
    expect(validUntilFor('2026-10-23', 1)).toBe('2026-11-23');
    expect(validUntilFor('2026-10-23', 0)).toBe('2026-10-23');
  });
});

describe('Validity — which pass pays for a training on a date', () => {
  const waiting = { purchasedOn: '2026-10-23', activateBy: '2026-11-23', activatedOn: null, validUntil: null };
  const active = { ...waiting, activatedOn: '2026-11-01', validUntil: '2026-12-01' };

  it('not activated: from the purchase day to the last day to activate', () => {
    expect(passUsableOn(waiting, '2026-10-23')).toBe(true);
    expect(passUsableOn(waiting, '2026-11-23')).toBe(true);
    expect(passUsableOn(waiting, '2026-10-22')).toBe(false);
    expect(passUsableOn(waiting, '2026-11-24')).toBe(false);
  });

  it('activated: until its last day, never for a training before the purchase', () => {
    expect(passUsableOn(active, '2026-12-01')).toBe(true);
    expect(passUsableOn(active, '2026-12-02')).toBe(false);
    expect(passUsableOn(active, '2026-10-25')).toBe(true);
    expect(passUsableOn(active, '2026-10-22')).toBe(false);
  });
});

describe('Validity — states', () => {
  const card = { activateBy: '2026-11-23', validFrom: null, validUntil: null };

  it('a card waits for the trainer, then burns', () => {
    expect(cardState(card, '2026-11-23')).toBe('waiting');
    expect(cardState(card, '2026-11-24')).toBe('burned');
  });

  it('an activated card is active until its last day, then expired', () => {
    const on = { ...card, validFrom: '2026-11-01', validUntil: '2026-12-01' };
    expect(cardState(on, '2026-12-01')).toBe('active');
    expect(cardState(on, '2026-12-02')).toBe('expired');
  });

  it('a pass with nothing left is used, whatever its dates', () => {
    const pass = { purchasedOn: '2026-10-23', activateBy: '2026-11-23', activatedOn: null, validUntil: null };
    expect(passState({ ...pass, left: 0 }, '2026-10-24')).toBe('used');
    expect(passState({ ...pass, left: 3 }, '2026-10-24')).toBe('waiting');
    expect(passState({ ...pass, left: 3 }, '2026-11-24')).toBe('burned');
    expect(passState({ ...pass, activatedOn: '2026-11-01', validUntil: '2026-12-01', left: 3 }, '2026-12-02')).toBe(
      'expired',
    );
  });
});

describe('Validity — «Пакет скоро закінчиться»', () => {
  const pack = (validUntil: string, extra: object = {}) => ({
    total: 10,
    state: 'active' as const,
    validUntil,
    ...extra,
  });

  it('10 days or fewer, today and the last day counted', () => {
    expect(endsInDays(pack('2026-11-27'), '2026-11-19')).toBe(9);
    expect(endsInDays(pack('2026-11-28'), '2026-11-19')).toBe(10);
    expect(endsInDays(pack('2026-11-19'), '2026-11-19')).toBe(1);
  });

  it('more than 10 days: no', () => {
    expect(endsInDays(pack('2026-11-29'), '2026-11-19')).toBeNull();
  });

  it('a single training, a package not started, used up or over: no', () => {
    expect(endsInDays(pack('2026-11-27', { total: 1 }), '2026-11-19')).toBeNull();
    for (const state of ['waiting', 'used', 'expired', 'burned'] as const)
      expect(endsInDays(pack('2026-11-27', { state }), '2026-11-19')).toBeNull();
  });
});

describe('packageEnding (an assigned training card)', () => {
  const pack = {
    trainingType: 'personal',
    left: 6,
    purchasedOn: '2026-10-23',
    activateBy: '2027-01-23',
    activatedOn: '2026-10-23',
    validUntil: '2026-11-23',
    endsInDays: 1,
  };

  it('the package that pays on that date, ending soon', () => {
    expect(packageEnding([pack], 'personal', '2026-11-23')).toEqual({ validUntil: '2026-11-23', endsInDays: 1 });
  });

  it('nothing when not ending soon, another type, nothing left, or not usable on that date', () => {
    expect(packageEnding([{ ...pack, endsInDays: null }], 'personal', '2026-11-23')).toBeNull();
    expect(packageEnding([pack], 'split', '2026-11-23')).toBeNull();
    expect(packageEnding([{ ...pack, left: 0 }], 'personal', '2026-11-23')).toBeNull();
    expect(packageEnding([pack], 'personal', '2026-11-24')).toBeNull();
  });

  it('several: the one ending first', () => {
    const later = { ...pack, validUntil: '2026-11-30', endsInDays: 8 };
    expect(packageEnding([later, pack], 'personal', '2026-11-23')).toEqual({ validUntil: '2026-11-23', endsInDays: 1 });
  });
});

describe('cardUsableOn (a gym card on a training day)', () => {
  const waiting = { purchasedOn: '2026-11-20', activateBy: '2027-02-20', validFrom: null, validUntil: null };
  it('a waiting card counts from its purchase day until it burns: the ✓ that day starts it', () => {
    expect(cardUsableOn(waiting, '2026-12-01')).toBe(true);
    expect(cardUsableOn(waiting, '2026-11-19')).toBe(false);
    expect(cardUsableOn(waiting, '2027-02-21')).toBe(false);
  });
  it('an active card covers its dates only', () => {
    const month = { ...waiting, validFrom: '2026-11-21', validUntil: '2026-12-21' };
    expect(cardUsableOn(month, '2026-12-21')).toBe(true);
    expect(cardUsableOn(month, '2026-12-22')).toBe(false);
  });
  it('a used «Разове відвідування» covers its own day, not the next training', () => {
    const single = { ...waiting, validFrom: '2026-11-25', validUntil: '2026-11-25' };
    expect(cardUsableOn(single, '2026-11-25')).toBe(true);
    expect(cardUsableOn(single, '2026-11-28')).toBe(false);
  });
});
