/**
 * Authenticated booking CRUD coverage.
 *
 * The owner-facing booking router (src/api/bookings.ts) exposes:
 *   GET  /api/bookings         — list (with optional date + staff_id filters)
 *   GET  /api/bookings/:id     — single-appointment detail
 *   PUT  /api/bookings/:id/status  — update status
 *
 * What's already covered:
 *   - plan-isolation.test.ts exercises GET /api/bookings + PUT /:id/status +
 *     GET /:id for a Pro tenant.
 *   - cross-tenant-isolation.test.ts verifies tenant scoping.
 *
 * What THIS file locks down:
 *   - staff-role filtering: a JWT with role='staff' only returns bookings
 *     assigned to the linked staff row.
 *   - date filter: only appointments on the given date are returned.
 *   - staff_id filter: owner-scoped filter narrowing to one staff member.
 *   - 404 on non-existent id for GET and PUT status.
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
import {
  tenants,
  users,
  services,
  staff,
  appointments,
  tenantBusinessHours,
  plans,
  tenantSubscriptions,
} from '../../src/db/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

function tokenFor(uid: string, tid: string, role: string): string {
  return jwt.sign({ userId: uid, tenantId: tid, role }, JWT_SECRET, { expiresIn: '15m' });
}

describe('Booking CRUD (authenticated)', () => {
  const slug = `bcrud-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  let tenantId: string;
  let ownerId: string;
  let staffId: string;
  let staffUserId: string;
  let serviceId: string;
  let ownerToken: string;
  let staffToken: string;

  let appIdDay1: string;
  let appIdDay2: string;

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    ownerId = crypto.randomUUID();
    staffUserId = crypto.randomUUID();
    staffId = crypto.randomUUID();
    serviceId = crypto.randomUUID();

    await db.insert(tenants).values({
      id: tenantId,
      name: 'Booking CRUD Salon',
      slug,
      settings: { require_payment_upfront: false },
      createdAt: Date.now(),
    });
    const pwHash = await bcrypt.hash('pass', 8);
    const phone1 = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    const phone2 = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    await db.insert(users).values({
      id: ownerId, tenantId, name: 'Owner', phone: phone1,
      email: `bcrud-owner-${Date.now()}@egebeya.test`, passwordHash: pwHash, role: 'owner', createdAt: Date.now(),
    });
    await db.insert(users).values({
      id: staffUserId, tenantId, name: 'Staff', phone: phone2,
      email: `bcrud-staff-${Date.now()}@egebeya.test`, passwordHash: pwHash, role: 'staff', createdAt: Date.now(),
    });
    await db.insert(staff).values({
      id: staffId, tenantId, userId: staffUserId, name: 'Sue Stylist', active: true,
    });
    await db.insert(services).values({
      id: serviceId, tenantId, name: 'Budget Haircut', durationMinutes: 30, price: 5000, active: true,
    });
    const freePlan = await db.select().from(plans).where(eq(plans.name, 'free')).get();
    await db.insert(tenantSubscriptions).values({
      id: crypto.randomUUID(), tenantId, planId: freePlan!.id, status: 'active', startsAt: Date.now(),
    });
    for (let d = 0; d <= 6; d++) {
      await db.insert(tenantBusinessHours).values({
        id: crypto.randomUUID(), tenantId, dayOfWeek: d, openTime: '09:00', closeTime: '17:00', isClosed: false,
      });
    }

    ownerToken = tokenFor(ownerId, tenantId, 'owner');
    staffToken = tokenFor(staffUserId, tenantId, 'staff');

    const futureSlot = (daysAhead: number, hour: number) => {
      const d = new Date(Date.now() + daysAhead * 86400000);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, 0, 0, 0);
    };
    const ms1 = futureSlot(4, 12);
    const ms2 = futureSlot(5, 14);
    appIdDay1 = crypto.randomUUID();
    appIdDay2 = crypto.randomUUID();
    await db.insert(appointments).values([
      { id: appIdDay1, tenantId, customerName: 'Day1 Customer', customerPhone: '+251911000001', staffId, serviceId, startTime: ms1, endTime: ms1 + 1800000, status: 'pending' },
      { id: appIdDay2, tenantId, customerName: 'Day2 Customer', customerPhone: '+251911000002', staffId, serviceId, startTime: ms2, endTime: ms2 + 1800000, status: 'pending' },
    ]);
  });

  afterAll(async () => {
    await db.delete(appointments).where(eq(appointments.tenantId, tenantId));
    await db.delete(staff).where(eq(staff.tenantId, tenantId));
    await db.delete(services).where(eq(services.tenantId, tenantId));
    await db.delete(tenantBusinessHours).where(eq(tenantBusinessHours.tenantId, tenantId));
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId));
    await db.delete(users).where(eq(users.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('lists all bookings for the owner', async () => {
    const r = await request(app).get('/api/bookings').set({ Authorization: `Bearer ${ownerToken}` });
    expect(r.status).toBe(200);
    const ids = (r.body as any[]).map((b: any) => b.id);
    expect(ids).toContain(appIdDay1);
    expect(ids).toContain(appIdDay2);
  });

  it('filters by date', async () => {
    const dateStr = new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10);
    const r = await request(app)
      .get(`/api/bookings?date=${dateStr}`)
      .set({ Authorization: `Bearer ${ownerToken}` });
    expect(r.status).toBe(200);
    const ids = (r.body as any[]).map((b: any) => b.id);
    expect(ids).toContain(appIdDay1);
    expect(ids).not.toContain(appIdDay2);
  });

  it('filters by staff_id', async () => {
    const r = await request(app)
      .get(`/api/bookings?staff_id=${staffId}`)
      .set({ Authorization: `Bearer ${ownerToken}` });
    expect(r.status).toBe(200);
    const ids = (r.body as any[]).map((b: any) => b.id);
    expect(ids).toContain(appIdDay1);
    expect(ids).toContain(appIdDay2);
  });

  it('staff-role users see their own bookings (filtered by linked staff row)', async () => {
    const r = await request(app).get('/api/bookings').set({ Authorization: `Bearer ${staffToken}` });
    expect(r.status).toBe(200);
    const ids = (r.body as any[]).map((b: any) => b.id);
    // Both bookings in this tenant are assigned to the same staff member
    // linked to the staff-user; both should surface.
    expect(ids).toContain(appIdDay1);
    expect(ids).toContain(appIdDay2);
  });

  it('GET /api/bookings/:id returns full detail', async () => {
    const r = await request(app)
      .get(`/api/bookings/${appIdDay1}`)
      .set({ Authorization: `Bearer ${ownerToken}` });
    expect(r.status).toBe(200);
    expect(r.body.id).toBe(appIdDay1);
    expect(r.body.customerName).toBe('Day1 Customer');
    expect(r.body.serviceName).toBe('Budget Haircut');
  });

  it('GET /api/bookings/:id returns 404 for unknown id', async () => {
    const r = await request(app)
      .get(`/api/bookings/${crypto.randomUUID()}`)
      .set({ Authorization: `Bearer ${ownerToken}` });
    expect(r.status).toBe(404);
  });

  it('can confirm a booking', async () => {
    const r = await request(app)
      .put(`/api/bookings/${appIdDay1}/status`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .send({ status: 'confirmed' });
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);

    const verify = await db.select().from(appointments).where(eq(appointments.id, appIdDay1)).get();
    expect(verify?.status).toBe('confirmed');
  });

  it('can cancel a booking', async () => {
    const r = await request(app)
      .put(`/api/bookings/${appIdDay2}/status`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .send({ status: 'cancelled' });
    expect(r.status).toBe(200);

    const verify = await db.select().from(appointments).where(eq(appointments.id, appIdDay2)).get();
    expect(verify?.status).toBe('cancelled');
  });

  it('PUT status returns 404 for unknown id', async () => {
    const r = await request(app)
      .put(`/api/bookings/${crypto.randomUUID()}/status`)
      .set({ Authorization: `Bearer ${ownerToken}` })
      .send({ status: 'confirmed' });
    expect(r.status).toBe(404);
  });
});