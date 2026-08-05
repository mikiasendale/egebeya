import { Chapa } from 'chapa-nodejs';

let cached: Chapa | null = null;

export function initChapa(): Chapa {
  if (cached) return cached;

  // CHAPA_SECRET_KEY is MANDATORY in every environment. The old code silently
  // fell back to a hardcoded test key — a misconfigured deploy could hit
  // Chapa with an unexpected key or (worse) the value was guessable. Fail
  // loudly instead.
  const secretKey = process.env.CHAPA_SECRET_KEY;
  if (!secretKey) {
    throw new Error('CHAPA_SECRET_KEY is required. Set it in your environment (test key CHASECK_TEST-… in dev).');
  }

  cached = new Chapa({
    secretKey,
    debug: process.env.CHAPA_DEBUG === 'true',
    logging: false,
    timeout: 30000,
  });
  return cached;
}

export interface InitiateDirectChargeResult {
  ref_id: string;
  raw: any;
}

export interface CreateCheckoutParams {
  amountBirr: string;
  txRef: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  returnUrl?: string;
}

export interface CreateCheckoutResult {
  checkoutUrl: string;
  txRef: string;
  raw: any;
}

/**
 * Start a hosted Chapa checkout (card / USSD / mobile-money) and return the
 * URL the customer is redirected to. This is the Pro-billing path — unlike
 * the push-to-phone `directCharge` flow, `initialize` hands back a real
 * `checkout_url` the owner can open to pay. The webhook for the same
 * `tx_ref` confirms completion (see src/api/payments.ts).
 */
export async function createCheckout(opts: CreateCheckoutParams): Promise<CreateCheckoutResult> {
  const chapa = initChapa();
  const response = await chapa.initialize({
    amount: opts.amountBirr,
    tx_ref: opts.txRef,
    currency: 'ETB',
    first_name: opts.firstName,
    last_name: opts.lastName,
    email: opts.email,
    phone_number: opts.phone,
    return_url: opts.returnUrl,
    callback_url: process.env.CHAPA_CALLBACK_URL,
  });

  if (response.status !== 'success' || !response.data?.checkout_url) {
    throw new Error(
      `Chapa initialize failed: ${response.message || 'no checkout_url returned'} (status=${response.status})`,
    );
  }

  return {
    checkoutUrl: response.data.checkout_url,
    txRef: opts.txRef,
    raw: response,
  };
}

export async function initiateDirectCharge(
  phone: string,
  amountBirr: string,
  tx_ref: string,
  firstName: string,
  lastName?: string,
  email?: string,
): Promise<InitiateDirectChargeResult> {
  const chapa = initChapa();
  const response = await chapa.directCharge({
    mobile: phone,
    amount: amountBirr,
    tx_ref,
    currency: 'ETB',
    type: 'telebirr',
    first_name: firstName,
    last_name: lastName,
    email: email,
  });

  if (response.status !== 'success' || !response.data?.meta?.ref_id) {
    throw new Error(
      `Chapa directCharge failed: ${response.message || 'unknown error'} (status=${response.status})`,
    );
  }

  return {
    ref_id: response.data.meta.ref_id,
    raw: response,
  };
}

export interface AuthorizeDirectChargeResult {
  trx_ref: string;
  raw: any;
}

export async function authorizeDirectCharge(reference: string): Promise<AuthorizeDirectChargeResult> {
  const chapa = initChapa();
  const response = await chapa.authorizeDirectCharge({
    reference,
    client: 'egebeya',
    type: 'telebirr',
  });

  if (!response.trx_ref) {
    throw new Error(
      `Chapa authorizeDirectCharge failed: ${response.message || 'no trx_ref returned'}`,
    );
  }

  return {
    trx_ref: response.trx_ref,
    raw: response,
  };
}

export interface VerifyPaymentResult {
  status: 'success' | 'failed' | 'pending' | string;
  amount: string;
  tx_ref: string;
  raw: any;
}

export async function verifyPayment(tx_ref: string): Promise<VerifyPaymentResult> {
  const chapa = initChapa();
  const response = await chapa.verify({ tx_ref });

  return {
    status: response.data?.status || response.status || 'pending',
    amount: response.data?.amount || '',
    tx_ref: response.data?.tx_ref || tx_ref,
    raw: response,
  };
}

export function generateTxRef(prefix?: string): string {
  const chapa = initChapa();
  return chapa.genTxRef(prefix ? { prefix } : undefined);
}

/**
 * Shared webhook secret used to verify HMAC-SHA256 signatures on POST
 * /api/payments/webhook. MANDATORY in every environment — a webhook that is
 * accepted without a verifiable signature can be forged.
 */
export function getWebhookSecret(): string {
  const secret = process.env.CHAPA_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('CHAPA_WEBHOOK_SECRET is required. Set it in your environment.');
  }
  return secret;
}
