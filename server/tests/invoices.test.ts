/**
 * P1.2 — transactional Chapa webhook + invoices & receipts.
 *
 * Covers:
 *   1. A completed Pro-subscription webhook creates EXACTLY ONE paid invoice;
 *      duplicate redelivery creates no second invoice.
 *   2. 🚨 Crash-recovery regression: a failure AFTER the marker insert rolls
 *      back the whole transaction (marker included), so Chapa's retry is NOT
 *      blocked by the idempotency guard — redelivery recovers fully.
 *   3. A failed webhook never grants Pro and never creates an invoice.
 *   4. A VOIDED invoice for a tx_ref never grants Pro on redelivery.
 *   5. GET /api/tenant/invoices lists invoices; the receipt HTML renders
 *      Amharic-first ("ደረሰኝ") with the business name.
 *
 * The Chapa SDK is mocked; HMAC signing uses the real webhook secret path.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq, inArray } from 'drizzle-orm';

import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants, users, plans, tenantSubscriptions, payments,
  invoices, processedWebhookEvents,
} from '../../src/db/schema';
import { getWebhookSecret } from '../../server/lib/chapa';

const { webhookState } = vi.hoisted(() => ({
  webhookState: { failActivationOnce: false },
}));

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

// Wrap (not replace) activateProSubscription so we can simulate a crash
// between the idempotency-marker insert and the subscription flip.
vi.mock('../../server/lib/billing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/lib/billing')>();
  return {
    ...actual,
    activateProSubscription: vi.fn(async (...args: any[]) => {
      if (webhookState.failActivationOnce) {
        webhookState.failActivationOnce = false;
        throw new Error('Simulated crash mid-webhook');
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actual.activateProSubscription as any)(...args);
    }),
  };
});

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

const app = express();
app.use(express.json({
  verify: (req, _res, buf) => { (req as any).rawBody = buf; },
}));
app.use('/api', apiRoutes);

const WEBHOOK_SECRET = getWebhookSecret();
function sign(rawBody: string): string {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody, 'utf8').digest('hex');
}

function tokenFor(userId: string, tenantId: string, role = 'owner'): string {
  return jwt.sign({ userId, tenantId, role, tokenVersion: 0 }, JWT_SECRET, { expiresIn: '15m' });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedVerify: any = (await import('../../server/lib/chapa')).verifyPayment;

async function deliverWebhook(txRef: string, reference: string, status = 'success') {
  const bodyStr = JSON.stringify({ tx_ref: txRef, status, reference });
  return request(app)
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('x-chapa-signature', sign(bodyStr))
    .send(bodyStr);
}

describe('Transactional webhook + invoices (P1.2)', () => {
  const slug = `inv-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  let tenantId: string;
  let userId: string;
  let token: string;
  let freePlanId: string;
  const txRefs: string[] = [];

  beforeAll(async () => {
    freePlanId = (await db.select().from(plans).where(eq(plans.name, 'free')).get())!.id;

    tenantId = crypto.randomUUID();
    userId = crypto.randomUUID();
    const phone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;

    await db.insert(tenants).values({
      id: tenantId, name: 'Invoice Salon', slug,
      settings: {}, createdAt: Date.now(),
    });
    await db.insert(users).values({
      id: userId, tenantId, name: 'Invoice Owner', phone,
      email: `inv-${slug}@egebeya.test`,
      passwordHash: await bcrypt.hash('pass1234', 10),
      role: 'owner', createdAt: Date.now(),
    });
    await db.insert(tenantSubscriptions).values({
      id: crypto.randomUUID(), tenantId, planId: freePlanId, status: 'active',
      startsAt: Date.now(), endsAt: null,
    });

    token = tokenFor(userId, tenantId);
  });

  afterAll(async () => {
    if (txRefs.length > 0) {
      await db.delete(processedWebhookEvents).where(inArray(processedWebhookEvents.txRef, txRefs)).catch(() => {});
      await db.delete(invoices).where(inArray(invoices.chapaTxRef, txRefs)).catch(() => {});
      await db.delete(payments).where(inArray(payments.gatewayReference, txRefs)).catch(() => {});
    }
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).catch(() => {});
    await db.delete(users).where(eq(users.tenantId, tenantId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
  });

  beforeEach(async () => {
    webhookState.failActivationOnce = false;
    await db.update(tenantSubscriptions)
      .set({ planId: freePlanId, status: 'active', endsAt: null, trialEndsAt: null })
      .where(eq(tenantSubscriptions.tenantId, tenantId));
  });

  async function startCheckout(): Promise<string> {
    const res = await request(app)
      .post('/api/tenant/subscription/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    txRefs.push(res.body.txRef);
    return res.body.txRef;
  }

  it('creates exactly one paid invoice; duplicate redelivery creates none', async () => {
    const ref = await startCheckout();
    const reference = `ref-inv-${Date.now()}`;

    const first = await deliverWebhook(ref, reference);
    expect(first.status).toBe(200);
    expect(first.body.success).toBe(true);
    expect(first.body.invoice).toBe('created');

    const sub = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    expect(sub?.status).toBe('active');

    const invs = await db.select().from(invoices).where(eq(invoices.chapaTxRef, ref));
    expect(invs.length).toBe(1);
    expect(invs[0].status).toBe('paid');
    expect(invs[0].amount).toBe(100000); // 1000 ETB in cents
    expect(invs[0].currency).toBe('ETB');
    expect(invs[0].paidAt).toBeTruthy();
    expect(typeof invs[0].number).toBe('string');
    expect(invs[0].number).toMatch(/^EG-\d{4}-[0-9A-F]{8}$/);

    // Duplicate delivery (same event id) → no second invoice, no mutation.
    const second = await deliverWebhook(ref, reference);
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);

    const invsAfterDup = await db.select().from(invoices).where(eq(invoices.chapaTxRef, ref));
    expect(invsAfterDup.length).toBe(1);
  });

  it('a crash after the marker insert rolls everything back and recovers on redelivery', async () => {
    const ref = await startCheckout();
    const reference = `ref-crash-${Date.now()}`;

    webhookState.failActivationOnce = true;
    const crashed = await deliverWebhook(ref, reference);
    expect(crashed.status).toBe(500);

    // The marker MUST have rolled back with everything else — this is the
    // exact property that keeps Chapa retries unblocked (the old sequential
    // awaits left an orphan marker here forever).
    const markers = await db.select().from(processedWebhookEvents)
      .where(eq(processedWebhookEvents.eventId, `ref:${reference}`));
    expect(markers.length).toBe(0);

    // Nothing else leaked out of the aborted transaction either.
    const invs = await db.select().from(invoices).where(eq(invoices.chapaTxRef, ref));
    expect(invs.length).toBe(0);
    const subAfterCrash = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    expect(subAfterCrash?.planId).toBe(freePlanId);

    // Redelivery of the SAME event now processes cleanly.
    const retry = await deliverWebhook(ref, reference);
    expect(retry.status).toBe(200);
    expect(retry.body.success).toBe(true);
    expect(retry.body.invoice).toBe('created');

    const sub = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    expect(sub?.status).toBe('active');

    const markersAfterRetry = await db.select().from(processedWebhookEvents)
      .where(eq(processedWebhookEvents.eventId, `ref:${reference}`));
    expect(markersAfterRetry.length).toBe(1);

    const invsAfterRetry = await db.select().from(invoices).where(eq(invoices.chapaTxRef, ref));
    expect(invsAfterRetry.length).toBe(1);
    expect(invsAfterRetry[0].status).toBe('paid');
  });

  it('a failed webhook never grants Pro and never creates an invoice', async () => {
    const ref = await startCheckout();

    // Provider confirms the charge FAILED.
    mockedVerify.mockResolvedValueOnce({ status: 'failed', amount: '1000', tx_ref: '', raw: {} });

    const res = await deliverWebhook(ref, `ref-fail-${Date.now()}`, 'failed');
    expect(res.status).toBe(200);

    const payment = await db.select().from(payments)
      .where(eq(payments.gatewayReference, ref)).get();
    expect(payment?.status).toBe('failed');

    const invs = await db.select().from(invoices).where(eq(invoices.chapaTxRef, ref));
    expect(invs.length).toBe(0);

    const sub = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    expect(sub?.planId).toBe(freePlanId);
    expect(sub?.endsAt).toBeNull();
  });

  it('a voided invoice never grants Pro, even on a completed webhook', async () => {
    const ref = `TX-void-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    txRefs.push(ref);

    // Pending subscription payment whose charge was already invoiced then voided.
    await db.insert(payments).values({
      id: crypto.randomUUID(),
      tenantId,
      amount: 100000,
      gateway: 'chapa',
      method: 'checkout',
      gatewayReference: ref,
      status: 'pending',
      meta: { purpose: 'pro_subscription', product: 'pro-monthly' },
    });
    await db.insert(invoices).values({
      id: crypto.randomUUID(),
      tenantId,
      number: `EG-${new Date().getUTCFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      amount: 100000,
      currency: 'ETB',
      status: 'void',
      chapaTxRef: ref,
      issuedAt: Date.now(),
    });

    const res = await deliverWebhook(ref, `ref-void-${Date.now()}`);
    expect(res.status).toBe(200);
    expect(res.body.invoice).toBe('void');

    // Pro must NOT be granted.
    const sub = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    expect(sub?.planId).toBe(freePlanId);
    expect(sub?.endsAt).toBeNull();

    // The invoice stays void — never flipped to paid.
    const inv = await db.select().from(invoices).where(eq(invoices.chapaTxRef, ref)).get();
    expect(inv?.status).toBe('void');
  });

  it('GET /invoices lists tenant invoices; receipt HTML is Amharic-first', async () => {
    const list = await request(app)
      .get('/api/tenant/invoices')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.success).toBe(true);
    expect(Array.isArray(list.body.invoices)).toBe(true);
    expect(list.body.invoices.length).toBeGreaterThanOrEqual(2);
    // Newest first.
    const issued = list.body.invoices.map((i: any) => i.issuedAt);
    expect([...issued].sort((a: number, b: number) => b - a)).toEqual(issued);

    const paid = list.body.invoices.find((i: any) => i.status === 'paid');
    expect(paid).toBeTruthy();

    const receipt = await request(app)
      .get(`/api/tenant/invoices/${paid.id}/receipt`)
      .set('Authorization', `Bearer ${token}`);
    expect(receipt.status).toBe(200);
    expect(receipt.text).toContain('ደረሰኝ');
    expect(receipt.text).toContain('Invoice Salon');
    expect(receipt.text).toContain(paid.number);
    expect(receipt.text).toContain('1000.00');

    // Cross-tenant access is impossible: a foreign invoice id → 404.
    const foreign = await request(app)
      .get(`/api/tenant/invoices/${crypto.randomUUID()}/receipt`)
      .set('Authorization', `Bearer ${token}`);
    expect(foreign.status).toBe(404);
  });
});
