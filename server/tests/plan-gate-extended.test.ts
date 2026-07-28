/**
 * Plan-gate extended: TRIAL_EXPIRED path and Free blocked from every
 * Pro-only endpoint.
 *
 * What's already covered:
 *   - plan-isolation.test.ts: Free → 403 PLAN_REQUIRED on /pro-site/*,
 *     Pro → 200 on the same routes after /init.
 *   - subscription-upgrade.test.ts: Free→Pro upgrade, no-op re-upgrade
 *     (unchanged), Pro-granted roundtrip, and downgrade-back-to-Free flips
 *     the gate back to 403.
 *
 * What THIS file covers:
 *   - The trial-expired path: set trialEndsAt in the past, assert 403
 *     with code TRIAL_EXPIRED for /pro-site/* (the code path in
 *     requireProPlan at src/api/pro-site.ts:93-103).
 *   - Free tenant blocked on domain endpoint (PUT /api/tenant/domain
 *     requires an active subscription and plan.customDomainAllowed).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';

import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import { tenants, users, plans, tenantSubscriptions, proSiteFiles } from '../../src/db/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

function tokenFor(uid: string, tid: string, role: string): string {
  return jwt.sign({ userId: uid, tenantId: tid, role }, JWT_SECRET, { expiresIn: '15m' });
}

describe('Plan-gate extended — trial-expired + domain gate', () => {
  const slug = `pg-ext-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  let tenantId: string;
  let userId: string;
  let token: string;
  let proPlanId: string;
  let freePlanId: string;

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    userId = crypto.randomUUID();

    const phone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    await db.insert(tenants).values({
      id: tenantId, name: 'Plan Gate Ext', slug,
      settings: {}, createdAt: Date.now(),
    });
    await db.insert(users).values({
      id: userId, tenantId, name: 'Owner', phone,
      email: `pg-ext-${slug}@egebeya.test`,
      passwordHash: await bcrypt.hash('pass', 8),
      role: 'owner', createdAt: Date.now(),
    });

    freePlanId = (await db.select().from(plans).where(eq(plans.name, 'free')).get())!.id;
    proPlanId = (await db.select().from(plans).where(eq(plans.name, 'pro')).get())!.id;

    // Start as Free
    await db.insert(tenantSubscriptions).values({
      id: crypto.randomUUID(), tenantId, planId: freePlanId, status: 'active', startsAt: Date.now(),
    });

    token = tokenFor(userId, tenantId, 'owner');
  });

  afterAll(async () => {
    await db.delete(proSiteFiles).where(eq(proSiteFiles.tenantId, tenantId));
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId));
    await db.delete(users).where(eq(users.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('Free tenant → PUT /api/tenant/pro-site/files returns 403 PLAN_REQUIRED', async () => {
    const r = await request(app)
      .put('/api/tenant/pro-site/files')
      .set({ Authorization: `Bearer ${token}` })
      .send({ 'App.js': '// nope' });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('PLAN_REQUIRED');
  });

  it('Free tenant → GET /api/tenant/pro-site/files returns 403', async () => {
    const r = await request(app)
      .get('/api/tenant/pro-site/files')
      .set({ Authorization: `Bearer ${token}` });
    expect(r.status).toBe(403);
  });

  it('Free tenant → POST /api/tenant/pro-site/init returns 403', async () => {
    const r = await request(app)
      .post('/api/tenant/pro-site/init')
      .set({ Authorization: `Bearer ${token}` });
    expect(r.status).toBe(403);
  });

  it('Free tenant → PUT /api/tenant/domain returns 403', async () => {
    const r = await request(app)
      .put('/api/tenant/domain')
      .set({ Authorization: `Bearer ${token}` })
      .send({ domain: 'custom.egebeya.et' });
    expect(r.status).toBe(403);
  });

  it('after moving to Pro with expired trial, pro-site returns 403 TRIAL_EXPIRED', async () => {
    // Move to Pro with a trial that ended yesterday.
    const yesterday = Date.now() - 24 * 3600 * 1000;
    await db.update(tenantSubscriptions)
      .set({ planId: proPlanId, status: 'trial', trialEndsAt: yesterday })
      .where(eq(tenantSubscriptions.tenantId, tenantId));

    const r = await request(app)
      .get('/api/tenant/pro-site/files')
      .set({ Authorization: `Bearer ${token}` });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('TRIAL_EXPIRED');
  });

  it('an expired-subscription (status=expired, free plan) returns PLAN_REQUIRED not TRIAL_EXPIRED', async () => {
    await db.update(tenantSubscriptions)
      .set({ planId: freePlanId, status: 'expired', trialEndsAt: null })
      .where(eq(tenantSubscriptions.tenantId, tenantId));

    const r = await request(app)
      .get('/api/tenant/pro-site/files')
      .set({ Authorization: `Bearer ${token}` });
    expect(r.status).toBe(403);
    // The requireProPlan gate checks status first (not 'active'/'trial')
    // then plan name. Since status is 'expired', it fails BEFORE looking
    // at the plan — the error code is PLAN_REQUIRED.
    expect(r.body.code).toBe('PLAN_REQUIRED');
  });
});