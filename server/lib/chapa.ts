import { Chapa } from 'chapa-nodejs';

let cached: Chapa | null = null;

export function initChapa(): Chapa {
  if (cached) return cached;

  let secretKey = process.env.CHAPA_SECRET_KEY;
  if (!secretKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CHAPA_SECRET_KEY is required in production');
    }
    secretKey = 'CHASECK_TEST-g3pDAuHMdioBphvmSN0ETveYu5KPaDD5';
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
    client: '',
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
 * /api/payments/webhook. In production the env var is required; in dev we
 * fall back to Chapa's documented test encryption key so local tests pass
 * without configuration.
 */
export function getWebhookSecret(): string {
  const secret = process.env.CHAPA_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CHAPA_WEBHOOK_SECRET is required in production');
    }
    return 'CyNDCzoXF7JsaPig6GErkdT0';
  }
  return secret;
}
