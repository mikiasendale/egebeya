/**
 * P1.5 — prepay cycles (30 | 90 | 365) × founding-cap boundary matrix.
 *
 *   30  → base price
 *   90  → base × 3 × 0.95 (5% quarterly discount)
 *   365 → base × 10 ("10-for-12"), allowed ONLY while the founding cohort is
 *         open; paying it locks the founding rate and extends endsAt by a year.
 *
 * Proration is deliberately NOT implemented — asserted here so nobody adds it.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq, inArray } from 'drizzle-orm';

import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import { tenants, users, plans, tenantSubscriptions, payments, invoices } from '../../src/db/schema';
import {
  getWebhookSecret,
} from '../../server/lib/chapa';
import {
  countFoundingCohort,
  FOUNDING_RATE_CAP,
  FOUNDING_RATE_LOCK_MS,
} from '../../server/lib/billing';

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

function tokenFor(userId: string, tenantId: string): string {
  return jwt.sign({ userId, tenantId, role: 'owner', tokenVersion: 0 }, JWT_SECRET, { expiresIn: '15m' });
}

async function deliverWebhook(txRef: string, reference: string) {
  const bodyStr = JSON.stringify({ tx_ref: txRef, status: 'success', reference });
  return request(app)
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('x-chapa-signature', sign(bodyStr))
    .send(bodyStr);
}

const BASE_CENTS = 100000;

describe('prepay cycles × founding-cap boundary (P1.5)', () => {
  let proPlanId: string;
  let freePlanId: string;
  const createdTenantIds: string[] = [];
  const createdTxRefs: string[] = [];

  async function makeOwnerTenant(): Promise<{ tenantId: string; token: string }> {
    const tenantId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    await db.insert(tenants).values({
      id: tenantId,
      name: `Cycle Tenant ${tenantId.slice(0, 6)}`,
      slug: `cycle-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      settings: {},
      createdAt: Date.now(),
    });
    await db.insert(users).values({
      id: userId,
      tenantId,
      name: 'Cycle Owner',
      phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
      email: `cycle-${userId.slice(0, 8)}@egebeya.test`,
      passwordHash: await bcrypt.hash('pass1234', 10),
      role: 'owner',
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
    createdTenantIds.push(tenantId);
    return { tenantId, token: tokenFor(userId, tenantId) };
  }

  async function startCheckout(token: string, cycle?: number) {
    const res = await request(app)
      .post('/api/tenant/subscription/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send(cycle ? { cycle } : {});
    if (res.body?.txRef) createdTxRefs.push(res.body.txRef);
    return res;
  }

  beforeAll(async () => {
    proPlanId = (await db.select().from(plans).where(eq(plans.name, 'pro')).get())!.id;
    freePlanId = (await db.select().from(plans).where(eq(plans.name, 'free')).get())!.id;
  });

  afterAll(async () => {
    // Restore plans row mutated by the proration-guard test.
    await db.update(plans).set({ price: BASE_CENTS }).where(eq(plans.name, 'pro')).catch(() => {});
    if (createdTxRefs.length > 0) {
      const { processedWebhookEvents, invoices } = await import('../../src/db/schema');
      await db.delete(processedWebhookEvents).where(inArray(processedWebhookEvents.txRef, createdTxRefs)).catch(() => {});
      await db.delete(invoices).where(inArray(invoices.chapaTxRef, createdTxRefs)).catch(() => {});
      await db.delete(payments).where(inArray(payments.gatewayReference, createdTxRefs)).catch(() => {});
    }
    for (const id of createdTenantIds) {
      await db.update(tenantSubscriptions).set({ planId: freePlanId }).where(eq(tenantSubscriptions.tenantId, id)).catch(() => {});
      await db.delete(payments).where(eq(payments.tenantId, id)).catch(() => {});
      await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, id)).catch(() => {});
      await db.delete(users).where(eq(users.tenantId, id)).catch(() => {});
      await db.delete(tenants).where(eq(tenants.id, id)).catch(() => {});
    }
  });

  it('matrix: cycle 30 → base · cycle 90 → 5% off · invalid → 400', async () => {
    const { token } = await makeOwnerTenant();

    const c30 = await startCheckout(token);
    expect(c30.status).toBe(200);
    expect(c30.body.amountCents).toBe(BASE_CENTS);
    expect(c30.body.cycleDays).toBe(30);

    const c90 = await startCheckout(token, 90);
    expect(c90.status).toBe(200);
    expect(c90.body.amountCents).toBe(Math.round(BASE_CENTS * 3 * 0.95)); // 285000 = 2850 ETB

    const bad = await startCheckout(token, 45);
    expect(bad.status).toBe(400);
  });

  it('annual 365 is allowed while the founding cohort is open; webhook locks founding rate + 365d cycle', async () => {
    const othersBefore = await countFoundingCohort(Date.now(), undefined);
    expect(othersBefore).toBeLessThan(FOUNDING_RATE_CAP); // precondition on shared test DB

    const { tenantId, token } = await makeOwnerTenant();
    const res = await startCheckout(token, 365);
    expect(res.status).toBe(200);
    expect(res.body.amountCents).toBe(BASE_CENTS * 10);
    expect(res.body.cycleDays).toBe(365);

    const ref = res.body.txRef;
    const webhook = await deliverWebhook(ref, `ref-ann-${Date.now()}`);
    expect(webhook.status).toBe(200);

    // Subscription extended by a full YEAR, not 30 days.
    const sub = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    const delta = (sub!.endsAt as number) - Date.now();
    expect(delta).toBeGreaterThan(365 * 24 * 3600 * 1000 - 5 * 60 * 1000);

    // Founding rate locked for 12 months.
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    const lockDelta = (tenant!.foundingRateLockedUntil ?? 0) - Date.now();
    expect(lockDelta).toBeGreaterThan(FOUNDING_RATE_LOCK_MS - 60_000);
    expect(lockDelta).toBeLessThan(FOUNDING_RATE_LOCK_MS + 60_000);
  });

  it('annual 365 is rejected once the founding cohort is full', async () => {
    const { tenantId, token } = await makeOwnerTenant();

    // Pad the cohort to the cap with synthetic PAID tenants.
    let cohort = await countFoundingCohort(Date.now(), tenantId);
    while (cohort < FOUNDING_RATE_CAP) {
      const fillerTenant = crypto.randomUUID();
      const fillerPayment = crypto.randomUUID();
      await db.insert(tenants).values({
        id: fillerTenant,
        name: `Cap Filler ${fillerTenant.slice(0, 6)}`,
        slug: `capfill-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        settings: {},
        createdAt: Date.now(),
      });
      createdTenantIds.push(fillerTenant);
      await db.insert(payments).values({
        id: fillerPayment,
        tenantId: fillerTenant,
        amount: BASE_CENTS,
        gateway: 'chapa',
        method: 'checkout',
        gatewayReference: `TX-cap-${fillerPayment.slice(0, 12)}`,
        status: 'completed',
        meta: { purpose: 'pro_subscription', product: 'pro-monthly' },
      });
      cohort = await countFoundingCohort(Date.now(), tenantId);
    }

    const res = await startCheckout(token, 365);
    expect(res.status).toBe(400);
    expect(String(res.body.error)).toMatch(/founding cohort/i);

    // Monthly still works at list price past the cap.
    const monthly = await startCheckout(token, 30);
    expect(monthly.status).toBe(200);
    expect(monthly.body.amountCents).toBe(BASE_CENTS);
  });

  it('quarterly webhook extends endsAt by 90 days and invoice period matches', async () => {
    const { tenantId, token } = await makeOwnerTenant();
    const res = await startCheckout(token, 90);
    const ref = res.body.txRef;

    const webhook = await deliverWebhook(ref, `ref-q-${Date.now()}`);
    expect(webhook.status).toBe(200);

    const sub = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    const delta = (sub!.endsAt as number) - Date.now();
    expect(delta).toBeGreaterThan(90 * 24 * 3600 * 1000 - 5 * 60 * 1000);
    expect(delta).toBeLessThan(90 * 24 * 3600 * 1000 + 5 * 60 * 1000);

    const inv = await db.select().from(invoices)
      .where(eq(invoices.chapaTxRef, ref))
      .get();
    expect(inv).toBeTruthy();
    const periodDays = ((inv!.periodEnd as number) - (inv!.periodStart as number)) / (24 * 3600 * 1000);
    expect(Math.round(periodDays)).toBe(90);
  });

  it('proration is explicitly NOT implemented: cycles always run their full length', async () => {
    // Mid-cycle "upgrade" from 30d to 90d simply charges a fresh full cycle —
    // no credit for unused days. Document via behavior: two sequential
    // activations both produce full-length periods.
    const { tenantId, token } = await makeOwnerTenant();

    const r1 = await startCheckout(token, 30);
    await deliverWebhook(r1.body.txRef, `ref-p1-${Date.now()}`);
    const r2 = await startCheckout(token, 90);
    await deliverWebhook(r2.body.txRef, `ref-p2-${Date.now()}`);

    const sub = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    const delta = (sub!.endsAt as number) - Date.now();
    // Full 90 days from NOW — not 30+60 or any blended value.
    expect(delta).toBeGreaterThan(90 * 24 * 3600 * 1000 - 5 * 60 * 1000);
    expect(delta).toBeLessThan(90 * 24 * 3600 * 1000 + 5 * 60 * 1000);
  });

  it('founding lock survives plan-row edits even when bought via annual prepay', async () => {
    // Reuse the annual-lock tenant logic cheaply: resolvePriceForTenant honors
    // the lock regardless of the plans row.
    const { resolvePriceForTenant, FOUNDING_RATE_PRICE_CENTS } = await import('../../server/lib/billing');
    const annualTenants = await db.select().from(tenants).all();
    const locked = annualTenants.find((t) =>
      typeof t.foundingRateLockedUntil === 'number' &&
      t.foundingRateLockedUntil > Date.now() &&
      t.slug.startsWith('cycle-'));
    expect(locked).toBeTruthy(); // the annual-prepay test above locked one

    await db.update(plans).set({ price: 999_999_999 }).where(eq(plans.name, 'pro'));
    const resolved = await resolvePriceForTenant(locked!.id);
    expect(resolved.isFoundingRate).toBe(true);
    expect(resolved.amountCents).toBe(FOUNDING_RATE_PRICE_CENTS);
  });
});
