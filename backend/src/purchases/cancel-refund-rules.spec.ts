import { precheckError, refundOutcome, refundedSoFar } from './cancel-refund-rules';

describe('refundOutcome — what the refund API answer means', () => {
  it('reversed with result ok means LiqPay accepted it, not that the money went (it may wait for new payments)', () => {
    expect(refundOutcome({ result: 'ok', status: 'reversed' })).toBe('ACCEPTED');
  });

  it('an explicit refusal is declined', () => {
    expect(refundOutcome({ result: 'error', err_code: 'x' })).toBe('DECLINED');
    expect(refundOutcome({ result: 'ok', status: 'failure' })).toBe('DECLINED');
    expect(refundOutcome({ result: 'ok', status: 'error' })).toBe('DECLINED');
  });

  it('anything else is unknown, so nothing is sent again', () => {
    expect(refundOutcome({ result: 'ok', status: 'processing' })).toBe('UNKNOWN');
    expect(refundOutcome({})).toBe('UNKNOWN');
  });
});

describe('refundedSoFar — refund_amount from the status API', () => {
  it('reads refund_amount, 0 when there was none', () => {
    expect(refundedSoFar({ result: 'ok', refund_amount: 425 })).toBe(425);
    expect(refundedSoFar({ result: 'ok', status: 'success' })).toBe(0);
  });

  it('throws when the answer is not ok', () => {
    expect(() => refundedSoFar({ result: 'error', err_code: 'payment_not_found' })).toThrow();
  });
});

describe('precheckError — before sending a refund', () => {
  it('refuses when the order has a refund the app did not make', () => {
    expect(precheckError({ baseline: 425, appRefunded: 0, paymentAmount: 850, amount: 300 })).toBe(
      'REFUNDED_ELSEWHERE',
    );
  });

  it('allows the first refund and one after the app’s own', () => {
    expect(precheckError({ baseline: 0, appRefunded: 0, paymentAmount: 850, amount: 300 })).toBeNull();
    expect(precheckError({ baseline: 300, appRefunded: 300, paymentAmount: 850, amount: 300 })).toBeNull();
  });

  it('refuses more than is left of the payment', () => {
    expect(precheckError({ baseline: 0, appRefunded: 0, paymentAmount: 250, amount: 300 })).toBe('REFUNDED_ELSEWHERE');
  });
});
