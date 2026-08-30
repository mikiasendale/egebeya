/**
 * P1.7 — settlement lifecycle (collected-vs-invoiced).
 *
 *   completed charge  → settlement_status 'pending' (Chapa settles T+2/T+3)
 *   explicit settlement confirmation (event=charge.settlement) → 'settled'
 *   failed charge     → 'failed'
 *   stale pending rows (>5 days) surface in the reconciliation report.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { eq, inArray } from 'drizzle-orm';

import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants, plans, tenantSubscriptions, payments,
  invoices, processedWebhookEvents,
} from '../../src/db/schema';
import { getWebhookSecret } from '../../server/lib/chapa';
import { SETTLEMENT_STALE_MS, settlementReconciliationReport } from '../../server/lib/settlements';

const mockedChapa: any = vi.hoisted(() => ({ verifyResponse: null as any }));

vi.mock('../../server/lib/chapa', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/lib/chapa')>();
  return {
    ...actual,
    verifyPayment: vi.fn(async () => mockedChapa.verifyResponse ?? { status: 'success', amount: '1000', tx_ref: '', raw: {} }),
  };
});

const app = express();
app.use(express.json({
  verify: (req, _res, buf) => { (req as any).rawBody = buf; },
}));
app.use('/api', apiRoutes);

const WEBHOOK_SECRET = getWebhookSecret();
function sign(rawBody: string): string {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody, 'utf8').digest('hex');
}

async function deliverWebhook(payload: Record<string, unknown>) {
  const bodyStr = JSON.stringify(payload);
  return request(app)
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('x-chapa-signature', sign(bodyStr))
    .send(bodyStr);
}

describe('settlement lifecycle + reconciliation report (P1.7)', () => {
  let tenantId: string;
  let proPlanId: string;
  let freePlanId: string;
  const txRefs: string[] = [];

  async function seedPendingSubscriptionPayment(txRef: string): Promise<void> {
    await db.insert(payments).values({
      id: crypto.randomUUID(),
      tenantId,
      amount: 100000,
      gateway: 'chapa',
      method: 'checkout',
      gatewayReference: txRef,
      status: 'pending',
      meta: { purpose: 'pro_subscription', product: 'pro-monthly' },
    });
    txRefs.push(txRef);
  }

  beforeAll(async () => {
    proPlanId = (await db.select().from(plans).where(eq(plans.name, 'pro')).get())!.id;
    freePlanId = (await db.select().from(plans).where(eq(plans.name, 'free')).get())!.id;

    tenantId = crypto.randomUUID();
    await db.insert(tenants).values({
      id: tenantId,
      name: 'Settlement Salon',
      slug: `settle-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      settings: {},
      createdAt: Date.now(),
    });
    await db.insert(tenantSubscriptions).values({
      id: crypto.randomUUID(),
      tenantId,
      planId: freePlanId,
      status: 'active',
      startsAt: Date.now(),
      endsAt: null,
    });
  });

  afterAll(async () => {
    if (txRefs.length > 0) {
      await db.delete(processedWebhookEvents).where(inArray(processedWebhookEvents.txRef, txRefs)).catch(() => {});
      await db.delete(invoices).where(inArray(invoices.chapaTxRef, txRefs)).catch(() => {});
      await db.delete(payments).where(inArray(payments.gatewayReference, txRefs)).catch(() => {});
    }
    // Reset sub to free before teardown.
    await db.update(tenantSubscriptions)
      .set({ planId: freePlanId })
      .where(eq(tenantSubscriptions.tenantId, tenantId))
      .catch(() => {});
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
  });

  it('completed charge → payment+invoice stay settlement-pending; explicit settlement event → settled', async () => {
    const ref = `TX-settle-${crypto.randomUUID().slice(0, 12)}`;
    await seedPendingSubscriptionPayment(ref);

    // Ordinary charge webhook: money earned, NOT yet settled cash.
    mockedChapa.verifyResponse = { status: 'success', amount: '1000', tx_ref: ref, raw: {} };
    const first = await deliverWebhook({ tx_ref: ref, status: 'success', reference: `ref-s1-${Date.now()}` });
    expect(first.status).toBe(200);

    let payment = await db.select().from(payments)
      .where(eq(payments.gatewayReference, ref)).get();
    expect(payment?.status).toBe('completed');
    expect(payment?.settlementStatus).toBe('pending');
    expect(typeof payment?.settledAt).toBe('number');

    let invoice = await db.select().from(invoices)
      .where(eq(invoices.chapaTxRef, ref)).get();
    expect(invoice?.status).toBe('paid');
    expect(invoice?.settlementStatus).toBe('pending');
    expect(typeof invoice?.paidAt).toBe('number');

    // P1.2 RED-FLAG: capture the subscription cycle after the FIRST (success)
    // webhook — a settlement redelivery must NOT extend endsAt again.
    const subAfterCharge = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    expect(subAfterCharge?.status).toBe('active');
    expect(typeof subAfterCharge?.endsAt).toBe('number');
    const endsAtAfterCharge = subAfterCharge!.endsAt as number;

    // P1.2 (A): the charge granted its cycle → the payment is flagged.
    const payAfterCharge = await db.select().from(payments)
      .where(eq(payments.gatewayReference, ref)).get();
    expect(typeof (payAfterCharge as any)?.subscriptionGrantedAt).toBe('number');

    // T+2/T+3 later: Chapa confirms settlement via a typed webhook event.
    mockedChapa.verifyResponse = {
      status: 'success', amount: '1000', tx_ref: ref,
      raw: { data: { settlement_status: 'successful' } },
    };
    const second = await deliverWebhook({
      tx_ref: ref, status: 'success',
      reference: `ref-settle-${Date.now()}`,
      event: 'charge.settlement',
    });
    expect(second.status).toBe(200);

    payment = await db.select().from(payments)
      .where(eq(payments.gatewayReference, ref)).get();
    invoice = await db.select().from(invoices)
      .where(eq(invoices.chapaTxRef, ref)).get();
    expect(payment?.settlementStatus).toBe('settled');
    expect(invoice?.settlementStatus).toBe('settled');
    expect(typeof invoice?.settledAt).toBe('number');

    // P1.2 RED-FLAG: settlement delivery updated settlement fields but must
    // NOT have re-extended the subscription cycle.
    const subAfterSettlement = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    expect(subAfterSettlement?.endsAt).toBe(endsAtAfterCharge);

    // P1.2 (A): the flag is unchanged by the settlement redelivery — this
    // payment granted exactly one cycle, and no re-activation happened.
    const payAfterSettle = await db.select().from(payments)
      .where(eq(payments.gatewayReference, ref)).get();
    expect((payAfterSettle as any)?.subscriptionGrantedAt)
      .toBe((payAfterCharge as any)?.subscriptionGrantedAt);
  });

  it('failed charge → settlement_status failed', async () => {
    const ref = `TX-failsettle-${crypto.randomUUID().slice(0, 12)}`;
    await seedPendingSubscriptionPayment(ref);

    mockedChapa.verifyResponse = { status: 'failed', amount: '1000', tx_ref: ref, raw: {} };
    const res = await deliverWebhook({ tx_ref: ref, status: 'failed', reference: `ref-s2-${Date.now()}` });
    expect(res.status).toBe(200);

    const payment = await db.select().from(payments)
      .where(eq(payments.gatewayReference, ref)).get();
    expect(payment?.status).toBe('failed');
    expect(payment?.settlementStatus).toBe('failed');
  });

  it('stale pending rows (>5 days) appear in the report; fresh ones do not', async () => {
    const now = Date.now();
    const oldRef = `TX-stale-${crypto.randomUUID().slice(0, 10)}`;
    const freshRef = `TX-fresh-${crypto.randomUUID().slice(0, 10)}`;

    // Old completed charge confirmed long ago (settledAt anchors the age).
    const oldPayment = crypto.randomUUID();
    await db.insert(payments).values({
      id: oldPayment,
      tenantId,
      amount: 50000,
      gateway: 'chapa',
      method: 'checkout',
      gatewayReference: oldRef,
      status: 'completed',
      settlementStatus: 'pending',
      settledAt: now - SETTLEMENT_STALE_MS - 24 * 3600 * 1000, // 6 days ago
      meta: { purpose: 'pro_subscription', product: 'pro-monthly' },
    });
    txRefs.push(oldRef);

    // Fresh pending — must NOT be flagged.
    const freshPayment = crypto.randomUUID();
    await db.insert(payments).values({
      id: freshPayment,
      tenantId,
      amount: 50000,
      gateway: 'chapa',
      method: 'checkout',
      gatewayReference: freshRef,
      status: 'completed',
      settlementStatus: 'pending',
      settledAt: now - 3600_000, // an hour ago
      meta: { purpose: 'pro_subscription', product: 'pro-monthly' },
    });
    txRefs.push(freshRef);

    const report = await settlementReconciliationReport(now);
    const staleIds = report.stalePayments.map((p) => p.id);
    expect(staleIds).toContain(oldPayment);
    expect(staleIds).not.toContain(freshPayment);

    // Settling the stale row removes it from the report.
    await db.update(payments)
      .set({ settlementStatus: 'settled' })
      .where(eq(payments.id, oldPayment));
    const reportAfter = await settlementReconciliationReport(now);
    expect(reportAfter.stalePayments.map((p) => p.id)).not.toContain(oldPayment);
  });
});
