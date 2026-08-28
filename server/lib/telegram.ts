/**
 * Telegram bot channel (P3.2).
 *
 * Bot-API constraint that shapes everything here: a bot CANNOT initiate a
 * conversation. Every flow therefore begins from the user:
 *
 *   1. Customer books → confirmation screen shows "ማስታወሻ በ Telegram" which is
 *      a deep link: https://t.me/<bot>?start=<appointment opaqueId>
 *   2. Tapping it opens the chat; Telegram delivers `/start <opaqueId>` to our
 *      webhook (src/api/telegram.ts).
 *   3. The webhook resolves the opaqueId back to the booking's normalized
 *      phone and upserts telegram_links(chat_id, phone, tenant_id,
 *      consent_given_at) — the tap IS the messaging consent (P3.7).
 *   4. From then on confirmations/reminders dispatch through this channel by
 *      phone lookup. Unlinked phones return status 'unlinked' with NO
 *      provider call.
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN        bot token from @BotFather — presence enables the channel
 *   TELEGRAM_WEBHOOK_SECRET   secret token echoed in X-Telegram-Bot-Api-Secret-Token
 *   TELEGRAM_BOT_USERNAME     bot username WITHOUT @ (for deep-link building)
 */

import crypto from 'crypto';
import { db } from '../../src/db';
import { telegramLinks } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { normalizePhone } from '../../src/lib/phone';
import { registerChannel, getChannel, type NotificationChannel, type NotificationRequest, type SendOutcome } from './notifications';

const BOT_TOKEN = () => (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const WEBHOOK_SECRET = () => (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
const BOT_USERNAME = () => (process.env.TELEGRAM_BOT_USERNAME || '').trim();

export function isTelegramConfigured(): boolean {
  return BOT_TOKEN().length > 0;
}

/**
 * Test seam: lets tests inject a fake transport without stubbing global fetch.
 */
type FetchFn = typeof fetch;
let activeFetch: FetchFn = (...args) => globalThis.fetch(...(args as Parameters<FetchFn>));
export function __setTelegramFetch(fn: FetchFn | null): void {
  activeFetch = fn ?? ((...args) => globalThis.fetch(...(args as Parameters<FetchFn>)));
}

/** Deep link that starts the opt-in flow from a booking reference. */
export function buildTelegramDeepLink(startParam: string): string | null {
  const username = BOT_USERNAME();
  if (!username) return null;
  // startparam allows A-Z a-z 0-9 _ - and ≤64 chars — opaqueIds are hex, safe.
  return `https://t.me/${username}?start=${encodeURIComponent(startParam)}`;
}

/** Look up the linked chat for a canonical phone. */
export async function getTelegramLinkByPhone(phone: string): Promise<{ chatId: string; consentGivenAt: number } | null> {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const row = await db.select({
    chatId: telegramLinks.chatId,
    consentGivenAt: telegramLinks.consentGivenAt,
  }).from(telegramLinks).where(eq(telegramLinks.phone, normalized)).get();
  return row ? { chatId: row.chatId, consentGivenAt: row.consentGivenAt } : null;
}

async function sendMessage(chatId: string, text: string): Promise<SendOutcome> {
  try {
    const res = await activeFetch(`https://api.telegram.org/bot${BOT_TOKEN()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        ok: false,
        status: 'failed',
        error: `telegram_http_${res.status}${body ? `:${body.slice(0, 200)}` : ''}`,
      };
    }
    const data: any = await res.json().catch(() => null);
    return {
      ok: true,
      providerId: data?.result?.message_id != null ? String(data.result.message_id) : undefined,
      status: 'sent',
    };
  } catch (err: any) {
    return { ok: false, status: 'failed', error: err?.message || String(err) };
  }
}

export const telegramChannel: NotificationChannel = {
  name: 'telegram',
  isEnabled: () => isTelegramConfigured(),
  supports: (req: NotificationRequest) => Boolean(req.to.phone),
  async send(req): Promise<SendOutcome> {
    const link = await getTelegramLinkByPhone(req.to.phone as string);
    // Bot cannot initiate: an unlinked phone must NOT produce any provider call.
    if (!link) {
      return { ok: false, status: 'unlinked', error: 'no_telegram_link' };
    }
    return sendMessage(link.chatId, req.text);
  },
};

// Register only when configured so notify() reports 'failed:unknown_channel'
// rather than 'unlinked' on a deployment that never opted into Telegram.
if (isTelegramConfigured()) {
  registerChannel(telegramChannel);
}

/** Test/bootstrap helper: force-register (idempotent). */
export function ensureTelegramRegistered(): void {
  if (getChannel('telegram') === undefined) registerChannel(telegramChannel);
}

/**
 * Upsert a chat link (the webhook's /start handler). The user tapping Start
 * IS the consent act — timestamped here. Idempotent per chat; re-links update
 * phone/tenant and refresh the consent stamp.
 */
export async function linkChat(input: {
  chatId: string;
  phone: string;
  tenantId?: string | null;
}): Promise<{ linked: true; phone: string }> {
  const normalized = normalizePhone(input.phone);
  if (!normalized) throw new Error('Invalid Ethiopian phone number');
  const now = Date.now();
  await db.insert(telegramLinks).values({
    chatId: input.chatId,
    phone: normalized,
    tenantId: input.tenantId ?? null,
    consentGivenAt: now,
    linkedAt: now,
  }).onConflictDoUpdate({
    target: telegramLinks.chatId,
    set: {
      phone: normalized,
      tenantId: input.tenantId ?? null,
      consentGivenAt: now,
      linkedAt: now,
    },
  });
  return { linked: true, phone: normalized };
}

/** Redact a chat id for logs — never persist raw identifiers in security events. */
export function redactChatId(chatId: string): string {
  return chatId.length > 4 ? `***${chatId.slice(-4)}` : '***';
}

// Re-exported for the webhook route's constant-time secret comparison.
export function verifyWebhookSecret(headerValue: string | undefined): boolean {
  const expected = WEBHOOK_SECRET();
  if (!expected) return false;
  const given = (headerValue || '').trim();
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
