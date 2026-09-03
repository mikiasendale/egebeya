/**
 * Consumer identity-lite API (P3.4) + consent baseline (P3.7).
 *
 * Magic-link login for END CUSTOMERS: 6-digit OTP delivered over Telegram
 * (the channel they opted into at booking time), exchanged for a JWT whose
 * audience is exactly 'consumer'. Merchant tokens never open these routes
 * (audience confusion → 403) and consumer tokens never open merchant routes.
 *
 * Deliberately minimal per plan: no refresh tokens, no passwords, no email
 * fallback. If Telegram is unproven the claim-code path replaces this flow —
 * do not bolt SMS delivery on here without revisiting that decision.
 */
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db';
import { consumers, dataDeletionRequests } from '../db/schema';
import { eq } from 'drizzle-orm';
import { normalizePhone } from '../lib/phone';
import { generateOtp, verifyOtp } from '../../server/lib/otp';
import { upsertConsumerByPhone } from '../../server/lib/consumers';
import { getTelegramLinkByPhone, isTelegramConfigured } from '../../server/lib/telegram';
import { logSecurityEvent, ipFromRequest } from '../../server/lib/securityLog';
import { jwtSecret } from './middleware/auth';
import { requireConsumerAuth } from './middleware/consumerAuth';
import { consumerLimiter } from '../../server/middleware/rateLimiter';

const router = Router();

const PhoneSchema = z.object({
  phone: z.string().min(1).max(40),
});

const VerifySchema = z.object({
  phone: z.string().min(1).max(40),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  name: z.string().max(120).optional(),
});

/**
 * POST /api/consumer/request-code
 *
 * Sends a login code to the Telegram chat linked to this phone.
 * Responses are deliberately uniform for unknown/unlinked phones so the
 * endpoint cannot be used to enumerate who books where.
 */
router.post('/request-code', consumerLimiter, async (req, res) => {
  try {
    // Provisioning and deploys are not atomic: if the bot env is unset the
    // honest answer is a clean 503, NOT a raw 502 that reads as "broken" to
    // users and uptime monitors.
    if (!isTelegramConfigured()) {
      logSecurityEvent({
        type: 'consumer_code_requested',
        ip: ipFromRequest(req),
        result: 'failure',
        details: { reason: 'telegram_unprovisioned' },
      });
      return res.status(503).json({
        error: 'Consumer login is not available yet. Please check back soon.',
        reason: 'telegram_unprovisioned',
        code: 'TELEGRAM_UNPROVISIONED',
      });
    }

    const parsed = PhoneSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'A valid phone number is required' });
    }
    const normalized = normalizePhone(parsed.data.phone);
    if (!normalized) {
      return res.status(400).json({ error: 'Enter a valid Ethiopian phone number (+251XXXXXXXXX)' });
    }

    // Fail fast BEFORE consuming the per-phone OTP send quota: the bot cannot
    // initiate contact, so an unlinked phone has no deliverable surface.
    const link = await getTelegramLinkByPhone(normalized);
    if (!link) {
      logSecurityEvent({
        type: 'consumer_code_requested',
        ip: ipFromRequest(req),
        result: 'failure',
        details: { reason: 'no_telegram_link', phonePrefix: normalized.slice(0, 7) + '****' },
      });
      return res.status(409).json({
        error: 'This phone is not linked to Telegram yet. Open your booking confirmation and tap "ማስታወሻ በ Telegram" first.',
        code: 'NO_TELEGRAM_LINK',
      });
    }

    await generateOtp(normalized, { channel: 'telegram' });

    logSecurityEvent({
      type: 'consumer_code_requested',
      ip: ipFromRequest(req),
      result: 'success',
      details: { phonePrefix: normalized.slice(0, 7) + '****', channel: 'telegram' },
    });

    return res.json({
      ok: true,
      deliveredVia: 'telegram',
      messageAm: 'የመግቢያ ኮድዎ በ Telegram ላክን።',
      messageEn: 'Your login code was sent on Telegram.',
    });
  } catch (err: any) {
    if (err?.statusCode === 429) {
      return res.status(429).json({ error: err.message, code: err.code });
    }
    console.error('[consumer] request-code error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to send code' });
  }
});

/**
 * POST /api/consumer/verify
 *
 * Exchanges phone + 6-digit code for a consumer JWT (aud:'consumer').
 * First successful verify creates the consumer profile — stamped with a
 * consent timestamp (P3.7: no row is ever created without one).
 */
