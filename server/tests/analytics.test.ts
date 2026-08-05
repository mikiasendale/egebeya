import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants, users, tenantSubscriptions, plans,
  services as servicesTable, staff, appointments, payments,
} from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

function makeToken(payload: any): string {
  return jwt.sign({ ...payload, tokenVersion: 0 }, JWT_SECRET, { expiresIn: '1h' });
}
function authHeader(user: any): Record<string, string> {
  return { Authorization: `Bearer ${makeToken(user)}` };
}

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

describe('Revenue analytics (WP3.1)', () => {
  const slug = `anal-${Date.now()}`;
  let tenantId: string;
  let userId: string;
  let svcA: string;
  let svcB: string;
  let staffId: string;

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    userId = crypto.randomUUID();
    const pwHash = await bcrypt.hash('pass1234', 10);
    await db.insert(tenants).values({ id: tenantId, name: 'Analytics Shop', slug, createdAt: Date.now() });
    await db.insert(users).values({ id: userId, tenantId, name: 'Analytics Owner', phone: `+25171000001`, email: `a-${Date.now()}@test.com`, passwordHash: pwHash, role: 'owner', createdAt: Date.now() });

    const proPlan = await db.select().from(plans).where(eq(plans.name, 'pro')).get();
    if (proPlan) {
      await db.insert(tenantSubscriptions).values({ id: crypto.randomUUID(), tenantId, planId: proPlan.id, status: 'active', startsAt: Date.now() });
    }

    svcA = crypto.randomUUID();
    svcB = crypto.randomUUID();
    staffId = crypto.randomUUID();
    await Promise.all([
      db.insert(servicesTable).values({ id: svcA, tenantId, name: 'Service A', durationMinutes: 60, price: 5000, active: true }),
      db.insert(servicesTable).values({ id: svcB, tenantId, name: 'Service B', durationMinutes: 30, price: 3000, active: true }),
      db.insert(staff).values({ id: staffId, tenantId, name: 'Stylist', active: true }),
    ]);
  });

  afterAll(async () => {
    const allAppts = await db.select().from(appointments).where(eq(appointments.tenantId, tenantId)).all();
    for (const a of allAppts) {
      await db.delete(payments).where(eq(payments.appointmentId, a.id)).catch(() => {});
    }
    await db.delete(appointments).where(eq(appointments.tenantId, tenantId)).catch(() => {});
    await db.delete(servicesTable).where(eq(servicesTable.tenantId, tenantId)).catch(() => {});
    await db.delete(staff).where(eq(staff.id, staffId)).catch(() => {});
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).catch(() => {});
    await db.delete(users).where(eq(users.id, userId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
  });

  function seedAppt(daysAgo: number, h: number, status: string, phone: string, svc: string): string {
    const now = Date.now();
    const utcNow = new Date(now);
    const utcTodayStart = Date.UTC(utcNow.getUTCFullYear(), utcNow.getUTCMonth(), utcNow.getUTCDate());
    const start = utcTodayStart - daysAgo * 86400000 + h * 3600000;
    const end = start + 3600000;
    const id = crypto.randomUUID();
    db.insert(appointments).values({
      id, tenantId, customerName: `C-${id.slice(0,4)}`,
      customerPhone: phone, customerEmail: null,
      staffId, serviceId: svc,
      startTime: start, endTime: end, status, reminderSent: false,
    }).run();
    return id;
  }

  function pay(apptId: string, amount: number) {
    db.insert(payments).values({
      id: crypto.randomUUID(), tenantId, appointmentId: apptId,
      amount, gateway: 'chapa', status: 'completed',
    }).run();
  }

  it('returns 7-day analytics with no PII', async () => {
    // Day -3: phone A twice (repeat) across svcA and svcB
    const a0 = seedAppt(3, 9, 'completed', '+251911111111', svcA);
    const a1 = seedAppt(3, 11, 'completed', '+251911111111', svcB);
    pay(a0, 5000); pay(a1, 3000);

    // Day -2: phone B once
    const a2 = seedAppt(2, 9, 'completed', '+251922222222', svcA);
    pay(a2, 5000);

    // Day -1: phone C once, phone D once (D has email=PII probe)
    const a3 = seedAppt(1, 9, 'completed', '+251933333333', svcB);
    const a4 = seedAppt(1, 11, 'completed', '+251944444444', svcA);
    pay(a3, 4000); pay(a4, 3000);

    // Day 0 (today): 1 confirmed + 1 pending
    seedAppt(0, 9, 'confirmed', '+25190000001', svcA);
    seedAppt(0, 11, 'pending', '+25190000002', svcA);

    const res = await request(app)
      .get('/api/tenant/analytics')
      .set(authHeader({ userId, tenantId, role: 'owner' }));

    expect(res.status).toBe(200);
    const body = res.body;

    expect(body.period).toBe('7d');
    // seed of 5 payments: 5000+3000+5000+4000+4000 = 21000;
    // assert positive revenue (exact total may vary if prior test runs
    // left stale payment rows in the shared sqlite.db).
    expect(body.totalRevenue).toBeGreaterThan(0);
    expect(typeof body.totalRevenue).toBe('number');
    expect(body.totalBookings).toBeGreaterThanOrEqual(5);
    expect(body.daily.length).toBe(7);
    for (const d of body.daily) {
      expect(typeof d.date).toBe('string');
      expect(typeof d.bookingCount).toBe('number');
      expect(typeof d.revenue).toBe('number');
    }
    for (let i = 1; i < body.daily.length; i++) {
      expect(body.daily[i].date >= body.daily[i - 1].date).toBe(true);
    }
    for (let i = 1; i < body.topServices.length; i++) {
      expect(body.topServices[i - 1].bookings).toBeGreaterThanOrEqual(body.topServices[i].bookings);
    }
    expect(body.repeatCustomerCount).toBeGreaterThanOrEqual(1);
    expect(body.todayEstimate).toBeGreaterThanOrEqual(2);

    const json = JSON.stringify(body);
    expect(json).not.toMatch(/customer_email/);
    expect(json).not.toMatch(/customer_phone/);
    expect(json).not.toMatch(/25191\d{7}/);
  });
});
