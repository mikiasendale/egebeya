/**
 * Pro-subscription billing (Feature C): live Chapa checkout + webhook + grace.
 *
 * Covers:
 *   1. POST /api/tenant/subscription/checkout → 200 with a checkout URL and a
 *      'pending' payment row marked as a Pro-subscription purchase.
 *   2. A completed Chapa webhook for that checkout activates the tenant's Pro
 *      subscription (status active, endsAt ≈ now + 30 days).
 *   3. A failed webhook leaves the tenant on Free.
 *   4. Grace period: an active Pro subscription whose endsAt has lapsed but is
 *      still within the 5-day window is allowed through requireProPlan.
 *   5. Past the grace window the same gate returns 403 PLAN_EXPIRED.
 *   6. The downgrade cron reverts a far-lapsed Pro tenant to Free.
 *
 * The Chapa SDK is mocked (createCheckout / verifyPayment) so no network I/O
 * happens; the webhook signature is still verified with the test secret.
 */
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';

import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants, users, plans, tenantSubscriptions, payments, proSiteFiles,
} from '../../src/db/schema';
import { getWebhookSecret } from '../../server/lib/chapa';

// ── Mock the Chapa gateway: no network, deterministic results ─────────────
vi.mock('../../server/lib/chapa', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/lib/chapa')>();
  return {
    ...actual,
    createCheckout: vi.fn(async (opts: any) => ({
      checkoutUrl: 'https://checkout.chapa.co/sandbox/pay/' + opts.txRef,
      txRef: opts.txRef,
      raw: { status: 'success' },
    })),
    verifyPayment: vi.fn(async () => ({ status: 'success', amount: '500', tx_ref: '', raw: {} })),
  };
});

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

// Mirror server.ts: capture the raw body for HMAC verification.
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

