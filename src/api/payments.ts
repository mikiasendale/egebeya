import { Router } from 'express';
import { db } from '../db';
import { payments, appointments, processedWebhookEvents } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyPayment, getWebhookSecret } from '../../server/lib/chapa';
import { verifyWebhookSignature } from 'chapa-nodejs';
import crypto from 'crypto';
import { logSecurityEvent, ipFromRequest } from '../../server/lib/securityLog';
import { webhookLimiter } from '../../server/middleware/rateLimiter';

const router = Router();

function verifyChapaSignature(rawBody: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;

  try {
    const ok = verifyWebhookSignature(rawBody, signature, secret);
    if (typeof ok === 'boolean') return ok;
  } catch (err) {
    console.warn('[webhook] verifyWebhookSignature threw, falling back to manual HMAC:', err);
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Deterministic event id for idempotency — Chapa's `reference` field when
// present, else the tx_ref so replaying the exact same payload is detected.
function eventIdFor(body: any, txRef: string): string {
  if (typeof body?.reference === 'string' && body.reference.trim()) {
    return `ref:${body.reference}`;
  }
  return `tx:${txRef}`;
}

router.post('/webhook', webhookLimiter, async (req, res) => {
  try {
    const rawBody = (req as any).rawBody
      ? Buffer.isBuffer((req as any).rawBody) ? (req as any).rawBody.toString('utf8') : String((req as any).rawBody)
      : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);

    const signature = (req.headers['x-chapa-signature'] || req.headers['chapa-signature']) as string | undefined;

    let webhookSecret: string;
    try {
      webhookSecret = getWebhookSecret();
    } catch {
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    // Signature verification is MANDATORY in every environment — never gated
    // on NODE_ENV. A missing or invalid signature is a forgery.
    if (!signature) {
      logSecurityEvent({
        type: 'webhook_signature_rejected',
        ip: ipFromRequest(req),
        details: { reason: 'missing signature' },
      });
      return res.status(401).json({ error: 'Missing webhook signature' });
    }
    if (!verifyChapaSignature(rawBody, signature, webhookSecret)) {
      logSecurityEvent({
        type: 'webhook_signature_rejected',
        ip: ipFromRequest(req),
        details: { reason: 'invalid signature' },
      });
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const { tx_ref, status } = req.body || {};

    if (!tx_ref || typeof tx_ref !== 'string') {
      return res.status(400).json({ error: 'Missing tx_ref' });
    }

    const payment = await db.select().from(payments)
      .where(eq(payments.gatewayReference, tx_ref))
      .get();

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found for tx_ref' });
    }

    // Idempotency guard: same event only processed once.
    const eventId = eventIdFor(req.body, tx_ref);
    const provider = 'chapa';
    const dup = await db.select({ id: processedWebhookEvents.id })
      .from(processedWebhookEvents)
      .where(and(eq(processedWebhookEvents.provider, provider), eq(processedWebhookEvents.eventId, eventId)))
      .get();
    if (dup) {
      return res.json({ success: true, duplicate: true });
    }

    let verifiedStatus: string = (status as string) || 'pending';
    try {
      const verification = await verifyPayment(tx_ref);
      if (verification.status === 'success' || verification.status === 'completed') {
        verifiedStatus = 'completed';
      } else if (verification.status === 'failed') {
        verifiedStatus = 'failed';
      }
    } catch (verifyErr: any) {
      console.error('Webhook: Chapa verify failed, falling back to declared status:', verifyErr?.message || verifyErr);
      if (status === 'success' || status === 'completed') {
        verifiedStatus = 'completed';
      } else if (status === 'failed') {
        verifiedStatus = 'failed';
      }
    }

    // Insert the processed marker FIRST so a concurrent duplicate hits the
    // unique index and fails cleanly.
    try {
      await db.insert(processedWebhookEvents).values({
        id: crypto.randomUUID(),
        provider,
        eventId,
        txRef: tx_ref,
        paymentId: payment.id,
        action: verifiedStatus,
        raw: JSON.stringify(req.body),
        receivedAt: Date.now(),
      });
    } catch (insertErr: any) {
      // libsql nests the error code on `err.cause.code` — check both surfaces so
      // a concurrent duplicate returns 200 `duplicate:true` instead of a 500.
      const code = String(insertErr?.code ?? insertErr?.cause?.code ?? '');
      const message = String(insertErr?.message ?? insertErr?.cause?.message ?? '');
      if (code.includes('SQLITE_CONSTRAINT') || message.includes('UNIQUE')) {
        return res.json({ success: true, duplicate: true });
      }
      throw insertErr;
    }

    const previousStatus = payment.status;
    await db.update(payments).set({ status: verifiedStatus }).where(eq(payments.id, payment.id));

    if (verifiedStatus === 'completed' && payment.appointmentId) {
      await db.update(appointments).set({ status: 'confirmed' })
        .where(eq(appointments.id, payment.appointmentId));
    } else if (verifiedStatus === 'failed' && payment.appointmentId) {
      await db.update(appointments).set({ status: 'cancelled' })
        .where(eq(appointments.id, payment.appointmentId));
    }

    res.json({ success: true, previousStatus, status: verifiedStatus });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
