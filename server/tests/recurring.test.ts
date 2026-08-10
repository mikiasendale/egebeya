/**
 * Recurring Appointments tests (Phase 2).
 *
 * Covers:
 *   1. Series creation — POST /api/tenant/recurring-series validates input and
 *      creates the series row, expanding future occurrences.
 *   2. Expansion — generating appointment rows based on interval (weekly),
 *      skipping conflicts.
 *   3. Single occurrence cancellation — cancelling one occurrence does NOT
 *      deactivate the whole series (is_active stays true).
 *   4. Deleting a series sets is_active=false.
 *   5. Monthly interval expansion.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { toEthiopian } from 'ethiopian-date';

import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants, users, services as servicesTable, staff, appointments,
  tenantBusinessHours, recurringSeries, customerStats, appointmentServices,
} from '../../src/db/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

function makeToken(userId: string, tenantId: string, role = 'owner'): string {
  return jwt.sign({ userId, tenantId, role, tokenVersion: 0 }, JWT_SECRET, { expiresIn: '15m' });
}

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

const suffix = `rec-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;

// Helper: convert a Gregorian Date to Ethiopian date string YYYY-MM-DD
function gregToEthStr(greg: Date): string {
  const [ey, em, ed] = toEthiopian(greg.getUTCFullYear(), greg.getUTCMonth() + 1, greg.getUTCDate());
  return `${ey}-${String(em).padStart(2, '0')}-${String(ed).padStart(2, '0')}`;
}

describe('Recurring Appointments', () => {
  let tenantId: string;
  let ownerId: string;
  let serviceId: string;
  let staffId: string;
  let ownerToken: string;
  let slug: string;

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    ownerId = crypto.randomUUID();
    serviceId = crypto.randomUUID();
    staffId = crypto.randomUUID();
    slug = `rec-${suffix}`;

    await db.insert(tenants).values({
      id: tenantId, name: 'Recurring Test Salon', slug,
      settings: { require_payment_upfront: false },
      createdAt: Date.now(),
    });
    const pwHash = await bcrypt.hash('pass', 8);
    await db.insert(users).values({
      id: ownerId, tenantId, name: 'Owner',
      phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
      email: `rec-owner-${suffix}@egebeya.test`, passwordHash: pwHash,
      role: 'owner', createdAt: Date.now(),
    });
    await db.insert(servicesTable).values({
      id: serviceId, tenantId, name: 'Recurring Service', durationMinutes: 60, price: 10000, active: true,
    });
    await db.insert(staff).values({ id: staffId, tenantId, name: 'Recurring Stylist', active: true });
    for (let d = 0; d <= 6; d++) {
      await db.insert(tenantBusinessHours).values({
        id: crypto.randomUUID(), tenantId, dayOfWeek: d, openTime: '08:00', closeTime: '20:00', isClosed: false,
      });
    }
    ownerToken = makeToken(ownerId, tenantId, 'owner');
  });

  afterAll(async () => {
    const apps = await db.select({ id: appointments.id }).from(appointments).where(eq(appointments.tenantId, tenantId)).all();
    for (const a of apps) {
      await db.delete(appointmentServices).where(eq(appointmentServices.appointmentId, a.id));
    }
    await db.delete(appointments).where(eq(appointments.tenantId, tenantId)).catch(() => {});
    await db.delete(recurringSeries).where(eq(recurringSeries.tenantId, tenantId)).catch(() => {});
    await db.delete(customerStats).where(eq(customerStats.tenantId, tenantId)).catch(() => {});
    await db.delete(tenantBusinessHours).where(eq(tenantBusinessHours.tenantId, tenantId)).catch(() => {});
    await db.delete(servicesTable).where(eq(servicesTable.tenantId, tenantId)).catch(() => {});
    await db.delete(staff).where(eq(staff.tenantId, tenantId)).catch(() => {});
    await db.delete(users).where(eq(users.tenantId, tenantId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
  });

  async function cleanupSeriesAndAppts() {
    const series = await db.select({ id: recurringSeries.id }).from(recurringSeries).where(eq(recurringSeries.tenantId, tenantId)).all();
    for (const s of series) {
      await db.delete(appointments).where(eq(appointments.recurringSeriesId, s.id));
    }
    await db.delete(recurringSeries).where(eq(recurringSeries.tenantId, tenantId));
    await db.delete(customerStats).where(eq(customerStats.tenantId, tenantId));
  }

  it('creates a recurring series and expands occurrences', async () => {
    await cleanupSeriesAndAppts();

    const start = new Date(Date.now() + 5 * 86400000);
    const startEth = gregToEthStr(start);

    const res = await request(app)
      .post('/api/tenant/recurring-series')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        staff_id: staffId,
        service_id: serviceId,
        customer_name: 'Series Customer',
        customer_phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
        interval: 'weekly',
        start_date: startEth,
        end_date: gregToEthStr(new Date(start.getTime() + 5 * 7 * 86400000)),
        timeslot_minutes: 480,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.createdAppointments).toBeGreaterThan(1);

    const generated = await db.select().from(appointments)
      .where(eq(appointments.recurringSeriesId, res.body.seriesId))
      .orderBy(appointments.startTime)
      .all();
    expect(generated.length).toBeGreaterThan(1);

    const first = generated[0];
    expect(first.endTime - first.startTime).toBe(60 * 60000);

    for (const a of generated) {
      expect(a.recurringSeriesId).toBe(res.body.seriesId);
      expect(a.status).toBe('confirmed');
    }
  });

  it('skips conflicting slots during expansion', async () => {
    await cleanupSeriesAndAppts();

    const start = new Date(Date.now() + 10 * 86400000);
    const gregStr = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-${String(start.getUTCDate()).padStart(2, '0')}`;
    const { parseAddisDate } = await import('../../server/lib/timezone');
    const addisMidnight = parseAddisDate(gregStr).getTime();
    const conflictStart = addisMidnight + 480 * 60000;
    const conflictEnd = conflictStart + 60 * 60000;

    const conflictApptId = crypto.randomUUID();
    await db.insert(appointments).values({
      id: conflictApptId, tenantId, staffId, serviceId,
      customerName: 'Pre-conflict',
      customerPhone: '+251900000001',
      startTime: conflictStart, endTime: conflictEnd, status: 'confirmed', reminderSent: false,
        opaqueId: crypto.randomBytes(16).toString('hex')
    });

    const res = await request(app)
      .post('/api/tenant/recurring-series')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        staff_id: staffId,
        service_id: serviceId,
        customer_name: 'Conflict Series',
        customer_phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
        interval: 'weekly',
        start_date: gregToEthStr(start),
        end_date: gregToEthStr(new Date(start.getTime() + 5 * 7 * 86400000)),
        timeslot_minutes: 480,
      });

    expect(res.status).toBe(201);
    expect(res.body.skippedConflicts).toBeGreaterThanOrEqual(1);

    const conflict = await db.select().from(appointments).where(eq(appointments.id, conflictApptId)).get();
    expect(conflict).toBeTruthy();
    expect(conflict?.status).toBe('confirmed');

    await db.delete(appointments).where(eq(appointments.recurringSeriesId, res.body.seriesId));
    await db.delete(appointments).where(eq(appointments.id, conflictApptId));
    await db.delete(recurringSeries).where(eq(recurringSeries.id, res.body.seriesId));
    await db.delete(customerStats).where(eq(customerStats.tenantId, tenantId));
  });

  it('cancelling one occurrence does NOT deactivate the series', async () => {
    await cleanupSeriesAndAppts();

    const start = new Date(Date.now() + 5 * 86400000);
    const startEth = gregToEthStr(start);

    const res = await request(app)
      .post('/api/tenant/recurring-series')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        staff_id: staffId,
        service_id: serviceId,
        customer_name: 'Cancel One',
        customer_phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
        interval: 'weekly',
        start_date: startEth,
        end_date: gregToEthStr(new Date(start.getTime() + 4 * 7 * 86400000)),
        timeslot_minutes: 540,
      });
    expect(res.status).toBe(201);
    const seriesId = res.body.seriesId;

    const generated = await db.select().from(appointments)
      .where(eq(appointments.recurringSeriesId, seriesId))
      .orderBy(appointments.startTime)
      .all();
    expect(generated.length).toBeGreaterThan(1);

    const toCancel = generated[0];
    const cancelRes = await request(app)
      .put(`/api/bookings/${toCancel.id}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'cancelled' });
    expect(cancelRes.status).toBe(200);

    const series = await db.select().from(recurringSeries).where(eq(recurringSeries.id, seriesId)).get();
    expect(series?.isActive).toBe(true);

    const cancelled = await db.select().from(appointments).where(eq(appointments.id, toCancel.id)).get();
    expect(cancelled?.status).toBe('cancelled');
  });

  it('deleting a series sets is_active=false', async () => {
    await cleanupSeriesAndAppts();

    const start = new Date(Date.now() + 20 * 86400000);
    const startEth = gregToEthStr(start);

    const res = await request(app)
      .post('/api/tenant/recurring-series')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        staff_id: staffId,
        service_id: serviceId,
        customer_name: 'Delete Series',
        customer_phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
        interval: 'weekly',
        start_date: startEth,
        end_date: gregToEthStr(new Date(start.getTime() + 4 * 7 * 86400000)),
        timeslot_minutes: 480,
      });
    expect(res.status).toBe(201);
    const seriesId = res.body.seriesId;

    const del = await request(app)
      .delete(`/api/tenant/recurring-series/${seriesId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);

    const series = await db.select().from(recurringSeries).where(eq(recurringSeries.id, seriesId)).get();
    expect(series?.isActive).toBe(false);
  });

  it('monthly interval generates one appointment per month', async () => {
    await cleanupSeriesAndAppts();

    const start = new Date(Date.now() + 5 * 86400000);
    const startEth = gregToEthStr(start);

    const res = await request(app)
      .post('/api/tenant/recurring-series')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        staff_id: staffId,
        service_id: serviceId,
        customer_name: 'Monthly Customer',
        customer_phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
        interval: 'monthly',
        start_date: startEth,
        end_date: gregToEthStr(new Date(start.getTime() + 4 * 30 * 86400000)),
        timeslot_minutes: 480,
      });

    expect(res.status).toBe(201);
    expect(res.body.createdAppointments).toBeGreaterThan(1);

    const generated = await db.select().from(appointments)
      .where(eq(appointments.recurringSeriesId, res.body.seriesId))
      .orderBy(appointments.startTime)
      .all();
    expect(generated.length).toBeGreaterThan(1);
  });

  it('GET /api/tenant/recurring-series lists series for the tenant', async () => {
    await cleanupSeriesAndAppts();

    const start = new Date(Date.now() + 30 * 86400000);
    const startEth = gregToEthStr(start);

    const res = await request(app)
      .post('/api/tenant/recurring-series')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        staff_id: staffId,
        service_id: serviceId,
        customer_name: 'List Series',
        customer_phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
        interval: 'biweekly',
        start_date: startEth,
        end_date: gregToEthStr(new Date(start.getTime() + 3 * 7 * 86400000)),
        timeslot_minutes: 480,
      });
    expect(res.status).toBe(201);

    const listRes = await request(app)
      .get('/api/tenant/recurring-series')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.length).toBeGreaterThanOrEqual(1);
    expect(listRes.body[0]).toHaveProperty('id');
    expect(listRes.body[0]).toHaveProperty('interval');
    expect(listRes.body[0]).toHaveProperty('isActive');
  });
});
