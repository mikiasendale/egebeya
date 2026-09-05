import { Router } from 'express';
import { db } from '../db';
import {
  payments, appointments, processedWebhookEvents, invoices, tenants,
} from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyPayment, getWebhookSecret } from '../../server/lib/chapa';
import { verifyWebhookSignature } from 'chapa-nodejs';
import crypto from 'crypto';
import {
  activateProSubscription,
  SUPPORTED_CYCLE_DAYS,
  FOUNDING_RATE_LOCK_MS,
} from '../../server/lib/billing';
import type { CycleDays } from '../../server/lib/billing';
import { deriveSettlementStatus } from '../../server/lib/settlements';
import { logSecurityEvent, ipFromRequest } from '../../server/lib/securityLog';
import { trackEvent } from '../../server/lib/analytics';
import { webhookLimiter } from '../../server/middleware/rateLimiter';

const router = Router();

/**
 * P1.5 prepay cycles: coerce payment.meta.cycleDays to a supported length.
 * Anything invalid falls back to the standard 30-day cycle. Proration is
 * deliberately NOT implemented (council decision): a paid cycle always starts
 * at activation time and runs its full length — no mid-cycle refunds/credits.
 */
function normalizeCycleDays(value: any): CycleDays {
  const n = Number(value);
  return ((SUPPORTED_CYCLE_DAYS as readonly number[]).includes(n) ? n : 30) as CycleDays;
}

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

/**
 * Human-facing invoice document number for PLC bookkeeping. Random suffix
 * keeps it race-free under concurrent webhook deliveries; the UNIQUE index
 * on invoices.number catches the (astronomically unlikely) collision.
 */
