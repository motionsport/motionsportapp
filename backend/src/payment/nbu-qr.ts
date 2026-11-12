// NBU payment link, format 003: постанова НБУ від 19.08.2025 № 97 «Правила формування, передачі та обробки структури
// даних і графічного зображення QR-коду…», додаток 4 (https://bank.gov.ua/admin_uploads/law/19082025_97.pdf).
// Members pay from the phone the app is on, so no QR picture: buttons open a bank app with the transfer filled in.
// The generic https://qr.bank.gov.ua/ link only shows the NBU page on a phone (checked 2026-11-12), so each button
// uses that bank's own start link with the same data (додаток 4, таблиця 1: «персоніфікований код старту
// застосунку»). Links from skules777/nbu-qr-code-swift, where they were checked by paying on an iPhone
import type { TransferAccount } from './payment-methods';

export const NBU_QR_BASE = 'https://qr.bank.gov.ua/';
export const BANK_START_LINKS = {
  privat24: 'https://www.privat24.ua/rd/send_qr/nbu/',
  monobank: 'https://mbnk.app/qr/',
} as const;
export type BankLinks = Record<keyof typeof BANK_START_LINKS, string>;
// Додаток 4, п. 8: the data before Base64URL
export const NBU_QR_MAX_BYTES = 507;

export type NbuTransfer = TransferAccount & { amountUah: number; reference: string; purpose: string };

// Додаток 4, п. 8 of the field notes: as short as possible ("UAH3", not "UAH3.00"); kopecks as two digits
export function nbuAmount(amountUah: number): string {
  const kopecks = Math.round(amountUah * 100);
  const whole = Math.floor(kopecks / 100);
  const rest = kopecks % 100;
  return `UAH${whole}${rest ? `.${String(rest).padStart(2, '0')}` : ''}`;
}

// Додаток 4, таблиця 2: 17 fields, each ended by LF (п. 7); an empty field is the line end alone
export function nbuQrPayload(t: NbuTransfer): string {
  return [
    'BCD', // 1 службова мітка
    '003', // 2 версія формату
    '1', // 3 кодування: UTF-8
    'XCT', // 4 функція: миттєвий або звичайний кредитовий переказ, на вибір платника
    '', // 5 унікальний ідентифікатор отримувача (резерв)
    t.recipient.slice(0, 140), // 6 отримувач
    t.iban, // 7 рахунок отримувача
    nbuAmount(t.amountUah), // 8 сума / валюта
    t.taxId, // 9 код отримувача
    'OTHR/OTHR', // 10 категорія / ціль (ISO 20022), обов'язкове
    t.reference.slice(0, 35), // 11 reference: identifies the purchase, the payer can't change it
    t.purpose.slice(0, 140), // 12 призначення платежу
    '', // 13 відображення (дисплей)
    'FFFF', // 14 код заборони зміни полів: the payer changes nothing (amount and purpose included)
    '', // 15 дата / час дії рахунку
    '', // 16 дата / час формування рахунку
    '', // 17 електронний підпис (резерв)
  ].join('\n');
}

// Додаток 4, таблиця 1: the start code, then Base64URL (no padding)
const encoded = (t: NbuTransfer) => Buffer.from(nbuQrPayload(t), 'utf8').toString('base64url');

export const nbuQrUrl = (t: NbuTransfer) => NBU_QR_BASE + encoded(t);

export function nbuBankLinks(t: NbuTransfer): BankLinks {
  const data = encoded(t);
  return { privat24: BANK_START_LINKS.privat24 + data, monobank: BANK_START_LINKS.monobank + data };
}
