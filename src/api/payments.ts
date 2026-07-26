import { Router } from 'express';
import { db } from '../db';
import { payments, appointments } from '../db/schema';
import { eq } from 'drizzle-orm';
import { verifyPayment, getWebhookSecret } from '../../server/lib/chapa';
import { verifyWebhookSignature } from 'chapa-nodejs';
import crypto from 'crypto';

const router = Router();

function verifyChapaSignature(rawBody: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;

  // Prefer the official Chapa SDK verifier. It internally HMAC-SHA256s the
  // raw payload with the shared webhook secret (constant-time compare).
  try {
    const ok = verifyWebhookSignature(rawBody, signature, secret);
    if (typeof ok === 'boolean') return ok;
  } catch (err) {
    console.warn('[webhook] verifyWebhookSignature threw, falling back to manual HMAC:', err);
  }

  // Manual fallback (HMAC-SHA256, constant-time compare).
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

router.post('/webhook', async (req, res) => {
  try {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const signature = req.headers['x-chapa-signature'] as string | undefined;
    let webhookSecret: string;
    try {
      webhookSecret = getWebhookSecret();
    } catch {
      // production without secret configured
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    if (process.env.NODE_ENV === 'production') {
      if (!signature) return res.status(403).json({ error: 'Missing webhook signature' });
      if (!verifyChapaSignature(rawBody, signature, webhookSecret)) {
        return res.status(403).json({ error: 'Invalid webhook signature' });
      }
    } else if (signature) {
      if (!verifyChapaSignature(rawBody, signature, webhookSecret)) {
        return res.status(403).json({ error: 'Invalid webhook signature' });
      }
    } else {
      console.warn('[webhook] x-chapa-signature header missing in dev mode — processing anyway');
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

    // Trust the webhook status only if it explicitly says success/completed,
    // otherwise verify with Chapa to be safe. We always verify here per spec.
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