function newInvoiceNumber(now: number): string {
  const year = new Date(now).getUTCFullYear();
  return `EG-${year}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

/** Error sentinel: another delivery already claimed this webhook event. */
class DuplicateWebhookError extends Error {}

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

    // Idempotency pre-check: fast-path an event we have fully processed.
    // (The authoritative guard is the UNIQUE index inside the transaction.)
    const eventId = eventIdFor(req.body, tx_ref);
    const provider = 'chapa';
    const dup = await db.select({ id: processedWebhookEvents.id })
      .from(processedWebhookEvents)
      .where(and(eq(processedWebhookEvents.provider, provider), eq(processedWebhookEvents.eventId, eventId)))
      .get();
    if (dup) {
      return res.json({ success: true, duplicate: true });
    }

    // Network I/O stays OUTSIDE the transaction so Chapa's API latency never
    // holds the SQLite write lock open.
    let verifiedStatus: string = (status as string) || 'pending';
    let verificationRaw: any = null;
    let amountMismatch = false;
    try {
      const verification = await verifyPayment(tx_ref);
      verificationRaw = verification.raw ?? null;
      if (verification.status === 'success' || verification.status === 'completed') {
        verifiedStatus = 'completed';

        // S-10: assert the PROVIDER-verified amount against our money record.
        // Chapa reports amount in whole ETB (major units) with an unreliable
        // JSON type (number in docs samples, string per SDK types/webhook
        // payloads) — coerce with Number() and compare in birr at 2-decimal
        // tolerance. payments.amount is stored in ETB cents. A mismatch means
        // the charge that actually cleared is not the charge we recorded: do
        // NOT apply any status effects; ack 200 as an idempotent no-op so
        // Chapa stops retrying, and leave a security_events trail.
        const verifiedAmountRaw = verificationRaw?.data?.amount ?? verificationRaw?.amount;
        const verifiedAmountNum = Number(verifiedAmountRaw);
        if (Number.isFinite(verifiedAmountNum) && verifiedAmountNum > 0) {
          const expectedBirr = payment.amount / 100;
          const delta = Math.abs(verifiedAmountNum - expectedBirr);
          if (delta > 0.005) {
            amountMismatch = true;
          }
        }
        // An unusable/absent amount field (provider quirk) preserves current
        // behavior — status-only — rather than failing every webhook.
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

    if (amountMismatch) {
      logSecurityEvent({
        type: 'webhook_amount_mismatch',
        tenantId: payment.tenantId ?? undefined,
        ip: ipFromRequest(req),
        details: { txRef: tx_ref, paymentId: payment.id },
      });
      return res.json({ success: true, ignored: 'amount_mismatch' });
    }

    // P1.7 collected-vs-invoiced: a completed charge is NOT yet settled cash —
    // Chapa settles T+2/T+3. Only an explicit provider settlement confirmation
    // marks 'settled' at delivery time; the rest age into the reconciliation
    // report (server/lib/settlements.ts).
    const settlement = deriveSettlementStatus(verifiedStatus, req.body, verificationRaw);

    // ────────────────────────────────────────────────────────────────────
    // ALL side effects run in ONE transaction (P1.2 critical-bug fix):
    // marker insert → payment update → appointment flip → subscription
    // activation → invoice creation. A crash at ANY point rolls back the
    // marker too, so Chapa's retry re-processes cleanly instead of being
    // blocked forever by the idempotency guard.
    //
    // The marker insert happens FIRST inside the tx so a concurrent duplicate
    // hits the unique index and fails cleanly. libsql/Drizzle wraps the
    // underlying SQLite driver error, so the SQLITE_CONSTRAINT code can land
    // on either `err.code` (top-level wrapper) OR `err.cause.code` (driver
    // error). Check both.
    // ────────────────────────────────────────────────────────────────────
    const now = Date.now();
    const purpose = (payment.meta as any)?.purpose;
    const isProSubscription =
      verifiedStatus === 'completed' && !payment.appointmentId && purpose === 'pro_subscription';
    // P1.5 prepay cycles: the checkout wrote 30 | 90 | 365 into payment.meta.
    const cycleDays = normalizeCycleDays((payment.meta as any)?.cycleDays);
    const cycleMs = cycleDays * 24 * 60 * 60 * 1000;

    let invoiceOutcome: 'created' | 'existing' | 'void' | null = null;

    try {
      await db.transaction(async (tx) => {
        try {
          await tx.insert(processedWebhookEvents).values({
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
          const code = String(insertErr?.code || insertErr?.cause?.code || '');
          const msg = String(insertErr?.message || insertErr?.cause?.message || '');
          if (code.includes('SQLITE_CONSTRAINT') || msg.includes('UNIQUE')) {
            throw new DuplicateWebhookError(eventId);
          }
          throw insertErr;
        }

        await tx.update(payments)
          .set({
            status: verifiedStatus,
            settlementStatus: settlement.settlementStatus,
            // While pending this holds charge-confirmation time (staleness
            // anchor); once settled it holds the settlement time.
            settledAt: now,
          })
          .where(eq(payments.id, payment.id));

        if (verifiedStatus === 'completed' && payment.appointmentId) {
          await tx.update(appointments).set({ status: 'confirmed' })
            .where(eq(appointments.id, payment.appointmentId));
        } else if (verifiedStatus === 'failed' && payment.appointmentId) {
          await tx.update(appointments).set({ status: 'cancelled' })
            .where(eq(appointments.id, payment.appointmentId));
        }

        if (isProSubscription) {
          const txRefValue = payment.gatewayReference ?? tx_ref;
          const existingInvoice = await tx.select().from(invoices)
            .where(eq(invoices.chapaTxRef, txRefValue))
            .get();

          // P1.2 (A) guard: if THIS payment already granted its cycle, a
          // settlement/retry redelivery must only refresh settlement fields —
          // never re-activate. The invoice-existence check below is the
          // primary gate; this flag is the payment-level memory of it.
          const alreadyGranted = typeof (payment as any).subscriptionGrantedAt === 'number';

          if (existingInvoice && existingInvoice.status === 'void') {
            // Voided invoice → the money record was cancelled; NEVER grant Pro.
            invoiceOutcome = 'void';
          } else if (alreadyGranted) {
            // Cycle already granted for this payment: refresh settlement
            // metadata only. (Also covers the partial-success window where a
            // redelivery is the first to see a fully-settled payment.)
            if (!existingInvoice) {
              await tx.insert(invoices).values({
                id: crypto.randomUUID(),
                tenantId: payment.tenantId,
                number: newInvoiceNumber(now),
                amount: payment.amount,
                currency: 'ETB',
                periodStart: now,
                periodEnd: now + cycleMs,
                status: 'paid',
                chapaTxRef: txRefValue,
                issuedAt: now,
                paidAt: now,
                settlementStatus: settlement.settlementStatus,
                settledAt: now,
              });
              invoiceOutcome = 'created';
            } else if (existingInvoice.status !== 'paid') {
              await tx.update(invoices)
                .set({
                  status: 'paid',
                  paidAt: now,
                  settlementStatus: settlement.settlementStatus,
                  settledAt: now,
                })
                .where(eq(invoices.id, existingInvoice.id));
              invoiceOutcome = 'existing';
            } else {
              // Already-paid invoice: only settlement metadata moves.
              await tx.update(invoices)
                .set({
                  settlementStatus: settlement.settlementStatus,
                  settledAt: now,
                })
                .where(eq(invoices.id, existingInvoice.id));
              invoiceOutcome = 'existing';
            }
          } else {
            if (!existingInvoice) {
              await tx.insert(invoices).values({
                id: crypto.randomUUID(),
                tenantId: payment.tenantId,
                number: newInvoiceNumber(now),
                amount: payment.amount,
                currency: 'ETB',
                periodStart: now,
                periodEnd: now + cycleMs,
                status: 'paid',
                chapaTxRef: txRefValue,
                issuedAt: now,
                paidAt: now,
                settlementStatus: settlement.settlementStatus,
                settledAt: now,
              });
              invoiceOutcome = 'created';
              await activateProSubscription(
                payment.tenantId,
                (payment.meta as any)?.planId ?? null,
                now,
                tx,
                cycleDays,
              );
              // P1.2 (A): record that THIS payment granted its cycle — the
              // guard a settlement redelivery checks before any activation.
              await tx.update(payments)
                .set({ subscriptionGrantedAt: now })
                .where(eq(payments.id, payment.id));
              // P1.5: paying the annual 10-for-12 locks the founding rate.
              if (cycleDays === 365) {
                await tx.update(tenants)
                  .set({ foundingRateLockedUntil: now + FOUNDING_RATE_LOCK_MS })
                  .where(eq(tenants.id, payment.tenantId));
              }
            } else {
              // Redelivery under a different event id (network retry, Chapa
              // settlement webhook, replay): mark draft → paid and refresh
              // settlement fields, but NEVER re-activate — a completed charge
              // that already created its invoice already granted its cycle.
              // Re-running activateProSubscription here would extend endsAt by
              // a full cycle on every settlement delivery (P1.2 red-flag fix).
              await tx.update(invoices)
                .set({
                  status: 'paid',
                  paidAt: now,
                  settlementStatus: settlement.settlementStatus,
                  settledAt: now,
                })
                .where(eq(invoices.id, existingInvoice.id));
              invoiceOutcome = 'existing';
            }
          }
        }
      });
    } catch (txErr: any) {
      if (txErr instanceof DuplicateWebhookError) {
        return res.json({ success: true, duplicate: true });
      }
      throw txErr;
    }

    // P3.5: first_invoice_paid — the activation event agent commissions are
    // gated on. Fires only for a genuinely new paid invoice (void/existing
    // outcomes never re-trigger it).
    if (isProSubscription && invoiceOutcome === 'created') {
      trackEvent(payment.tenantId, 'first_invoice_paid', { txRef: payment.gatewayReference ?? null });
    }

    res.json({
      success: true,
      previousStatus: payment.status,
      status: verifiedStatus,
      ...(isProSubscription ? { invoice: invoiceOutcome } : {}),
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
