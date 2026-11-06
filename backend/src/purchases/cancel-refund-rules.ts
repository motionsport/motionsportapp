// Decisions on LiqPay answers for a half refund (cancel-refunds.service.ts). Only `result === 'ok'` counts

// DONE: refunded. DECLINED: explicit refusal, safe to try again. UNKNOWN: may have gone through, never resend
export function refundOutcome(resp: Record<string, unknown>): 'DONE' | 'DECLINED' | 'UNKNOWN' {
  if (resp.result === 'error') return 'DECLINED';
  if (resp.result !== 'ok') return 'UNKNOWN';
  if (resp.status === 'reversed') return 'DONE';
  if (resp.status === 'failure' || resp.status === 'error') return 'DECLINED';
  return 'UNKNOWN';
}

// refund_amount = all refunds on the order so far. Throws on a status answer that is not ok
export function refundedSoFar(status: Record<string, unknown>): number {
  if (status.result !== 'ok') throw new Error(`LiqPay status API result=${String(status.result)}`);
  return Number(status.refund_amount) || 0;
}

// baseline: refunded on the order (LiqPay); appRefunded: what this app refunded there. More in LiqPay = someone
// refunded in the cabinet, so a second refund could double it
export function precheckError(o: {
  baseline: number;
  appRefunded: number;
  paymentAmount: number;
  amount: number;
}): 'REFUNDED_ELSEWHERE' | null {
  if (o.baseline > o.appRefunded || o.baseline + o.amount > o.paymentAmount) return 'REFUNDED_ELSEWHERE';
  return null;
}
