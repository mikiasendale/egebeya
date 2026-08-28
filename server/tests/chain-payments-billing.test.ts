/**
 * CHAIN 1 (P1): checkout → webhook → activation → invoice.
 *
 *   POST /api/tenant/subscription/checkout   (tenant.ts → billing.ts + chapa)
 *     → POST /api/payments/webhook (HMAC)    (payments.ts → billing.activateProSubscription)
 *       → tenant_subscriptions flips active, invoice created 'paid',
 *         payments row updated, first_invoice_paid event fired.
 *
 * Failure modes: a VOID invoice never grants Pro; a duplicate webhook
 * delivery never creates a second invoice.
 *
 * The Chapa SDK is the external provider — stubbed via vi.mock (same
 * pattern as prepay-cycles.test.ts). Everything else is real HTTP.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

vi.mock('../../server/lib/chapa', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/lib/chapa')>();
  return {
    ...actual,
    createCheckout: vi.fn(async (opts: any) => ({
      checkoutUrl: 'https://checkout.chapa.co/sandbox/pay/' + opts.txRef,
      txRef: opts.txRef,
      raw: { status: 'success' },
    })),
    verifyPayment: vi.fn(async () => ({ status: 'success', amount: '1000', tx_ref: '', raw: {} })),
  };
});

import request from 'supertest';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../../src/db';
import {
  tenants, tenantSubscriptions, payments, invoices, activationEvents,
} from '../../src/db/schema';
import {
  mountApp, makeOwner, deliverWebhook, deleteTenantCascade, seedProPayment,
} from './chain-helpers';
import type { App } from './chain-helpers';

describe('CHAIN: checkout → webhook → activation → invoice', () => {
  let app: App;
  let tenantId: string;
  let token: string;

  beforeAll(async () => {
    app = await mountApp();
    const owner = await makeOwner({
      subscription: { planName: 'free', status: 'active' },
    });
    tenantId = owner.tenantId;
    token = owner.token;
  });

  afterAll(async () => {
    await deleteTenantCascade(tenantId);
  });

  it('happy path: checkout → signed webhook → subscription active + paid invoice + event', async () => {
    // 1. Real HTTP checkout — handler writes a pending payment row.
    const res = await request(app)
      .post('/api/tenant/subscription/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ cycle: 30 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.checkoutUrl).toContain('checkout.chapa.co');
    expect(res.body.amountCents).toBe(100000);

    const txRef: string = res.body.txRef;
    const paymentBefore = await db.select().from(payments)
      .where(eq(payments.gatewayReference, txRef)).get();
    expect(paymentBefore?.status).toBe('pending');
    expect((paymentBefore?.meta as any)?.purpose).toBe('pro_subscription');

    // 2. Chapa confirms over the signed webhook.
    const hook = await deliverWebhook(app, { tx_ref: txRef, status: 'success' });
    expect(hook.status).toBe(200);
    expect(hook.body.success).toBe(true);
    expect(hook.body.invoice).toBe('created');

    // 3. DB side effects: subscription active with a 30-day cycle.
    const sub = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    expect(sub!.status).toBe('active');
    const cycleDays = ((sub!.endsAt as number) - Date.now()) / (24 * 3600 * 1000);
    expect(cycleDays).toBeGreaterThan(29.9);
    expect(cycleDays).toBeLessThan(30.1);

    // 4. Invoice created, paid, tied to the tx_ref.
    const invoice = await db.select().from(invoices)
      .where(eq(invoices.chapaTxRef, txRef)).get();
    expect(invoice).toBeTruthy();
    expect(invoice!.status).toBe('paid');
    expect(invoice!.amount).toBe(100000);
    expect(invoice!.settlementStatus).toBe('pending'); // charge ≠ settled cash

    // 5. Payment updated + cycle-grant memory stamped (P1.2 A).
    const paymentAfter = await db.select().from(payments)
      .where(eq(payments.gatewayReference, txRef)).get();
    expect(paymentAfter!.status).toBe('completed');
    expect(typeof paymentAfter!.subscriptionGrantedAt).toBe('number');

    // 6. Activation funnel event fired exactly once for this payment.
    const events = await db.select().from(activationEvents)
      .where(and(
        eq(activationEvents.tenantId, tenantId),
        eq(activationEvents.event, 'first_invoice_paid'),
      )).all();
    expect(events.length).toBe(1);
  });

  it('failure mode: a void invoice never grants Pro', async () => {
    const pay = seedProPayment(tenantId, { cycleDays: 30 });
    await db.insert(payments).values(pay.row);

    // Pre-voided money record: the invoice was cancelled before the
    // webhook redelivery arrived.
    await db.insert(invoices).values({
      id: crypto.randomUUID(),
      tenantId,
      number: `EG-VOID-${crypto.randomUUID().slice(0, 8)}`,
      amount: pay.row.amount,
      currency: 'ETB',
      status: 'void',
      chapaTxRef: pay.txRef,
      issuedAt: Date.now(),
    });

    const subBefore = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get();

    const hook = await deliverWebhook(app, { tx_ref: pay.txRef, status: 'success' });
    expect(hook.status).toBe(200);
    expect(hook.body.invoice).toBe('void');

    const subAfter = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    // endsAt untouched — void money never buys cycles.
    expect(subAfter!.endsAt).toBe(subBefore!.endsAt);
    expect(subAfter!.status).toBe(subBefore!.status);

    const granted = await db.select().from(payments)
      .where(eq(payments.gatewayReference, pay.txRef)).get();
    expect(granted!.subscriptionGrantedAt ?? null).toBeNull();
  });

  it('failure mode: duplicate webhook delivery creates no second invoice', async () => {
    const pay = seedProPayment(tenantId, { cycleDays: 30 });
    await db.insert(payments).values(pay.row);

    const first = await deliverWebhook(app, { tx_ref: pay.txRef, status: 'success' });
    expect(first.status).toBe(200);
    expect(first.body.duplicate ?? false).toBe(false);

    const invoicesAfterFirst = await db.select().from(invoices)
      .where(eq(invoices.chapaTxRef, pay.txRef)).all();
    expect(invoicesAfterFirst.length).toBe(1);

    const endsAtBefore = (await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get())!.endsAt;

    const replay = await deliverWebhook(app, { tx_ref: pay.txRef, status: 'success' });
    expect(replay.status).toBe(200);
    expect(replay.body.duplicate).toBe(true);

    const invoicesAfterReplay = await db.select().from(invoices)
      .where(eq(invoices.chapaTxRef, pay.txRef)).all();
    expect(invoicesAfterReplay.length).toBe(1);

    const endsAtAfter = (await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get())!.endsAt;
    expect(endsAtAfter).toBe(endsAtBefore); // no double activation
  });
});