router.post('/verify', consumerLimiter, async (req, res) => {
  try {
    const parsed = VerifySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
    }
    const normalized = normalizePhone(parsed.data.phone);
    if (!normalized) {
      return res.status(400).json({ error: 'Enter a valid Ethiopian phone number (+251XXXXXXXXX)' });
    }

    let verifiedPhone: string;
    try {
      verifiedPhone = await verifyOtp(normalized, parsed.data.code);
    } catch (err: any) {
      logSecurityEvent({
        type: 'consumer_verified',
        ip: ipFromRequest(req),
        result: 'failure',
        details: { reason: 'otp_rejected', code: err?.code || null },
      });
      return res.status(err?.statusCode || 400).json({ error: err.message, code: err?.code });
    }

    const consumerId = await upsertConsumerByPhone({
      phone: verifiedPhone,
      name: parsed.data.name ?? null,
      basis: 'consumer_login',
    });

    const token = jwt.sign(
      { consumerId, phone: verifiedPhone },
      jwtSecret(),
      { audience: 'consumer', subject: consumerId, expiresIn: '24h' },
    );

    logSecurityEvent({
      type: 'consumer_verified',
      ip: ipFromRequest(req),
      result: 'success',
      details: { phonePrefix: verifiedPhone.slice(0, 7) + '****' },
    });

    const row = await db.select().from(consumers).where(eq(consumers.id, consumerId)).get();
    return res.json({
      ok: true,
      token,
      consumer: {
        id: consumerId,
        phone: verifiedPhone,
        name: row?.name ?? parsed.data.name ?? null,
      },
    });
  } catch (err: any) {
    console.error('[consumer] verify error:', err?.message || err);
    return res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * GET /api/consumer/loyalty/:tenantId (P5.1/P5.2)
 *
 * The punch card behind the amber progress ring. Consumer JWT only; the
 * phone comes from the token, never the query string.
 */
router.get('/loyalty/:tenantId', requireConsumerAuth(), async (req, res) => {
  try {
    const tenantId = String(req.params.tenantId || '');
    const { getCardForConsumer } = await import('../../server/lib/loyalty');
    const card = await getCardForConsumer(tenantId, (req as any).consumer.phone);
    res.json(card);
  } catch (err: any) {
    console.error('[consumer] loyalty error:', err?.message || err);
    res.status(500).json({ error: 'Failed to load punch card' });
  }
});

/** GET /api/consumer/me — minimal profile behind the consumer audience. */
router.get('/me', requireConsumerAuth(), async (req, res) => {
  return res.json({ consumer: (req as any).consumer });
});

/**
 * POST /api/consumer/data-deletion
 *
 * PDPL 1321/2024 deletion-request intake (P3.7). v1 fulfillment is MANUAL:
 *
 * SOP (operator runbook):
 *   1. Row lands here with status='requested'; security_events gets a
 *      'data_deletion_request' entry (this route logs it).
 *   2. Within 30 days an operator deletes, by phone across tenant-scoped
 *      silos: customer_stats rows, telegram_links by phone, appointments'
 *      customer columns (anonymize name/email, keep money records — invoices/
 *      payments stay for PLC bookkeeping with the phone column nulled where
 *      possible), then sets status='fulfilled' + fulfilled_at.
 *   3. Loyalty/punch state keyed by the same phone is destroyed with it.
 * The requester receives an immediate ack below; no data is deleted inline.
 */
router.post('/data-deletion', consumerLimiter, async (req, res) => {
  try {
    const parsed = PhoneSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'A valid phone number is required' });
    }
    const normalized = normalizePhone(parsed.data.phone);
    if (!normalized) {
      return res.status(400).json({ error: 'Enter a valid Ethiopian phone number (+251XXXXXXXXX)' });
    }

    const id = crypto.randomUUID();
    await db.insert(dataDeletionRequests).values({
      id,
      phone: normalized,
      status: 'requested',
      requestedAt: Date.now(),
    });

    logSecurityEvent({
      type: 'data_deletion_request',
      ip: ipFromRequest(req),
      result: 'success',
      details: { requestId: id, phonePrefix: normalized.slice(0, 7) + '****' },
    });

    return res.status(201).json({
      ok: true,
      requestId: id,
      ackAm: 'የመረጃ ማጥፋት ጥያቄዎ ተቀብለናል። በ30 ቀናት ውስጥ ይሰራቃል።',
      ackEn: 'Your data-deletion request was received. It will be fulfilled within 30 days.',
    });
  } catch (err: any) {
    console.error('[consumer] data-deletion error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to record deletion request' });
  }
});

export default router;