describe('Pro-subscription billing (checkout / webhook / grace / downgrade)', () => {
  const slug = `billing-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  let tenantId: string;
  let userId: string;
  let token: string;
  let freePlanId: string;
  let proPlanId: string;
  let txRef: string;

  beforeAll(async () => {
    freePlanId = (await db.select().from(plans).where(eq(plans.name, 'free')).get())!.id;
    proPlanId = (await db.select().from(plans).where(eq(plans.name, 'pro')).get())!.id;

    tenantId = crypto.randomUUID();
    userId = crypto.randomUUID();
    const phone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;

    await db.insert(tenants).values({
      id: tenantId, name: 'Billing Salon', slug,
      settings: {}, createdAt: Date.now(),
    });
    await db.insert(users).values({
      id: userId, tenantId, name: 'Billing Owner', phone,
      email: `billing-${slug}@egebeya.test`,
      passwordHash: await bcrypt.hash('pass1234', 10),
      role: 'owner', createdAt: Date.now(),
    });
    await db.insert(tenantSubscriptions).values({
      id: crypto.randomUUID(), tenantId, planId: freePlanId, status: 'active', startsAt: Date.now(),
    });

    token = tokenFor(userId, tenantId);
  });

  afterAll(async () => {
    await db.delete(payments).where(eq(payments.tenantId, tenantId));
    await db.delete(proSiteFiles).where(eq(proSiteFiles.tenantId, tenantId));
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId));
    await db.delete(users).where(eq(users.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  beforeEach(async () => {
    (mockedVerify as any).mockResolvedValue({ status: 'success', amount: '500', tx_ref: '', raw: {} });
    // Reset to a clean Free, active subscription for each test.
    await db.update(tenantSubscriptions)
      .set({ planId: freePlanId, status: 'active', endsAt: null, trialEndsAt: null, startsAt: Date.now() })
      .where(eq(tenantSubscriptions.tenantId, tenantId));
  });

  it('checkout returns a checkout URL and creates a pending payment row', async () => {
    const res = await request(app)
      .post('/api/tenant/subscription/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.checkoutUrl).toBe('string');
    expect(res.body.checkoutUrl).toMatch(/https?:\/\//);
    expect(String(res.body.amountEtb)).toBe('500');
    txRef = res.body.txRef;

    const payment = await db.select().from(payments)
      .where(eq(payments.gatewayReference, txRef)).get();
    expect(payment).toBeTruthy();
    expect(payment?.status).toBe('pending');
    expect((payment?.meta as any)?.purpose).toBe('pro_subscription');
  });

  it('a completed webhook activates the Pro subscription (+30 days)', async () => {
    // Start a checkout so a matching pending payment row exists.
    const checkout = await request(app)
      .post('/api/tenant/subscription/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    const ref = checkout.body.txRef;

    const bodyStr = JSON.stringify({ tx_ref: ref, status: 'success', reference: `ref-${Date.now()}` });
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-chapa-signature', sign(bodyStr))
      .send(bodyStr);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const sub = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    expect(sub?.status).toBe('active');
    expect(sub?.planId).toBe(proPlanId);
    expect(sub?.trialEndsAt).toBeNull();
    expect(typeof sub?.endsAt).toBe('number');
    // endsAt ≈ now + 30 days.
    const delta = (sub!.endsAt as number) - Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    expect(delta).toBeGreaterThan(THIRTY_DAYS - 5 * 60 * 1000);
    expect(delta).toBeLessThan(THIRTY_DAYS + 5 * 60 * 1000);

    const payment = await db.select().from(payments)
      .where(eq(payments.gatewayReference, ref)).get();
    expect(payment?.status).toBe('completed');
  });

  it('a failed webhook leaves the tenant on Free', async () => {
    (mockedVerify as any).mockResolvedValue({ status: 'failed', amount: '500', tx_ref: '', raw: {} });

    const checkout = await request(app)
      .post('/api/tenant/subscription/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(checkout.status).toBe(200);
    const ref = checkout.body.txRef;

    const bodyStr = JSON.stringify({ tx_ref: ref, status: 'failed', reference: `ref-fail-${Date.now()}` });
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-chapa-signature', sign(bodyStr))
      .send(bodyStr);
    expect(res.status).toBe(200);

    const sub = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    expect(sub?.planId).toBe(freePlanId);
    expect(sub?.status).toBe('active');
    expect(sub?.endsAt).toBeNull();

    const payment = await db.select().from(payments)
      .where(eq(payments.gatewayReference, ref)).get();
    expect(payment?.status).toBe('failed');
  });

  it('owner-only: a non-owner token is rejected on checkout', async () => {
    const staffToken = tokenFor(userId, tenantId, 'staff');
    const res = await request(app)
      .post('/api/tenant/subscription/checkout')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('grace period: a recently-lapsed Pro subscription keeps access', async () => {
    // Active Pro, endsAt 1 day ago — inside the 5-day grace window.
    await db.update(tenantSubscriptions)
      .set({ planId: proPlanId, status: 'active', endsAt: Date.now() - 24 * 3600 * 1000 })
      .where(eq(tenantSubscriptions.tenantId, tenantId));

    const res = await request(app)
      .get('/api/tenant/pro-site/files')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('grace period: a Pro subscription past the window returns 403 PLAN_EXPIRED', async () => {
    // Active Pro, endsAt 6 days ago — beyond the 5-day grace window.
    await db.update(tenantSubscriptions)
      .set({ planId: proPlanId, status: 'active', endsAt: Date.now() - 6 * 24 * 3600 * 1000 })
      .where(eq(tenantSubscriptions.tenantId, tenantId));

    const res = await request(app)
      .get('/api/tenant/pro-site/files')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_EXPIRED');
  });

  it('downgrade cron reverts a far-lapsed Pro tenant to Free', async () => {
    // endsAt well past the 7-day downgrade window.
    await db.update(tenantSubscriptions)
      .set({ planId: proPlanId, status: 'active', endsAt: Date.now() - 60 * 24 * 3600 * 1000 })
      .where(eq(tenantSubscriptions.tenantId, tenantId));

    const { runOnce } = await import('../../server/cron/downgradeExpired');
    const count = await runOnce();
    expect(count).toBeGreaterThanOrEqual(1);

    const sub = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    expect(sub?.planId).toBe(freePlanId);
    expect(sub?.status).toBe('expired');
  });
});