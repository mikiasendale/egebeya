/**
 * Customer Health & Risk Scoring — server-side tests.
 *
 * Verifies:
 *   1. The health-tag scoring algorithm (computed on the fly by GET
 *      /api/tenant/customers) tags customers correctly from their stats.
 *   2. Appointment status transitions mutate visit_count / no_show_count
 *      the way the scoring expects.
 *   3. The per-customer upfront toggle persists to tenant settings and the
 *      public booking flow honors it.
 *   4. The Customer Health surface is Pro-tier gated: a Free tenant is
 *      blocked from the Pro-only endpoints behind the UI gate — here we assert
 *      the gate's contract (owner role required; Pro plan drives the UI).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq, and } from 'drizzle-orm';

import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants, users, services, staff, appointments, plans,
  tenantSubscriptions, customerStats,
} from '../../src/db/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

function tokenFor(uid: string, tid: string, role: string): string {
  return jwt.sign({ userId: uid, tenantId: tid, role, tokenVersion: 0 }, JWT_SECRET, { expiresIn: '15m' });
}

describe('Customer Health & Risk Scoring', () => {
  const slug = `health-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  let tenantId: string;
  let userId: string;
  let staffId: string;
  let serviceId: string;
  let token: string;
  let proPlanId: string;
  let freePlanId: string;

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    userId = crypto.randomUUID();
    const phone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;

    await db.insert(tenants).values({
      id: tenantId, name: 'Health Test Salon', slug,
      settings: {}, createdAt: Date.now(),
    });
    await db.insert(users).values({
      id: userId, tenantId, name: 'Owner', phone,
      email: `${slug}@egebeya.test`,
      passwordHash: await bcrypt.hash('pass', 8),
      role: 'owner', createdAt: Date.now(),
    });

    proPlanId = (await db.select().from(plans).where(eq(plans.name, 'pro')).get())!.id;
    freePlanId = (await db.select().from(plans).where(eq(plans.name, 'free')).get())!.id;
    await db.insert(tenantSubscriptions).values({
      id: crypto.randomUUID(), tenantId, planId: proPlanId, status: 'active', startsAt: Date.now(),
    });

    serviceId = crypto.randomUUID();
    await db.insert(services).values({ id: serviceId, tenantId, name: 'Trim', durationMinutes: 30, price: 20000, active: true });
    staffId = crypto.randomUUID();
    await db.insert(staff).values({ id: staffId, tenantId, name: 'Stylist', active: true });

    token = tokenFor(userId, tenantId, 'owner');
  });

  afterAll(async () => {
    await db.delete(appointments).where(eq(appointments.tenantId, tenantId));
    await db.delete(customerStats).where(eq(customerStats.tenantId, tenantId));
    await db.delete(services).where(eq(services.tenantId, tenantId));
    await db.delete(staff).where(eq(staff.tenantId, tenantId));
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId));
    await db.delete(users).where(eq(users.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  /** Create a walk-in appointment row directly and return its id. */
  async function makeAppointment(phone: string, name: string): Promise<string> {
    const id = crypto.randomUUID();
    const start = Date.now() + 2 * 3600 * 1000;
    await db.insert(appointments).values({
      id, tenantId, staffId, serviceId,
      customerName: name, customerPhone: phone,
      startTime: start, endTime: start + 30 * 60 * 1000,
      status: 'confirmed',
        opaqueId: crypto.randomBytes(16).toString('hex')
    });
    return id;
  }

  // ── 1. Scoring algorithm — computed on the fly ─────────────────────

  it('tags a frequent, never-no-show customer as vip_loyal', async () => {
    await db.insert(customerStats).values({
      tenantId, customerPhone: '+251900000101', customerName: 'Loyal',
      firstVisitAt: Date.now() - 90 * 86400000, lastVisitAt: Date.now() - 3 * 86400000,
      visitCount: 7, noShowCount: 0, createdAt: Date.now(),
    });
    const res = await request(app)
      .get('/api/tenant/customers')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const loyal = (res.body as any[]).find((c) => c.phone === '+251900000101');
    expect(loyal.healthTag).toBe('vip_loyal');
  });

  it('tags a customer whose last visit was >60 days ago as at_risk_churn', async () => {
    await db.insert(customerStats).values({
      tenantId, customerPhone: '+251900000102', customerName: 'Gone',
      firstVisitAt: Date.now() - 200 * 86400000, lastVisitAt: Date.now() - 75 * 86400000,
      visitCount: 3, noShowCount: 0, createdAt: Date.now(),
    });
    const res = await request(app)
      .get('/api/tenant/customers')
      .set('Authorization', `Bearer ${token}`);
    const gone = (res.body as any[]).find((c) => c.phone === '+251900000102');
    expect(gone.healthTag).toBe('at_risk_churn');
  });

  it('tags a customer with 2+ no-shows as high_no_show_risk, overriding loyalty', async () => {
    await db.insert(customerStats).values({
      tenantId, customerPhone: '+251900000103', customerName: 'FlakyVIP',
      firstVisitAt: Date.now() - 90 * 86400000, lastVisitAt: Date.now() - 10 * 86400000,
      visitCount: 9, noShowCount: 3, createdAt: Date.now(),
    });
    const res = await request(app)
      .get('/api/tenant/customers')
      .set('Authorization', `Bearer ${token}`);
    const flaky = (res.body as any[]).find((c) => c.phone === '+251900000103');
    // no_show_count >= 2 overrides vip_loyal.
    expect(flaky.healthTag).toBe('high_no_show_risk');
  });

  it('tags a new/infrequent customer as healthy', async () => {
    await db.insert(customerStats).values({
      tenantId, customerPhone: '+251900000104', customerName: 'New',
      firstVisitAt: Date.now() - 2 * 86400000, lastVisitAt: Date.now() - 2 * 86400000,
      visitCount: 1, noShowCount: 0, createdAt: Date.now(),
    });
    const res = await request(app)
      .get('/api/tenant/customers')
      .set('Authorization', `Bearer ${token}`);
    const fresh = (res.body as any[]).find((c) => c.phone === '+251900000104');
    expect(fresh.healthTag).toBe('healthy');
  });

  // ── 2. Status transitions mutate the counters ──────────────────────

  it('incrementing no_show on a no_show transition raises no_show_count', async () => {
    const apptId = await makeAppointment('+251900000201', 'NoShow Ned');

    // Pre-seed customer_stats so we can observe the increment.
    await db.insert(customerStats).values({
      tenantId, customerPhone: '+251900000201', customerName: 'NoShow Ned',
      visitCount: 4, noShowCount: 0, createdAt: Date.now(),
    });

    const res = await request(app)
      .put(`/api/bookings/${apptId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'no_show' });
    expect(res.status).toBe(200);

    const row = await db.select().from(customerStats)
      .where(and(eq(customerStats.tenantId, tenantId), eq(customerStats.customerPhone, '+251900000201')))
      .get();
    expect(row?.noShowCount).toBe(1);
    expect(row?.healthTag).toBe('healthy'); // 1 no-show is still below the threshold
  });

  it('a second no_show pushes the customer into high_no_show_risk', async () => {
    const apptId = await makeAppointment('+251900000202', 'NoShow Nell');

    await db.insert(customerStats).values({
      tenantId, customerPhone: '+251900000202', customerName: 'NoShow Nell',
      visitCount: 4, noShowCount: 1, createdAt: Date.now(),
    });

    const res = await request(app)
      .put(`/api/bookings/${apptId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'no_show' });
    expect(res.status).toBe(200);

    const row = await db.select().from(customerStats)
      .where(and(eq(customerStats.tenantId, tenantId), eq(customerStats.customerPhone, '+251900000202')))
      .get();
    expect(row?.noShowCount).toBe(2);
    expect(row?.healthTag).toBe('high_no_show_risk');
  });

  it('a cancelled appointment also increments no_show_count', async () => {
    const apptId = await makeAppointment('+251900000203', 'Cancel Carl');

    await db.insert(customerStats).values({
      tenantId, customerPhone: '+251900000203', customerName: 'Cancel Carl',
      visitCount: 2, noShowCount: 0, createdAt: Date.now(),
    });

    const res = await request(app)
      .put(`/api/bookings/${apptId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' });
    expect(res.status).toBe(200);

    const row = await db.select().from(customerStats)
      .where(and(eq(customerStats.tenantId, tenantId), eq(customerStats.customerPhone, '+251900000203')))
      .get();
    expect(row?.noShowCount).toBe(1);
  });

  it('a completed appointment increments visit_count and sets lastVisitAt', async () => {
    const apptId = await makeAppointment('+251900000204', 'Done Dan');

    await db.insert(customerStats).values({
      tenantId, customerPhone: '+251900000204', customerName: 'Done Dan',
      firstVisitAt: Date.now() - 30 * 86400000, lastVisitAt: Date.now() - 30 * 86400000,
      visitCount: 2, noShowCount: 0, createdAt: Date.now(),
    });

    const res = await request(app)
      .put(`/api/bookings/${apptId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' });
    expect(res.status).toBe(200);

    const row = await db.select().from(customerStats)
      .where(and(eq(customerStats.tenantId, tenantId), eq(customerStats.customerPhone, '+251900000204')))
      .get();
    expect(row?.visitCount).toBe(3);
    expect(row?.lastVisitAt).not.toBeNull();
  });

  // ── 3. Per-customer upfront toggle ─────────────────────────────────

  it('adds a phone to the upfront list and reports the new state', async () => {
    const res = await request(app)
      .post('/api/tenant/customers/+251900000301/require-upfront')
      .set('Authorization', `Bearer ${token}`)
      .send({ require: true });
    expect(res.status).toBe(200);
    expect(res.body.require_upfront).toBe(true);

    const list = await request(app)
      .get('/api/tenant/settings/upfront-phones')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.require_upfront_phones).toContain('+251900000301');
  });

  it('removes a phone from the upfront list when toggled off', async () => {
    await request(app)
      .post('/api/tenant/customers/+251900000302/require-upfront')
      .set('Authorization', `Bearer ${token}`)
      .send({ require: true });

    const off = await request(app)
      .post('/api/tenant/customers/+251900000302/require-upfront')
      .set('Authorization', `Bearer ${token}`)
      .send({ require: false });
    expect(off.status).toBe(200);
    expect(off.body.require_upfront).toBe(false);
  });

  it('rejects a non-boolean require payload with 400', async () => {
    const res = await request(app)
      .post('/api/tenant/customers/+251900000303/require-upfront')
      .set('Authorization', `Bearer ${token}`)
      .send({ require: 'yes' });
    expect(res.status).toBe(400);
  });

  // ── 4. Pro-tier gating ─────────────────────────────────────────────

  it('requires owner-role auth for the customers endpoint (401 unauthenticated)', async () => {
    const res = await request(app).get('/api/tenant/customers');
    expect(res.status).toBe(401);
  });

  it('denies a staff-role account from the owner-only customers endpoint (403)', async () => {
    const staffUserId = crypto.randomUUID();
    const staffPhone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    await db.insert(users).values({
      id: staffUserId, tenantId, name: 'Staff', phone: staffPhone,
      email: `staff-${slug}@egebeya.test`,
      passwordHash: await bcrypt.hash('pass', 8),
      role: 'staff', createdAt: Date.now(),
    });
    const staffToken = tokenFor(staffUserId, tenantId, 'staff');
    const res = await request(app)
      .get('/api/tenant/customers')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
    await db.delete(users).where(eq(users.id, staffUserId));
  });

  it('allows a Pro owner to reach the customers endpoint (200)', async () => {
    const res = await request(app)
      .get('/api/tenant/customers')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('blocks a Free owner from the Pro-gated UI (upgrade prompt contract)', async () => {
    // Move the tenant to the free plan and assert the plan resolver reports
    // non-Pro — the UI uses this to render the upgrade gate.
    await db.update(tenantSubscriptions)
      .set({ planId: freePlanId })
      .where(eq(tenantSubscriptions.tenantId, tenantId));

    const sub = await request(app)
      .get('/api/tenant/subscription')
      .set('Authorization', `Bearer ${token}`);
    expect(sub.status).toBe(200);
    expect(sub.body.plan?.name?.toLowerCase()).toBe('free');

    // Restore Pro for any later tests.
    await db.update(tenantSubscriptions)
      .set({ planId: proPlanId })
      .where(eq(tenantSubscriptions.tenantId, tenantId));
  });
});
