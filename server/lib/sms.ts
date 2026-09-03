/**
 * SMS delivery layer mirroring server/lib/mailer.ts.
 *
 * Provider: SMSEthiopia (https://smsethiopia.com — API reference under
 * #/api-reference). Contract:
 *   POST https://smsethiopia.com/api/v2/sms/send
 *   Headers: KEY: <SMS_API_KEY>, Content-Type: application/json
 *   Body:    { "msisdn": "2519XXXXXXXXX", "text": "..." }   // no leading +
 *   Success: { "sent": true, "id": "01JZX…", "description": "Accepted for
 *              delivery", "segments": 1, "status": "ACCEPTED" }
 *   Failure: non-2xx, or JSON with sent !== true and an error_message/code
 *             (10007 recipient not whitelisted, 10006 sender ID pending, …).
 *
 * The sender ID is campaign-scoped to the API key on the SMSEthiopia side —
 * no "from" field is sent.
 *
 * Failure semantics (by design — failed sends are logged outcomes, never
 * incidents): this function NEVER throws on provider errors and NEVER
 * reports success for a message that did not reach a provider.
 *   - SMS_API_KEY unset → { success: false } + UNCONFIGURED log (no fetch).
 *   - Malformed phone   → throws BEFORE any network call (input validation,
 *     unchanged contract; callers treat it as a programming/precondition
 *     error, not a delivery outcome).
 *
 * Env: SMS_API_KEY (required for real sends; no other env vars).
 */

import { normalizePhone } from '../../src/lib/phone';

const API_KEY = (process.env.SMS_API_KEY || '').trim();
const SMS_ETHIOPIA_SEND_URL = 'https://smsethiopia.com/api/v2/sms/send';
const FETCH_TIMEOUT_MS = 15_000;

function redactPhone(phone: string): string {
  // Show the country prefix and first 3 digits, mask the rest.
  // +251911234567 → +251911****
  if (phone.length >= 7) {
    return phone.slice(0, 7) + '****';
  }
  return phone.slice(0, 3) + '****';
}

export interface SmsOptions {
  /** Canonical Ethiopian phone in +251XXXXXXXXX format (will be normalized). */
  to: string;
  /** SMS body — truncated to 480 chars by most Ethiopian gateways. */
  text: string;
  /** Optional template id for the provider's campaign tracking. */
  templateId?: string;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an SMS to an Ethiopian phone number through SMSEthiopia.
 *
 * Phone normalization happens via normalizePhone — malformed numbers are
 * rejected BEFORE any HTTP call. Provider errors (HTTP, network, provider
 * refusal) resolve to { success: false, error } — they never throw and they
 * never masquerade as success.
 */
export async function sendSms(options: SmsOptions): Promise<SmsResult> {
  // Normalize the phone first so we don't leak garbage to the provider.
  const normalized = normalizePhone(options.to);
  if (!normalized) {
    const err = new Error(`Invalid Ethiopian phone number: "${redactPhone(String(options.to))}"`);
    console.error('[SMS] Rejected malformed phone before dispatch:', err.message);
    throw err;
  }

  // Truncate text to a safe GSM-7 480-char SMS boundary (the gateway will
  // split longer texts into multiple segments, but 480 chars is a safe
  // single-segment upper bound).
  const body = options.text.length > 480 ? options.text.slice(0, 477) + '…' : options.text;

  // Honest unconfigured state: nothing was sent, so nothing may claim success.
  if (!API_KEY) {
    console.log(`[SMS UNCONFIGURED] SMS_API_KEY not set — message NOT sent to: ${redactPhone(normalized)}, body: ${body.slice(0, 80)}`);
    return { success: false, error: 'SMS provider not configured (SMS_API_KEY unset)' };
  }

  // SMSEthiopia expects the msisdn WITHOUT the leading "+".
  const msisdn = normalized.replace(/^\+/, '');

  try {
    const res = await fetch(SMS_ETHIOPIA_SEND_URL, {
      method: 'POST',
      headers: {
        'KEY': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ msisdn, text: body }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    const data: any = await res.json().catch(() => null);

    if (!res.ok) {
      const providerError = data?.error_message || data?.description || `HTTP ${res.status}`;
      console.error(`[SMS] Delivery failed for ${redactPhone(normalized)}: ${String(providerError).slice(0, 200)}`);
      return { success: false, error: `sms_ethiopia_${String(providerError).slice(0, 120)}` };
    }

    if (data?.sent !== true || !data?.id) {
      const providerError = data?.error_message || data?.description || 'provider refused the message';
      console.error(`[SMS] Provider refused send for ${redactPhone(normalized)}: ${String(providerError).slice(0, 200)}`);
      return { success: false, error: `sms_ethiopia_${String(providerError).slice(0, 120)}` };
    }

    console.log(`[SMS] Queued for ${redactPhone(normalized)} (id=${String(data.id).slice(0, 12)}…, status=${data.status ?? 'unknown'})`);
    return { success: true, messageId: String(data.id) };
  } catch (error: any) {
    // Network/timeout/parse failure — an honest failed outcome, never a throw.
    console.error(`[SMS] Delivery failed for ${redactPhone(normalized)}:`, error?.message || error);
    return { success: false, error: error?.message ? String(error.message).slice(0, 120) : 'network error' };
  }
}
