/**
 * Cloudflare Turnstile server-side token verifier.
 *
 * The widget on the client produces a single-use `cf-turnstile-response`
 * token. The backend MUST POST that token along with the secret key to
 * Cloudflare's siteverify endpoint before trusting the request — a token
 * that is missing, already-used, or expired fails verification. We treat a
 * missing secret key as "Turnstile disabled in this environment" so dev
 * instances without a secret don't 500; the booking flow still verifies the
 * token when a secret IS configured, mirroring production.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerifyResult {
  success: boolean;
  /** "missing-input-secret", "invalid-input-response", "bad-request", ... */
  'error-codes'?: string[];
  action?: string;
  cdata?: string;
  hostname?: string;
}

export class TurnstileNotConfiguredError extends Error {}

/**
 * Returns true when the operator has not pasted a Turnstile secret. Callers
 * use this to decide whether to enforce the token check at all: in dev with
 * no keys configured we still want bookings to flow during local testing,
 * but in prod (any non-empty secret) we hard-enforce it.
 */
export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
}

/**
 * Verify a Turnstile token server-side. Throws TurnstileNotConfiguredError
 * when no secret is set so callers can decide how to react (skip enforcement
 * vs. surface a config error). Returns Cloudflare's raw result envelope.
 */
export async function verifyTurnstileToken(token: string | undefined, remoteip?: string): Promise<TurnstileVerifyResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) throw new TurnstileNotConfiguredError('TURNSTILE_SECRET_KEY not set');

  const body = new URLSearchParams();
  body.append('secret', secret);
  if (token) body.append('response', token);
  if (remoteip) body.append('remoteip', remoteip);

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      // Cloudflare returns 200 even for invalid tokens; a non-200 here means
      // transport failure (their endpoint down, network cut). Surface that as
      // a hard fail so we never silently accept a token under outage.
      return { success: false, 'error-codes': ['verify-http-' + res.status] };
    }
    return (await res.json()) as TurnstileVerifyResult;
  } catch (err: any) {
    return { success: false, 'error-codes': ['verify-transport-' + String(err?.name || 'unknown')] };
  }
}
