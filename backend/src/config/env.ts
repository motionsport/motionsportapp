// Checked before Nest starts, so a bad env fails fast with a list of problems. Full list: backend/.env.example
import { PAYMENT_METHODS, parsePaymentMethods, validIban, validTaxId } from '../payment/payment-methods';

type Env = Record<string, string | undefined>;

const isUrl = (value: string) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

// All of a feature's variables or none (feature off); a partial set is an error
function wholeGroup(env: Env, feature: string, names: string[]): string[] {
  const missing = names.filter((name) => !env[name]);
  if (missing.length === 0 || missing.length === names.length) return [];
  return [`${feature}: ${missing.join(', ')} missing (set all of ${names.join(', ')}, or none)`];
}

export function envProblems(env: Env): string[] {
  const problems: string[] = [];

  for (const name of ['DATABASE_URL', 'FRONTEND_URL']) {
    if (!env[name]) problems.push(`${name} is missing`);
    else if (!isUrl(env[name])) problems.push(`${name} is not a URL`);
  }

  // Without it every cron run answers 403
  if (env.NODE_ENV === 'production' && !env.CRON_SECRET)
    problems.push('CRON_SECRET is missing (required in production)');

  problems.push(...wholeGroup(env, 'LiqPay', ['LIQPAY_PUBLIC_KEY', 'LIQPAY_PRIVATE_KEY', 'LIQPAY_SERVER_URL']));
  // LiqPay calls this URL itself: with /api it gets a 404 and payments hang in PENDING
  if (
    env.LIQPAY_SERVER_URL &&
    isUrl(env.LIQPAY_SERVER_URL) &&
    new URL(env.LIQPAY_SERVER_URL).pathname.startsWith('/api/')
  )
    problems.push('LIQPAY_SERVER_URL must not start with /api (https://<backend>/payments/liqpay/callback)');

  const { methods, unknown } = parsePaymentMethods(env);
  if (unknown.length)
    problems.push(`PAYMENT_METHODS: unknown ${unknown.join(', ')} (use ${PAYMENT_METHODS.join(', ')})`);
  if (methods.includes('LIQPAY') && !env.LIQPAY_PUBLIC_KEY)
    problems.push('PAYMENT_METHODS has LIQPAY, but the LIQPAY_* keys are missing');

  const transferNames = ['TRANSFER_RECIPIENT', 'TRANSFER_IBAN', 'TRANSFER_TAX_ID'];
  problems.push(...wholeGroup(env, 'Transfer', transferNames));
  if (methods.includes('TRANSFER') && !env.TRANSFER_IBAN)
    problems.push(`PAYMENT_METHODS has TRANSFER, but ${transferNames.join(', ')} are missing`);
  if (env.TRANSFER_IBAN && !validIban(env.TRANSFER_IBAN))
    problems.push('TRANSFER_IBAN is not a valid Ukrainian IBAN (UA + 27 digits)');
  // NBU payment link: the recipient field holds up to 140 characters
  if (env.TRANSFER_RECIPIENT && env.TRANSFER_RECIPIENT.trim().length > 140)
    problems.push('TRANSFER_RECIPIENT must be at most 140 characters');
  if (env.TRANSFER_TAX_ID && !validTaxId(env.TRANSFER_TAX_ID))
    problems.push('TRANSFER_TAX_ID must be 8 digits (ЄДРПОУ) or 10 (РНОКПП)');

  problems.push(...wholeGroup(env, 'Push', ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']));

  if (env.PORT !== undefined && !/^[1-9]\d*$/.test(env.PORT)) problems.push('PORT must be a positive whole number');

  return problems;
}

export function validateEnv(env: Env = process.env) {
  const problems = envProblems(env);
  if (problems.length) throw new Error(`Invalid environment:\n- ${problems.join('\n- ')}`);
}
