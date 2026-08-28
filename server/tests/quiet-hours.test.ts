/**
 * P5.6 — quiet-hours flag: discount math, validation, analytics feed.
 *
 *   - Owner PUT validates the window + percent and stores settings JSON.
 *   - A booking inside the window pays LESS (deposit math on payments row);
 *     outside the window pays full price.
 *   - Every confirmed booking emits quiet_hours_booking with inWindow truth.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';

vi.mock('../../server/lib/chapa', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    initiateDirectCharge: vi.fn(async () => ({ ref_id: 'test-ref-qh', status: 'success' })),
    authorizeDirectCharge: vi.fn(async () => ({ status: 'success' })),
    verifyPayment: vi.fn(async () => ({ status: 'success', amount: '', tx_ref: '', raw: {} })),
    generateTxRef: actual.generateTxRef,
  };
});

import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants, users, plans, tenantSubscriptions, services as servicesTable,
  staff, appointments, payments, activationEvents,
} from '../../src/db/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';
const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

function tokenFor(userId: string, tenantId: string): string {
  return jwt.sign({ userId, tenantId, role: 'owner', tokenVersion: 0 }, JWT_SECRET, { expiresIn: '15m' });
}

describe('quiet-hours discount (P5.6)', () => {
  let tenantId = ''; let userId = ''; let token = '';
  let svcId = ''; let staffId = '';
  const slug = `quiet-${Date.now()}`;
  const createdAppts: string[] = [];

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    userId = crypto.randomUUID();
    svcId = crypto.randomUUID();
    staffId = crypto.randomUUID();

    await db.insert(tenants).values({
      id: tenantId, name: 'Quiet Salon', slug,
      category: 'Salon',
      settings: { require_payment_upfront: true },
      createdAt: Date.now(),
    });
    await db.insert(users).values({
      id: userId, tenantId, name: 'Owner',
      phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
      email: `${slug}@egebeya.test`,
      passwordHash: await bcrypt.hash('pass1234', 10),
      role: 'owner', createdAt: Date.now(),
    });
    await db.insert(servicesTable).values({ id: svcId, tenantId, name: 'Wash & Set', durationMinutes: 45, price: 20000, active: true });
    await db.insert(staff).values({ id: staffId, tenantId, name: 'Stylist', active: true });
    const proPlan = await db.select().from(plans).where(eq(plans.name, 'pro')).get();
    if (proPlan) {
      await db.insert(tenantSubscriptions).values({
        id: crypto.randomUUID(), tenantId, planId: proPlan.id,
        status: 'active', startsAt: Date.now(),
      });
    }
    token = tokenFor(userId, tenantId);

    // Enable: 13:00–15:00 Addis at 20% off (780–900 minutes).
    const put = await request(app)
      .put('/api/tenant/quiet-hours')
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: true, startMinute: 780, endMinute: 900, percent: 20 });
    expect(put.status).toBe(200);
  });

  afterAll(async () => {
    if (createdAppts.length) {
      const list = createdAppts.map((id) => `'${id}'`).join(',');
      await ((db as any).session?.client ?? (db as any).$client).execute(
        { sql: `DELETE FROM appointments WHERE id IN (${list})`, args: [] }).catch(() => {});
    }
    await db.delete(payments).where(eq(payments.tenantId, tenantId)).catch(() => {});
    await db.delete(appointments).where(eq(appointments.tenantId, tenantId)).catch(() => {});
    await db.delete(activationEvents).where(eq(activationEvents.tenantId, tenantId)).catch(() => {});
    await db.delete(servicesTable).where(eq(servicesTable.id, svcId)).catch(() => {});
    await db.delete(staff).where(eq(staff.id, staffId)).catch(() => {});
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).catch(() => {});
    await db.delete(users).where(eq(users.tenantId, tenantId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
  });

  async function book(hourUtc: number): Promise<any> {
    // Addis = UTC+3 → hourUtc+3 lands in the local window math.
    const start = new Date(Date.now() + 72 * 3600 * 1000);
    start.setUTCHours(hourUtc, 0, 0, 0);
    const res = await request(app)
      .post('/api/public/bookings')
      .set('X-Tenant-Slug', slug)
      .send({
        staff_id: staffId,
        service_ids: [svcId],
        start_time: start.toISOString(),
        customer_name: `Q ${hourUtc}`,
        customer_phone: `+2519${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
      });
    if (res.status === 201) {
      const row = await db.select({ id: appointments.id })
        .from(appointments).where(eq(appointments.opaqueId, res.body.appointment.id)).get();
      if (row) createdAppts.push(row.id);
    }
    return res;
  }

  it('owner PUT rejects invalid windows and percents', async () => {
    for (const body of [
      { enabled: true, startMinute: 1441, endMinute: 100, percent: 10 },
      { enabled: true, startMinute: -5, endMinute: 100, percent: 10 },
      { enabled: true, startMinute: 60, endMinute: 120, percent: 95 },
      { enabled: 'yes', startMinute: 60, endMinute: 120, percent: 10 },
    ]) {
      const r = await request(app).put('/api/tenant/quiet-hours')
        .set('Authorization', `Bearer ${token}`).send(body);
      expect(r.status).toBe(400);
    }
  });

  it('booking INSIDE the window applies the percent to the deposit', async () => {
    // 11:00 UTC = 14:00 Addis → inside 13:00–15:00.
    const res = await book(11);
    if (res.status !== 201) console.log('IN-WINDOW FAIL:', JSON.stringify(res.body).slice(0, 250));
    expect(res.status).toBe(201);

    const pay = await db.select().from(payments).where(eq(payments.tenantId, tenantId)).get();
    // 200 ETB − 20% = 160 ETB = 16000 cents.
    expect(pay?.amount).toBe(16000);
    expect(JSON.stringify(pay?.meta)).toContain('quietHoursDiscount');

    // Analytics feed records the in-window truth.
    await new Promise((r) => setTimeout(r, 150));
    const events = await db.select().from(activationEvents)
      .where(eq(activationEvents.tenantId, tenantId)).all();
    const qhEvent = events.find((e) => e.event === 'quiet_hours_booking');
    expect(qhEvent).toBeTruthy();
    expect((qhEvent!.meta as any)?.inWindow).toBe(true);
  });

  it('booking OUTSIDE the window pays full price and says so', async () => {
    // 07:00 UTC = 10:00 Addis → outside the window.
    const res = await book(7);
    expect(res.status).toBe(201);
    expect(res.body.appointment.quietHours).toBeUndefined();

    // Scope to THIS appointment's payment row.
    const apptRow = await db.select({ id: appointments.id })
      .from(appointments).where(eq(appointments.opaqueId, res.body.appointment.id)).get();
    const pay = await db.select().from(payments)
      .where(eq(payments.appointmentId, apptRow!.id)).get();
    expect(pay!.amount).toBe(20000);
  });

  it('publicTenantView exposes ONLY the display config when enabled', async () => {
    // The /page endpoint calls publicTenantView — the actual allowlist that
    // ships config to the public booking screen. Exercise it, not the DB row.
    const page = await request(app)
      .get('/api/public/page')
      .set('X-Tenant-Slug', slug);
    expect(page.status).toBe(200);

    const exposed = page.body.tenant.quiet_hours_discount;
    expect(exposed).toEqual({ start_minute: 780, end_minute: 900, percent: 20 });
    // No internals leak beyond the display trio.
    expect(Object.keys(exposed).sort()).toEqual(['end_minute', 'percent', 'start_minute']);
    expect(exposed.enabled).toBeUndefined();

    // Disable → the field disappears entirely from the view.
    await request(app)
      .put('/api/tenant/quiet-hours')
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: false, startMinute: 780, endMinute: 900, percent: 20 });
    const after = await request(app)
      .get('/api/public/page')
      .set('X-Tenant-Slug', slug);
    expect(after.body.tenant.quiet_hours_discount).toBeUndefined();
  });
});
