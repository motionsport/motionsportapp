import { parsePaymentMethods, transferCode, validIban, validTaxId } from './payment-methods';
import { NBU_QR_MAX_BYTES, nbuAmount, nbuBankLinks, nbuQrPayload, nbuQrUrl } from './nbu-qr';

describe('parsePaymentMethods', () => {
  it('unset: LiqPay when its keys are set, and cash (as before transfers)', () => {
    expect(parsePaymentMethods({ LIQPAY_PUBLIC_KEY: 'k' }).methods).toEqual(['LIQPAY', 'CASH']);
    expect(parsePaymentMethods({}).methods).toEqual(['CASH']);
  });

  it('a comma list, any case and spaces; unknown names reported', () => {
    expect(parsePaymentMethods({ PAYMENT_METHODS: ' cash , Transfer,CASH' })).toEqual({
      methods: ['CASH', 'TRANSFER'],
      unknown: [],
    });
    expect(parsePaymentMethods({ PAYMENT_METHODS: 'CASH,CARD' }).unknown).toEqual(['CARD']);
  });

  it('an empty list switches every method off', () => {
    expect(parsePaymentMethods({ PAYMENT_METHODS: '', LIQPAY_PUBLIC_KEY: 'k' }).methods).toEqual([]);
  });
});

describe('transfer account', () => {
  it('IBAN: UA + 27 digits with a valid mod 97 checksum, spaces allowed', () => {
    expect(validIban('UA213223130000026007233566001')).toBe(true);
    expect(validIban('UA21 3223 1300 0002 6007 2335 6600 1')).toBe(true);
    expect(validIban('UA213223130000026007233566002')).toBe(false);
    expect(validIban('UA21322313000002600723356600')).toBe(false);
    expect(validIban('DE89370400440532013000')).toBe(false);
  });

  it('tax id: ЄДРПОУ 8 digits or РНОКПП 10', () => {
    expect(validTaxId('12345678')).toBe(true);
    expect(validTaxId('1234567890')).toBe(true);
    expect(validTaxId('123456789')).toBe(false);
    expect(validTaxId('12345abc')).toBe(false);
  });

  it('the code in the purpose: MG- and the purchase id start', () => {
    expect(transferCode('1a2b3c4d-5e6f-4000-8000-000000000000')).toBe('MG-1A2B3C4D');
  });
});

describe('NBU QR', () => {
  const transfer = {
    recipient: 'ФОП Тренер',
    iban: 'UA213223130000026007233566001',
    taxId: '1234567890',
    amountUah: 1500,
    reference: 'MG-1A2B3C4D',
    purpose: 'Оплата послуг, MG-1A2B3C4D',
  };

  // постанова НБУ № 97, додаток 4, таблиця 2
  it('format 003, UTF-8, 17 lines', () => {
    expect(nbuQrPayload(transfer).split('\n')).toEqual([
      'BCD',
      '003',
      '1',
      'XCT',
      '',
      'ФОП Тренер',
      'UA213223130000026007233566001',
      'UAH1500',
      '1234567890',
      'OTHR/OTHR',
      'MG-1A2B3C4D',
      'Оплата послуг, MG-1A2B3C4D',
      '',
      'FFFF',
      '',
      '',
      '',
    ]);
  });

  it('amount as short as possible: no .00, kopecks as two digits', () => {
    expect(nbuAmount(3)).toBe('UAH3');
    expect(nbuAmount(1500)).toBe('UAH1500');
    expect(nbuAmount(576.45)).toBe('UAH576.45');
    expect(nbuAmount(100.5)).toBe('UAH100.50');
  });

  it('the longest recipient still fits the 507 bytes', () => {
    const payload = nbuQrPayload({ ...transfer, recipient: 'Ж'.repeat(140) });
    expect(Buffer.byteLength(payload, 'utf8')).toBeLessThanOrEqual(NBU_QR_MAX_BYTES);
  });

  it('the link: qr.bank.gov.ua + Base64URL without padding, decodes back to the payload', () => {
    const url = nbuQrUrl(transfer);
    expect(url).toMatch(/^https:\/\/qr\.bank\.gov\.ua\/[A-Za-z0-9_-]+$/);
    const encoded = url.slice('https://qr.bank.gov.ua/'.length);
    expect(Buffer.from(encoded, 'base64url').toString('utf8')).toBe(nbuQrPayload(transfer));
  });

  it("bank buttons: each bank's start link with the same data", () => {
    const data = nbuQrUrl(transfer).slice('https://qr.bank.gov.ua/'.length);
    expect(nbuBankLinks(transfer)).toEqual({
      privat24: `https://www.privat24.ua/rd/send_qr/nbu/${data}`,
      monobank: `https://mbnk.app/qr/${data}`,
    });
  });
});
