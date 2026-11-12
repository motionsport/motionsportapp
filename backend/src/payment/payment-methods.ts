// How a member can pay. PAYMENT_METHODS (comma list) switches them on; LiqPay's code stays when it is off, so old
// orders still finish (callbacks, status, expiry, refunds) and it can be switched back on
export const PAYMENT_METHODS = ['LIQPAY', 'CASH', 'TRANSFER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// The trainer confirms these by hand («Отримано» / «Відхилити»)
export const MANUAL_METHODS: PaymentMethod[] = ['CASH', 'TRANSFER'];

type Env = Record<string, string | undefined>;

// Unset: as before transfers existed (LiqPay when its keys are set, and cash)
export function parsePaymentMethods(env: Env): { methods: PaymentMethod[]; unknown: string[] } {
  const value = env.PAYMENT_METHODS;
  if (value === undefined) {
    return { methods: env.LIQPAY_PUBLIC_KEY ? ['LIQPAY', 'CASH'] : ['CASH'], unknown: [] };
  }
  const names = value
    .split(',')
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);
  const known = (n: string): n is PaymentMethod => (PAYMENT_METHODS as readonly string[]).includes(n);
  return { methods: [...new Set(names.filter(known))], unknown: names.filter((n) => !known(n)) };
}

export const enabledMethods = (env: Env = process.env) => parsePaymentMethods(env).methods;

export const methodEnabled = (method: PaymentMethod, env: Env = process.env) => enabledMethods(env).includes(method);

// The gym's one account for transfers
export type TransferAccount = { recipient: string; iban: string; taxId: string };

export function transferAccount(env: Env = process.env): TransferAccount | null {
  const recipient = env.TRANSFER_RECIPIENT?.trim();
  const iban = env.TRANSFER_IBAN?.replace(/\s/g, '').toUpperCase();
  const taxId = env.TRANSFER_TAX_ID?.trim();
  return recipient && iban && taxId ? { recipient, iban, taxId } : null;
}

// UA + 27 digits, ISO 7064 mod 97 (letters A = 10 … Z = 35)
export function validIban(iban: string): boolean {
  const value = iban.replace(/\s/g, '').toUpperCase();
  if (!/^UA\d{27}$/.test(value)) return false;
  const moved = value.slice(4) + value.slice(0, 4);
  const digits = moved.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  return rest === 1;
}

// ЄДРПОУ (8 digits) or РНОКПП (10)
export const validTaxId = (taxId: string) => /^(\d{8}|\d{10})$/.test(taxId.trim());

// The code in the transfer purpose, so the trainer finds the money: «MG-1A2B3C4D»
export const transferCode = (purchaseId: string) => `MG-${purchaseId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

export const transferPurpose = (purchaseId: string) => `Оплата послуг, ${transferCode(purchaseId)}`;
