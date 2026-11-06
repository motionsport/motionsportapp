import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ClockService } from '../clock/clock.service';
import { apiError, type ApiErrorCode } from '../common/api-error';
import { liqpayRefund, liqpayStatus } from '../payment/liqpay.helper';
import { precheckError, refundedSoFar, refundOutcome } from './cancel-refund-rules';
import { appRefundedUah, loadRefund, moveRefund, pendingRefunds } from './cancel-refund.store';

// Logged and kept from LiqPay answers: no names, phones or card masks
const SAFE_FIELDS = ['result', 'status', 'action', 'err_code', 'err_description', 'payment_id', 'order_id'];
const safe = (r: Record<string, unknown>) =>
  Object.fromEntries(SAFE_FIELDS.filter((k) => r[k] !== undefined).map((k) => [k, r[k]]));

// Half refunds of late-cancelled single trainings («Повернути гроші»). LiqPay has no idempotency key, so the
// row is the key: only the request that moves it DUE → SENDING sends, once; SENDING is never sent again
@Injectable()
export class CancelRefundsService {
  private readonly logger = new Logger(CancelRefundsService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly clock: ClockService,
  ) {}

  private get keys(): [string, string] {
    return [process.env.LIQPAY_PUBLIC_KEY ?? '', process.env.LIQPAY_PRIVATE_KEY ?? ''];
  }

  async pending(trainerId: string) {
    const rows = await pendingRefunds(this.database.db, trainerId);
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  async refund(trainerId: string, id: string): Promise<{ status: 'DUE' | 'SENDING' | 'DONE' }> {
    const db = this.database.db;
    const row = await this.load(trainerId, id);
    if (row.method !== 'LIQPAY' || !row.paymentId || !row.orderId) {
      throw new BadRequestException(apiError('NOT_ONLINE_PAYMENT'));
    }
    if (row.status !== 'DUE') return { status: row.status };

    const now = this.clock.now().toJSDate();
    const claimed = await moveRefund(db, id, 'DUE', {
      status: 'SENDING',
      sentAt: now,
      sentBy: trainerId,
      paymentId: row.paymentId,
      lastError: null,
    });
    if (!claimed) return { status: (await this.load(trainerId, id)).status };

    let baseline: number;
    try {
      baseline = refundedSoFar(await liqpayStatus(...this.keys, row.orderId));
    } catch (err) {
      this.logger.warn(`Refund: ${id} order=${row.orderId} status API unavailable (${String(err)}) — nothing sent`);
      return this.giveBack(id, 'PAYMENT_PROVIDER_UNREACHABLE');
    }
    const refusal = precheckError({
      baseline,
      appRefunded: await appRefundedUah(db, row.purchaseId),
      paymentAmount: row.paymentAmount ?? 0,
      amount: row.amountUah,
    });
    if (refusal) {
      this.logger.warn(`Refund: ${id} order=${row.orderId} already refunded ${baseline} — nothing sent`);
      return this.giveBack(id, refusal);
    }
    await moveRefund(db, id, 'SENDING', { expectedRefundedUah: baseline + row.amountUah });

    this.logger.log(`Refund: ${id} order=${row.orderId} sending ${row.amountUah} by ${trainerId}`);
    let resp: Record<string, unknown>;
    try {
      resp = await liqpayRefund(...this.keys, row.orderId, row.amountUah);
    } catch (err) {
      this.logger.error(`Refund: ${id} order=${row.orderId} no answer (${String(err)}) — stays SENDING`);
      return { status: 'SENDING' };
    }
    this.logger.log(`Refund: ${id} order=${row.orderId} answer ${JSON.stringify(safe(resp))}`);
    await moveRefund(db, id, 'SENDING', { liqpayResponse: safe(resp) });

    const outcome = refundOutcome(resp);
    if (outcome === 'DONE') {
      // Lost to the reversed callback: already DONE
      await moveRefund(db, id, 'SENDING', { status: 'DONE', doneVia: 'LIQPAY', doneAt: now, doneBy: trainerId });
      return { status: 'DONE' };
    }
    if (outcome === 'DECLINED') return this.giveBack(id, 'REFUND_DECLINED');
    return { status: 'SENDING' };
  }

  // «Перевірити»: asks LiqPay whether a SENDING refund went through. Never sends one
  async check(trainerId: string, id: string): Promise<{ status: 'DUE' | 'SENDING' | 'DONE' }> {
    const row = await this.load(trainerId, id);
    if (row.status !== 'SENDING' || !row.orderId) return { status: row.status };
    let refunded: number;
    try {
      refunded = refundedSoFar(await liqpayStatus(...this.keys, row.orderId));
    } catch (err) {
      this.logger.warn(`Refund: ${id} check, status API unavailable (${String(err)})`);
      return { status: 'SENDING' };
    }
    this.logger.log(`Refund: ${id} check order=${row.orderId} refund_amount=${refunded}`);
    if (row.expectedRefundedUah === null || refunded < row.expectedRefundedUah) return { status: 'SENDING' };
    const at = this.clock.now().toJSDate();
    await moveRefund(this.database.db, id, 'SENDING', {
      status: 'DONE',
      doneVia: 'LIQPAY',
      doneAt: at,
      doneBy: trainerId,
    });
    return { status: 'DONE' };
  }

  // Cash handed over; or an online refund stuck in SENDING the trainer found in the LiqPay cabinet
  async markDone(trainerId: string, id: string) {
    const row = await this.load(trainerId, id);
    if (row.status === 'DONE') throw new ConflictException(apiError('MONEY_RETURNED'));
    const online = row.method === 'LIQPAY';
    const from = online ? 'SENDING' : 'DUE';
    if (row.status !== from) {
      if (online) throw new BadRequestException('Send the refund first');
      throw new ConflictException(apiError('MONEY_RETURNED'));
    }
    const at = this.clock.now().toJSDate();
    const done = await moveRefund(this.database.db, id, from, {
      status: 'DONE',
      doneVia: online ? 'MANUAL' : 'CASH',
      doneAt: at,
      doneBy: trainerId,
    });
    if (!done) throw new ConflictException(apiError('MONEY_RETURNED'));
    return { ok: true };
  }

  private async load(trainerId: string, id: string) {
    const row = await loadRefund(this.database.db, id, trainerId);
    if (!row || row.status === 'CANCELLED') throw new NotFoundException('Refund not found');
    return { ...row, status: row.status };
  }

  // Nothing was sent: back to DUE with the reason, for another try or «Не списувати»
  private async giveBack(id: string, code: ApiErrorCode): Promise<never> {
    await moveRefund(this.database.db, id, 'SENDING', { status: 'DUE', lastError: code });
    throw new ConflictException(apiError(code));
  }
}
