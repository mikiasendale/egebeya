/**
 * Telegram bot webhook (P3.2).
 *
 * POST /api/telegram/webhook — Telegram's one-way push of updates to us.
 * Auth: Telegram echoes the secret token we set via setWebhook in the
 * X-Telegram-Bot-Api-Secret-Token header. Verified with a constant-time
 * comparison (Chapa HMAC pattern); mismatch → 401 + security_events row.
 *
 * Handled updates:
 *   /start <opaqueId> — the opt-in deep link from a booking confirmation.
 *     Resolves the booking's normalized phone and links the chat
 *     (consent timestamped — P3.7). Idempotent per chat.
 *   anything else — acked 200 (Telegram retries non-2xx forever) + logged.
 *
 * The route NEVER 4xx/5xx on business errors: only auth failures fail hard.
 */
import { Router } from 'express';
import { db } from '../db';
import { appointments, telegramLinks } from '../db/schema';
import { eq } from 'drizzle-orm';
import { normalizePhone } from '../lib/phone';
import { logSecurityEvent, ipFromRequest } from '../../server/lib/securityLog';
import {
  verifyWebhookSecret,
  linkChat,
  redactChatId,
} from '../../server/lib/telegram';

const router = Router();

/**
 * SOP NOTE (data handling): chat ids are identifiers under PDPL 1321/2024.
 * They are stored once in telegram_links; security events carry only the
 * last 4 digits via redactChatId().
 */
router.post('/webhook', async (req, res) => {
  const headerName = 'x-telegram-bot-api-secret-token';
  const provided = req.headers[headerName] as string | undefined;

  if (!verifyWebhookSecret(provided)) {
    logSecurityEvent({
      type: 'webhook_signature_rejected',
      ip: ipFromRequest(req),
      result: 'failure',
      details: { surface: 'telegram_webhook', reason: 'secret_token_mismatch' },
    });
    return res.status(401).json({ error: 'Invalid secret token' });
  }

  try {
    const update = (req.body ?? {}) as any;
    const message = update.message;
    const text: string = typeof message?.text === 'string' ? message.text : '';
    const chatId: string | undefined =
      message?.chat?.id != null ? String(message.chat.id) : undefined;

    if (!message || !chatId) {
      // Non-message updates (edits, callback queries) are acked, not acted on.
      return res.json({ ok: true });
    }

    if (text.startsWith('/start')) {
      // Payload after "/start " — the booking opaqueId from the deep link.
      const payload = text.slice('/start'.length).trim();

      if (!payload) {
        // Bare /start without a booking reference: nothing to link. The bot
        // cannot ask for a phone over an unlinked chat safely here, so we ack.
        logSecurityEvent({
          type: 'telegram_start_no_payload',
          ip: ipFromRequest(req),
          result: 'failure',
          details: { chatId: redactChatId(chatId) },
        });
        return res.json({ ok: true, linked: false });
      }

      // Deep-link payloads are appointment opaqueIds (unguessable public ids).
      const appt = await db.select({
        id: appointments.id,
        tenantId: appointments.tenantId,
        customerPhone: appointments.customerPhone,
      }).from(appointments).where(eq(appointments.opaqueId, payload)).get();

      if (!appt) {
        logSecurityEvent({
          type: 'telegram_link_unknown_ref',
          ip: ipFromRequest(req),
          result: 'failure',
          details: { chatId: redactChatId(chatId), refPrefix: payload.slice(0, 6) },
        });
        return res.json({ ok: true, linked: false });
      }

      const normalized = normalizePhone(appt.customerPhone);
      if (!normalized) {
        return res.json({ ok: true, linked: false });
      }

      await linkChat({ chatId, phone: normalized, tenantId: appt.tenantId });

      // Sanity audit row: consent captured at link time.
      const linked = await db.select({ consentGivenAt: telegramLinks.consentGivenAt })
        .from(telegramLinks).where(eq(telegramLinks.chatId, chatId)).get();
      logSecurityEvent({
        type: 'telegram_chat_linked',
        tenantId: appt.tenantId,
        ip: ipFromRequest(req),
        result: 'success',
        details: {
          chatId: redactChatId(chatId),
          phonePrefix: normalized.slice(0, 7) + '****',
          consentGivenAt: linked?.consentGivenAt ?? null,
        },
      });

      return res.json({ ok: true, linked: true });
    }

    // Any other text: ack politely; v1 bot is send-only plus /start linking.
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[telegram-webhook] handler error:', err?.message || err);
    // Still 200 so Telegram does not hot-retry a deterministic failure.
    return res.json({ ok: false, error: 'internal' });
  }
});

export default router;
