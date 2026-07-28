/**
 * Plan-limit staff cap enforcement on POST /api/tenant/staff.
 *
 * Coverage:
 *   - Free-tenant owner can add staff up to `plans.maxStaff` (2 today)
 *     but is hard-stopped on the 3rd with a 403 carrying the
 *     "Staff limit reached" message.
 *   - Pro-tenant owner (after upgrading via /api/tenant/subscription/upgrade)
 *     can add staff beyond the Free cap (10 in seeded data). We exhaust the
 *     Pro ceiling as well to lock down the contract symmetrically.
 *   - The 403 paths return a stable JSON shape the dashboard warns against;
 *     we assert the user-visible message names the plan's max so the UI
 *     can show "Upgrade to add more staff" without a manual mapping.
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
  services,
  plans,
  tenantSubscriptions,
} from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

async function signupOwner(tenantName: string, slug: string, opts: { phone?: string } = {}) {
  const userId = crypto.randomUUID();
  const tenantId = crypto.randomUUID();
  const pwHash = await bcrypt.hash('pass1234', 10);
  const phone = opts.phone || `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;

  await db.insert(tenants).values({
    id: tenantId,
    name: tenantName,
    slug,
    settings: { require_payment_upfront: false },
    createdAt: Date.now(),
  });
  await db.insert(users).values({
    id: userId,
    tenantId,
    name: `${tenantName} Owner`,
    phone,
    email: `${slug}-${Date.now()}@egebeya.test`,
    passwordHash: pwHash,
    role: 'owner',
    createdAt: Date.now(),
  });

  // Provision a free subscription by default — matches /register's behaviour.
  const freePlan = await db.select().from(plans).where(eq(plans.name, 'free')).get();
  await db.insert(tenantSubscriptions).values({
    id: crypto.randomUUID(),
    tenantId,
    planId: freePlan!.id,
    status: 'active',
    startsAt: Date.now(),
  });

  const token = jwt_for(userId, tenantId);
  return { tenantId, userId, token };
}

function jwt_for(userId: string, tenantId: string): string {
  // Inline import so the test file stays simple.
  const jwt = require('jsonwebtoken');
  return jwt.sign({ userId, tenantId, role: 'owner' }, JWT_SECRET, { expiresIn: '15m' });
}

describe('Plan-limit staff cap enforcement', () => {
  const freeSlug = `cap-free-${Date.now()}`;
  const proSlug = `cap-pro-${Date.now()}`;
  let freeOwner: { tenantId: string; userId: string; token: string };
  let proOwner: { tenantId: string; userId: string; token: string };

  beforeAll(async () => {
    freeOwner = await signupOwner('Cap Free', freeSlug);
    proOwner = await signupOwner('Cap Pro', proSlug);

    // Move the Pro tenant up to the pro plan so they have the higher cap
    // (10) and can add more staff than Free.
    const proPlan = await db.select().from(plans).where(eq(plans.name, 'pro')).get();
    await db.update(tenantSubscriptions)
      .set({ planId: proPlan!.id, status: 'active' })
      .where(eq(tenantSubscriptions.tenantId, proOwner.tenantId));
  });

  afterAll(async () => {
    for (const t of [freeOwner.tenantId, proOwner.tenantId]) {
      await db.delete(staff).where(eq(staff.tenantId, t));
      await db.delete(services).where(eq(services.tenantId, t));
      await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, t));
      await db.delete(users).where(eq(users.tenantId, t));
      await db.delete(tenants).where(eq(tenants.id, t));
    }
  });

  it('Free tenant can add up to plan.maxStaff (default 2) staff', async () => {
    // Add staff 1 — should succeed.
    const r1 = await request(app)
      .post('/api/tenant/staff')
      .set('Authorization', `Bearer ${freeOwner.token}`)
      .send({ name: 'Free Staff 1' });
    expect(r1.status).toBe(201);
    expect(r1.body.name).toBe('Free Staff 1');

    // Add staff 2 — also succeeds (at the cap).
    const r2 = await request(app)
      .post('/api/tenant/staff')
      .set('Authorization', `Bearer ${freeOwner.token}`)
      .send({ name: 'Free Staff 2' });
    expect(r2.status).toBe(201);

    // Add staff 3 — must 403 with the plan-namesake message.
    const r3 = await request(app)
      .post('/api/tenant/staff')
      .set('Authorization', `Bearer ${freeOwner.token}`)
      .send({ name: 'Free Staff 3' });
    expect(r3.status).toBe(403);
    expect(String(r3.body.error || '')).toMatch(/staff limit/i);
    // The plan's max-staff value should appear in the message so the UI
    // can show it without a hardcoded mapping.
    expect(String(r3.body.error || '')).toMatch(/max 2/i);
  });

  it('Pro tenant can add staff up to its plan limit (default 10)', async () => {
    // We add 10 staff — every call should succeed (no cap hit).
    for (let i = 1; i <= 10; i++) {
      const res = await request(app)
        .post('/api/tenant/staff')
        .set('Authorization', `Bearer ${proOwner.token}`)
        .send({ name: `Pro Staff ${i}` });
      expect(res.status).toBe(201);
    }
    // The 11th addition is the cap exactly hit — must 403 with max=10.
    const r11 = await request(app)
      .post('/api/tenant/staff')
      .set('Authorization', `Bearer ${proOwner.token}`)
      .send({ name: 'Pro Staff 11' });
    expect(r11.status).toBe(403);
    expect(String(r11.body.error || '')).toMatch(/max 10/i);
  });

  it('plan-limit middleware refuses callers with no tenant context (401)', async () => {
    // A JWT signed without a tenantId — simulates a platform-admin-style
    // user who has no tenant. The planLimit middleware short-circuits
    // before reading any plan rows.
    const jwt = require('jsonwebtoken');
    const fakeToken = jwt.sign({ userId: 'orphan', tenantId: null, role: 'owner' }, JWT_SECRET, { expiresIn: '15m' });
    const res = await request(app)
      .post('/api/tenant/staff')
      .set('Authorization', `Bearer ${fakeToken}`)
      .send({ name: 'Orphan Staff' });
    expect(res.status).toBe(401);
  });
});
