/**
 * Subscription upgrade flow + Pro-plan gating roundtrip.
 *
 * Auth: A Free-tenant owner can POST /api/tenant/subscription/upgrade to
 * move onto the Pro plan with a 14-day trial window. The endpoint is
 * idempotent — a second upgrade on the same tenant is a no-op so a
 * double-click doesn't reset the trial clock.
 *
 * Plan gate: After the upgrade, the same Free-tenant routes that returned
 * 403 PLAN_REQUIRED in plan-isolation.test.ts must now succeed. We round-
 * trip from Free-blocked → Pro-granted via the upgrade endpoint and assert
 * both halves.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants,
  users,
  staff,
  plans,
  tenantSubscriptions,
  proSiteFiles,
} from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

function tokenFor(userId: string, tenantId: string): string {
  return jwt.sign({ userId, tenantId, role: 'owner', tokenVersion: 0 }, JWT_SECRET, { expiresIn: '15m' });
}

describe('Subscription upgrade + Pro-plan roundtrip', () => {
  const slug = `upgrade-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  let tenantId: string;
  let userId: string;
  let token: string;
  let freePlanId: string;
  let proPlanId: string;

  beforeAll(async () => {
    freePlanId = (await db.select().from(plans).where(eq(plans.name, 'free')).get())!.id;
    proPlanId = (await db.select().from(plans).where(eq(plans.name, 'pro')).get())!.id;

    tenantId = crypto.randomUUID();
    userId = crypto.randomUUID();
    const phone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;

    await db.insert(tenants).values({
      id: tenantId,
      name: 'Upgrade Salon',
      slug,
      settings: { require_payment_upfront: false },
      createdAt: Date.now(),
    });
    await db.insert(users).values({
      id: userId,
      tenantId,
      name: 'Upgrade Owner',
      phone,
      email: `${slug}@egebeya.test`,
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
    });

    token = tokenFor(userId, tenantId);
  });

  afterAll(async () => {
    await db.delete(proSiteFiles).where(eq(proSiteFiles.tenantId, tenantId));
    await db.delete(staff).where(eq(staff.tenantId, tenantId));
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId));
    await db.delete(users).where(eq(users.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('Free-tenant owner can read their subscription summary and plan', async () => {
    const res = await request(app)
      .get('/api/tenant/subscription')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.plan?.name).toBe('free');
    expect(res.body.subscription?.status).toBe('active');
    expect(res.body.subscription?.planId).toBe(freePlanId);
    expect(typeof res.body.staffUsage).toBe('number');
  });

  it('Free-tenant owner POST /upgrade moves to Pro plan with trial status', async () => {
    const res = await request(app)
      .post('/api/tenant/subscription/upgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.plan?.name).toBe('pro');
    expect(res.body.subscription?.status).toBe('trial');
    expect(res.body.subscription?.planId).toBe(proPlanId);
    // trialEndsAt must lie in the future and roughly 14 days out.
    const trialEnds = Number(res.body.subscription?.trialEndsAt);
    const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;
    const delta = trialEnds - Date.now();
    expect(delta).toBeGreaterThan(FOURTEEN_DAYS - 5 * 60 * 1000); // sanity (5min slop)
    expect(delta).toBeLessThan(FOURTEEN_DAYS + 5 * 60 * 1000);
  });

  it('a second upgrade click is a no-op (unchanged: true)', async () => {
    const res = await request(app)
      .post('/api/tenant/subscription/upgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.unchanged).toBe(true);
    // The plan stayed 'pro' (didn't get toggled back).
    expect(res.body.plan?.name).toBe('pro');
  });

  it('after upgrade, Pro-only endpoints are reachable (PUT /pro-site/files)', async () => {
    // The hardened pro-site endpoints return 403 PLAN_REQUIRED for Free
    // tenants; that gate should now let us through.
    const initRes = await request(app)
      .post('/api/tenant/pro-site/init')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(initRes.status).toBe(200);

    const putRes = await request(app)
      .put('/api/tenant/pro-site/files')
      .set('Authorization', `Bearer ${token}`)
      .send({ 'src/App.js': '// roundtrip test\n' });
    expect(putRes.status).toBe(200);

    const getRes = await request(app)
      .get('/api/tenant/pro-site/files')
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    // The init seeded a full starter template; the PUT added one new file.
    expect(getRes.body['src/App.js']).toMatch(/roundtrip test/);
  });

  it('downgrading back to Free (manual row update) flips PUT back to 403', async () => {
    // Simulate the natural end of a trial: flip the subscription back to
    // the free plan. Real billing would do this through the webhook today
    // or, when web-billing lands, through a similar downgrade route.
    await db.update(tenantSubscriptions)
      .set({ planId: freePlanId, status: 'expired' })
      .where(eq(tenantSubscriptions.tenantId, tenantId));

    const res = await request(app)
      .put('/api/tenant/pro-site/files')
      .set('Authorization', `Bearer ${token}`)
      .send({ 'src/App.js': '// should be rejected\n' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_REQUIRED');
  });
});
