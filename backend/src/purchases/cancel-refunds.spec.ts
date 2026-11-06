import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { DateTime } from 'luxon';
import { CancelRefundsService } from './cancel-refunds.service';
import { KY_ZONE } from '../schedule/training-types';
import { liqpayRefund, liqpayStatus } from '../payment/liqpay.helper';
import * as store from './cancel-refund.store';

jest.mock('../payment/liqpay.helper', () => ({
  ...jest.requireActual('../payment/liqpay.helper'),
  liqpayRefund: jest.fn(),
  liqpayStatus: jest.fn(),
}));
jest.mock('./cancel-refund.store', () => ({
  ...jest.requireActual('./cancel-refund.store'),
  loadRefund: jest.fn(),
  moveRefund: jest.fn(),
  appRefundedUah: jest.fn(),
}));
const mockRefund = liqpayRefund as jest.Mock;
const mockStatus = liqpayStatus as jest.Mock;
const mockLoad = store.loadRefund as jest.Mock;
const mockMove = store.moveRefund as jest.Mock;
const mockAppRefunded = store.appRefundedUah as jest.Mock;

const NOW = DateTime.fromISO('2026-11-06T12:00:00', { zone: KY_ZONE });

const ROW = {
  id: 'r1',
  status: 'DUE',
  amountUah: 300,
  purchaseId: 'p1',
  method: 'LIQPAY',
  paymentId: 'pay1',
  orderId: 'mg-1',
  paymentAmount: 850,
  expectedRefundedUah: null as number | null,
};

function makeService() {
  return new CancelRefundsService({ db: {} } as any, { now: () => NOW });
}

// Every move wins unless a test says otherwise; returns the moves made, as [from, set]
function moves() {
  return mockMove.mock.calls.map(([, , from, set]) => [from, set]);
}

beforeEach(() => {
  jest.resetAllMocks();
  process.env.LIQPAY_PUBLIC_KEY = 'pub';
  process.env.LIQPAY_PRIVATE_KEY = 'priv';
  mockLoad.mockResolvedValue({ ...ROW });
  mockMove.mockResolvedValue(true);
  mockAppRefunded.mockResolvedValue(0);
  mockStatus.mockResolvedValue({ result: 'ok', status: 'success' });
});

