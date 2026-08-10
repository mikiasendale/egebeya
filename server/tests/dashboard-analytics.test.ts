import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants, users,
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

/** UTC ms at the start of today's *Addis* (UTC+3) day. */
function addisDayStartMs(): number {
  const addis = new Date(Date.now() + 3 * 3600 * 1000);
  return Date.UTC(addis.getUTCFullYear(), addis.getUTCMonth(), addis.getUTCDate()) - 3 * 3600 * 1000;
}

describe('Owner Home dashboard (WP2.3/2.4)', () => {
  const slug = `dash-${Date.now()}`;
  let tenantId: string;
  let userId: string;
  let svcId: string;
  let staffId: string;

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    userId = crypto.randomUUID();
    const pwHash = await bcrypt.hash('pass1234', 10);
    await db.insert(tenants).values({ id: tenantId, name: 'Mobile Shop', slug, createdAt: Date.now() });
    await db.insert(users).values({
      id: userId, tenantId, name: 'Mobile Owner', phone: `+25171000002`,
      email: `dash-${Date.now()}@test.com`, passwordHash: pwHash, role: 'owner', createdAt: Date.now(),
    });
    svcId = crypto.randomUUID();
    staffId = crypto.randomUUID();
    await db.insert(servicesTable).values({
      id: svcId, tenantId, name: 'Full Service', durationMinutes: 60, price: 5000, active: true,
    });
    await db.insert(staff).values({ id: staffId, tenantId, name: 'Muna', active: true });
  });

  afterAll(async () => {
    const allAppts = await db.select().from(appointments).where(eq(appointments.tenantId, tenantId)).all();
    for (const a of allAppts) {
      await db.delete(payments).where(eq(payments.appointmentId, a.id)).catch(() => {});
    }
    await db.delete(appointments).where(eq(appointments.tenantId, tenantId)).catch(() => {});
    await db.delete(servicesTable).where(eq(servicesTable.tenantId, tenantId)).catch(() => {});
    await db.delete(staff).where(eq(staff.id, staffId)).catch(() => {});
    await db.delete(users).where(eq(users.id, userId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
  });

  async function seedAppt(startMs: number, status: string, phone: string, email: string | null): Promise<string> {
    const id = crypto.randomUUID();
    await db.insert(appointments).values({
      id, tenantId, customerName: `C-${id.slice(0, 4)}`,
      customerPhone: phone, customerEmail: email,
      staffId, serviceId: svcId,
      startTime: startMs, endTime: startMs + 3600000, status, reminderSent: false,
      opaqueId: crypto.randomBytes(16).toString('hex'),
    }).run();
    return id;
  }

  async function payCompleted(apptId: string, amountCents: number) {
    await db.insert(payments).values({
      id: crypto.randomUUID(), tenantId, appointmentId: apptId,
      amount: amountCents, gateway: 'chapa', status: 'completed',
    }).run();
  }

  it('returns today bookings + today completed revenue ETB with no PII', async () => {
    const dayStart = addisDayStartMs();

    // Recent past booking (yesterday) must NOT appear in today's feed.
    await await seedAppt(dayStart - 86400000, 'confirmed', '+251955555555', 'old@test.com');

    // Today: one confirmed, one pending — both appear in the schedule.
    const confirmedId = await await seedAppt(dayStart + 9 * 3600000, 'confirmed', '+25190000011', 'c1@test.com');
    await await seedAppt(dayStart + 11 * 3600000, 'pending', '+25190000012', null);

    // Today: a completed appointment with a completed Telebirr payment.
    const completedId = await await seedAppt(dayStart + 14 * 3600000, 'completed', '+25190000013', null);
    payCompleted(completedId, 5000); // 50.00 ETB

    const res = await request(app)
      .get('/api/tenant/dashboard')
      .set(authHeader({ userId, tenantId, role: 'owner' }));

    expect(res.status).toBe(200);
    const body = res.body;

    // today = confirmed + pending only (the completed row is excluded).
    expect(body.today).toHaveLength(2);
    expect(body.confirmedAppointments).toBe(1);
    expect(body.pendingAppointments).toBe(1);
    expect(body.completedAppointments).toBe(1);
    expect(body.todayAppointments).toBe(2);

    // Completed payment sum in ETB (cents / 100).
    expect(body.completedRevenueCents).toBe(5000);
    expect(body.completedRevenueEtb).toBe(50);

    // Schedule rows are whitelisted — time pre-formatted in Addis, no raw
    // epoch, no email/phone, and PII probes never surface.
    for (const row of body.today) {
      expect(typeof row.id).toBe('string');
      expect(typeof row.customerName).toBe('string');
      expect(typeof row.time).toBe('string');
      expect(row.time).toMatch(/^\d{2}:\d{2}$/);
      expect(row.startTime).toBeUndefined();
      expect(row.customerPhone).toBeUndefined();
      expect(row.customerEmail).toBeUndefined();
    }

    const json = JSON.stringify(body);
    expect(json).not.toMatch(/customer_email/);
    expect(json).not.toMatch(/customer_phone/);
    expect(json).not.toMatch(/2519\d{7}/);
    // yesterday's email must not be in the payload either
    expect(json).not.toContain('old@test.com');
  });

  it('exposes the walk-in trigger only to owners', async () => {
    const dayStart = addisDayStartMs();
    await await seedAppt(dayStart + 10 * 3600000, 'confirmed', '+25190000014', null);

    const ownerRes = await request(app)
      .get('/api/tenant/dashboard')
      .set(authHeader({ userId, tenantId, role: 'owner' }));
    expect(ownerRes.body.walkInEnabled).toBe(true);

    const staffRes = await request(app)
      .get('/api/tenant/dashboard')
      .set(authHeader({ userId, tenantId, role: 'staff' }));
    expect(staffRes.status).toBe(200);
    expect(staffRes.body.walkInEnabled).toBe(false);
  });
});