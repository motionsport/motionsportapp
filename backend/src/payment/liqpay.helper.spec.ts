import { liqpayDecode, liqpayRefund, liqpaySign } from './liqpay.helper';

describe('liqpayRefund', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('sends a signed refund of the amount for the order', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ result: 'ok', status: 'reversed' }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const resp = await liqpayRefund('pub', 'priv', 'mg-1', 300);

    expect(resp).toEqual({ result: 'ok', status: 'reversed' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://www.liqpay.ua/api/request');
    const body = init.body as URLSearchParams;
    const data = body.get('data')!;
    expect(liqpayDecode(data)).toEqual({
      version: 3,
      public_key: 'pub',
      action: 'refund',
      order_id: 'mg-1',
      amount: 300,
    });
    expect(body.get('signature')).toBe(liqpaySign('priv', data));
  });

  it('throws when LiqPay answers with an HTTP error, so the outcome stays unknown', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502 }) as unknown as typeof fetch;
    await expect(liqpayRefund('pub', 'priv', 'mg-1', 300)).rejects.toThrow();
  });
});