describe('CancelRefundsService.refund', () => {
  it('sends one refund for the half and marks it DONE', async () => {
    mockRefund.mockResolvedValue({ result: 'ok', status: 'reversed', wait_amount: true });

    await expect(makeService().refund('t1', 'r1')).resolves.toEqual({ status: 'DONE' });

    expect(mockRefund).toHaveBeenCalledTimes(1);
    expect(mockRefund).toHaveBeenCalledWith('pub', 'priv', 'mg-1', 300);
    expect(moves()[0]).toEqual([
      'DUE',
      expect.objectContaining({ status: 'SENDING', sentBy: 't1', paymentId: 'pay1' }),
    ]);
    expect(moves()).toContainEqual(['SENDING', expect.objectContaining({ expectedRefundedUah: 300 })]);
    expect(moves()).toContainEqual([
      'SENDING',
      expect.objectContaining({ status: 'DONE', doneVia: 'LIQPAY', doneBy: 't1' }),
    ]);
  });

  it('does not send again while SENDING', async () => {
    mockLoad.mockResolvedValue({ ...ROW, status: 'SENDING' });

    await expect(makeService().refund('t1', 'r1')).resolves.toEqual({ status: 'SENDING' });
    expect(mockRefund).not.toHaveBeenCalled();
    expect(mockMove).not.toHaveBeenCalled();
  });

  it('a lost race to SENDING answers the current state and sends nothing', async () => {
    mockMove.mockResolvedValueOnce(false);
    mockLoad.mockResolvedValueOnce({ ...ROW }).mockResolvedValueOnce({ ...ROW, status: 'SENDING' });

    await expect(makeService().refund('t1', 'r1')).resolves.toEqual({ status: 'SENDING' });
    expect(mockRefund).not.toHaveBeenCalled();
  });

  it('keeps SENDING when the response is lost', async () => {
    mockRefund.mockRejectedValue(new Error('timeout'));

    await expect(makeService().refund('t1', 'r1')).resolves.toEqual({ status: 'SENDING' });
    expect(moves()).not.toContainEqual(['SENDING', expect.objectContaining({ status: 'DUE' })]);
  });

  it('keeps SENDING on a status it does not know', async () => {
    mockRefund.mockResolvedValue({ result: 'ok', status: 'processing' });

    await expect(makeService().refund('t1', 'r1')).resolves.toEqual({ status: 'SENDING' });
    expect(moves()).not.toContainEqual(['SENDING', expect.objectContaining({ status: 'DUE' })]);
  });

  it('goes back to DUE when LiqPay declines', async () => {
    mockRefund.mockResolvedValue({ result: 'error', err_code: 'x' });

    await expect(makeService().refund('t1', 'r1')).rejects.toMatchObject({
      response: { code: 'REFUND_DECLINED' },
    });
    expect(moves()).toContainEqual([
      'SENDING',
      expect.objectContaining({ status: 'DUE', lastError: 'REFUND_DECLINED' }),
    ]);
  });

  it('refuses when the order already has a refund the app did not make', async () => {
    mockStatus.mockResolvedValue({ result: 'ok', status: 'reversed', refund_amount: 425 });

    const err = await makeService()
      .refund('t1', 'r1')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({ code: 'REFUNDED_ELSEWHERE' });
    expect(mockRefund).not.toHaveBeenCalled();
    expect(moves()).toContainEqual([
      'SENDING',
      expect.objectContaining({ status: 'DUE', lastError: 'REFUNDED_ELSEWHERE' }),
    ]);
  });

  it('status API down: back to DUE, nothing sent', async () => {
    mockStatus.mockRejectedValue(new Error('down'));

    await expect(makeService().refund('t1', 'r1')).rejects.toMatchObject({
      response: { code: 'PAYMENT_PROVIDER_UNREACHABLE' },
    });
    expect(mockRefund).not.toHaveBeenCalled();
    expect(moves()).toContainEqual([
      'SENDING',
      expect.objectContaining({ status: 'DUE', lastError: 'PAYMENT_PROVIDER_UNREACHABLE' }),
    ]);
  });

  it('late response after callback changes nothing', async () => {
    mockRefund.mockResolvedValue({ result: 'ok', status: 'reversed' });
    // claim, save expected and the response win; SENDING → DONE was taken by the callback
    mockMove
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await expect(makeService().refund('t1', 'r1')).resolves.toEqual({ status: 'DONE' });
  });

  it('another trainer gets 404', async () => {
    mockLoad.mockResolvedValue(null);
    await expect(makeService().refund('t2', 'r1')).rejects.toBeInstanceOf(NotFoundException);
    expect(mockLoad).toHaveBeenCalledWith({}, 'r1', 't2');
  });

  it('a waived refund gets 404', async () => {
    mockLoad.mockResolvedValue({ ...ROW, status: 'CANCELLED' });
    await expect(makeService().refund('t1', 'r1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cash purchase cannot be refunded online', async () => {
    mockLoad.mockResolvedValue({ ...ROW, method: 'CASH', paymentId: null, orderId: null });
    const err = await makeService()
      .refund('t1', 'r1')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toMatchObject({ code: 'NOT_ONLINE_PAYMENT' });
    expect(mockRefund).not.toHaveBeenCalled();
  });
});

describe('CancelRefundsService.check', () => {
  it('marks DONE once refund_amount reaches the expected total', async () => {
    mockLoad.mockResolvedValue({ ...ROW, status: 'SENDING', expectedRefundedUah: 300 });
    mockStatus.mockResolvedValue({ result: 'ok', status: 'reversed', refund_amount: 300 });

    await expect(makeService().check('t1', 'r1')).resolves.toEqual({ status: 'DONE' });
    expect(moves()).toContainEqual(['SENDING', expect.objectContaining({ status: 'DONE', doneVia: 'LIQPAY' })]);
  });

  it('never sends a refund', async () => {
    mockLoad.mockResolvedValue({ ...ROW, status: 'SENDING', expectedRefundedUah: 300 });
    mockStatus.mockResolvedValue({ result: 'ok', status: 'success', refund_amount: 0 });

    await expect(makeService().check('t1', 'r1')).resolves.toEqual({ status: 'SENDING' });
    expect(mockRefund).not.toHaveBeenCalled();
    expect(mockMove).not.toHaveBeenCalled();
  });

  it('status API down: still SENDING', async () => {
    mockLoad.mockResolvedValue({ ...ROW, status: 'SENDING', expectedRefundedUah: 300 });
    mockStatus.mockRejectedValue(new Error('down'));
    await expect(makeService().check('t1', 'r1')).resolves.toEqual({ status: 'SENDING' });
  });
});

describe('CancelRefundsService.markDone', () => {
  it('cash DUE → DONE by CASH', async () => {
    mockLoad.mockResolvedValue({ ...ROW, method: 'CASH', paymentId: null, orderId: null });
    await makeService().markDone('t1', 'r1');
    expect(moves()).toEqual([['DUE', expect.objectContaining({ status: 'DONE', doneVia: 'CASH', doneBy: 't1' })]]);
  });

  it('online SENDING → DONE by MANUAL', async () => {
    mockLoad.mockResolvedValue({ ...ROW, status: 'SENDING' });
    await makeService().markDone('t1', 'r1');
    expect(moves()).toEqual([['SENDING', expect.objectContaining({ status: 'DONE', doneVia: 'MANUAL' })]]);
  });

  it('online DUE → 400: the refund is sent from the app', async () => {
    await expect(makeService().markDone('t1', 'r1')).rejects.toBeInstanceOf(BadRequestException);
    expect(mockMove).not.toHaveBeenCalled();
  });

  it('already DONE → 409', async () => {
    mockLoad.mockResolvedValue({ ...ROW, status: 'DONE' });
    await expect(makeService().markDone('t1', 'r1')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('cancel-refund.store', () => {
  it('moveRefund is a compare-and-set on the status it moves from', async () => {
    const chain: any = {
      set: jest.fn(() => chain),
      where: jest.fn(() => chain),
      returning: jest.fn(() => Promise.resolve([])),
    };
    const db: any = { update: jest.fn(() => chain) };

    await expect(
      jest.requireActual('./cancel-refund.store').moveRefund(db, 'r1', 'SENDING', { status: 'DONE' }),
    ).resolves.toBe(false);
    const { sql, params } = new PgDialect().sqlToQuery(chain.where.mock.calls[0][0]);
    expect(sql).toMatch(/"cancel_refunds"\."id" = \$\d+ and "cancel_refunds"\."status" = \$\d+/);
    expect(params).toEqual(['r1', 'SENDING']);
  });

  it('confirmRefundsFromCallback closes SENDING rows of the purchase whose expected total is reached', async () => {
    const chain: any = {
      set: jest.fn(() => chain),
      where: jest.fn(() => chain),
      returning: jest.fn(() => Promise.resolve([{ id: 'r1' }])),
    };
    const db: any = { update: jest.fn(() => chain) };
    const at = new Date('2026-11-06T10:00:00Z');

    await expect(
      jest.requireActual('./cancel-refund.store').confirmRefundsFromCallback(db, 'p1', 300, at),
    ).resolves.toBe(1);
    expect(chain.set).toHaveBeenCalledWith({ status: 'DONE', doneVia: 'LIQPAY', doneAt: at });
    const { sql, params } = new PgDialect().sqlToQuery(chain.where.mock.calls[0][0]);
    expect(sql).toMatch(
      /"cancel_refunds"\."purchase_id" = \$\d+ and "cancel_refunds"\."status" = \$\d+ and "cancel_refunds"\."expected_refunded_uah" <= \$\d+/,
    );
    expect(params).toEqual(['p1', 'SENDING', 300]);
  });
});
