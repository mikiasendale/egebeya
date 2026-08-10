import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import { tenants, users, staff, plans, tenantSubscriptions, proSiteFiles } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { grantProTrial } from '../../server/lib/trial';

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

  it('the old HTTP upgrade endpoint is no longer mounted', async () => {
    const res = await request(app)
      .post('/api/tenant/subscription/upgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('grantProTrial moves a Free tenant onto Pro trial using the new helper', async () => {
    await grantProTrial(tenantId);

    const res = await request(app)
      .get('/api/tenant/subscription')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.plan?.name).toBe('pro');
    expect(res.body.subscription?.status).toBe('trial');
    expect(res.body.subscription?.planId).toBe(proPlanId);
  });

  it('grantProTrial is idempotent: second call does not reset the trial clock', async () => {
    const first = await db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    const firstEnds = first!.trialEndsAt;
    await grantProTrial(tenantId);
    const second = await db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    expect(second!.trialEndsAt).toBe(firstEnds);
  });

  it('after grantProTrial, Pro-only endpoints are reachable (POST /pro-site/init)', async () => {
    const initRes = await request(app)
      .post('/api/tenant/pro-site/init')
      .set('Authorization', `Bearer ${token}`);
    expect(initRes.status).toBe(200);
  });
});
