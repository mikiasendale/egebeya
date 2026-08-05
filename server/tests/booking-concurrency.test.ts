import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants,
  services,
  staff,
  appointments,
  appointmentServices,
  payments,
  recurringSeries,
  staffAvailability,
  staffServices,
  tenantBusinessHours,
  tenantClosures,
  customerStats,
} from '../../src/db/schema';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Concurrency contract for POST /api/public/bookings
 * ----------------------------------------------
 * The endpoint must serialize two simultaneous bookings for the SAME
 * (staff_id, service_id, start_time) so exactly ONE succeeds (201) and
 * the other is rejected with a clear 409 conflict.
 *
 * The implementation relies on:
 *   - libsql's BEGIN IMMEDIATE on `db.transaction()` (default mode 'write'),
 *     which acquires the SQLite write lock up front and serializes the
 *     re-read of the conflict window.
 *   - PRAGMA busy_timeout on the client (see src/db/index.ts) so the second
 *     transaction blocks up to 5s instead of failing with SQLITE_BUSY.
 *
 * If this test ever produces two 201s, the lock has regressed and the
 * double-booking protection is broken. If it produces two 409s or any
 * 500, the failure path is wrong and we leak enrollment / DB errors.
 */

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

describe('Booking concurrency / double-booking protection', () => {
  const slug = `concurrency-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  let tenantId: string;
  let staffId: string;
  let serviceId: string;
  let startTimeMs: number;

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    staffId = crypto.randomUUID();
    serviceId = crypto.randomUUID();

    // Tenant: no upfront payment so the test path doesn't touch Chapa.
    await db.insert(tenants).values({
      id: tenantId,
      name: 'Concurrency Probe Salon',
      slug,
      settings: { require_payment_upfront: false },
      createdAt: Date.now(),
    });

    await db.insert(services).values({
      id: serviceId,
      tenantId,
      name: 'Concurrency haircut',
      durationMinutes: 30,
      price: 10000, // 100 ETB
      active: true,
    });

    await db.insert(staff).values({
      id: staffId,
      tenantId,
      name: 'Probe Stylist',
      title: 'Stylist',
      active: true,
    });

    // Open every day-of-week, 09:00-17:00, so the new server-side
    // closed-day check does not reject our probe slot.
    const hours = [];
    for (let i = 0; i <= 6; i++) {
      hours.push({
        id: crypto.randomUUID(),
        tenantId,
        dayOfWeek: i,
        openTime: '09:00',
        closeTime: '17:00',
        isClosed: false,
      });
    }
    await db.insert(tenantBusinessHours).values(hours);

    // Pick a slot well in the future at 11:00 UTC = 14:00 Africa/Addis_Ababa,
    // comfortably inside the 09:00-17:00 window regardless of calendar date.
    const base = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    const target = new Date(
      Date.UTC(
        base.getUTCFullYear(),
        base.getUTCMonth(),
        base.getUTCDate(),
        11,
        0,
        0,
        0,
      ),
    );
    startTimeMs = target.getTime();
  });

  afterAll(async () => {
    if (!tenantId) return;
    // Clean up the rows this test created so the dev database stays tidy
    // between runs. Child rows must go before the parents the schema
    // foreign-keys them to (appointment_services / payments → appointments,
    // staff_availability / staff_services → staff, recurring_series → staff).
    const apptIds = (await db.select({ id: appointments.id }).from(appointments)
      .where(eq(appointments.tenantId, tenantId)).all()).map((r) => r.id);
    if (apptIds.length) {
      await db.delete(appointmentServices).where(inArray(appointmentServices.appointmentId, apptIds));
      await db.delete(payments).where(inArray(payments.appointmentId, apptIds));
    }
    await db.delete(appointments).where(eq(appointments.tenantId, tenantId));
    await db.delete(recurringSeries).where(eq(recurringSeries.tenantId, tenantId));
    const staffIds = (await db.select({ id: staff.id }).from(staff)
      .where(eq(staff.tenantId, tenantId)).all()).map((r) => r.id);
    if (staffIds.length) {
      await db.delete(staffAvailability).where(inArray(staffAvailability.staffId, staffIds));
      await db.delete(staffServices).where(inArray(staffServices.staffId, staffIds));
    }
    await db.delete(tenantBusinessHours).where(eq(tenantBusinessHours.tenantId, tenantId));
    await db.delete(tenantClosures).where(eq(tenantClosures.tenantId, tenantId));
    await db.delete(services).where(eq(services.tenantId, tenantId));
    await db.delete(staff).where(eq(staff.tenantId, tenantId));
    await db.delete(customerStats).where(eq(customerStats.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('returns exactly one 201 and one 409 when two requests race for the same slot', async () => {
    // Two distinct Ethiopian phone numbers so any uniqueness constraint
    // (there isn't one today, but a future one wouldn't break the test).
    const bookingA = {
      staff_id: staffId,
      service_id: serviceId,
      start_time: new Date(startTimeMs).toISOString(),
      customer_name: 'Race Customer A',
      customer_phone: '+251911000111',
    };
    const bookingB = { ...bookingA, customer_name: 'Race Customer B', customer_phone: '+251911000222' };

    // Fire both requests without awaiting between them so they actually
    // overlap inside the server's event loop. supertest resolves a Promise
    // per request once its handler completes, so Promise.all is enough.
    const [resA, resB] = await Promise.all([
      request(app).post('/api/public/bookings').set('X-Tenant-Slug', slug).send(bookingA),
      request(app).post('/api/public/bookings').set('X-Tenant-Slug', slug).send(bookingB),
    ]);

    // Expect exactly one 201 and one 409 — both directions of the race.
    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    // The losing response must carry a clear conflict error message.
    const loser = resA.status === 409 ? resA : resB;
    expect(loser.status).toBe(409);
    expect(String(loser.body.error || '').toLowerCase()).toMatch(/slot|conflict|no longer/i);

    // The winning response must point at a real appointment row.
    const winner = resA.status === 201 ? resA : resB;
    expect(winner.body.success).toBe(true);
    expect(winner.body.appointment?.id).toBeTruthy();

    // And exactly one appointment row should exist for this exact slot.
    const rows = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(eq(appointments.staffId, staffId))
      .all();
    const ourSlot = rows.filter((r) => r.id === winner.body.appointment.id);
    expect(ourSlot.length).toBe(1);
  });

  it('rejects a single past-date booking with 422', async () => {
    const pastSlot = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post('/api/public/bookings')
      .set('X-Tenant-Slug', slug)
      .send({
        staff_id: staffId,
        service_id: serviceId,
        start_time: pastSlot,
        customer_name: 'Past Customer',
        customer_phone: '+251911000333',
      });
    expect(res.status).toBe(422);
    expect(String(res.body.error || '').toLowerCase()).toMatch(/past/i);
  });

  it('rejects a booking on a tenant-closure date with 422', async () => {
    const closureDate = new Date(startTimeMs).toISOString().slice(0, 10);
    await db.insert(tenantClosures).values({
      id: crypto.randomUUID(),
      tenantId,
      date: closureDate,
      reason: 'Concurrency test closure',
    });

    try {
      const res = await request(app)
        .post('/api/public/bookings')
        .set('X-Tenant-Slug', slug)
        .send({
          staff_id: staffId,
          service_id: serviceId,
          start_time: new Date(startTimeMs).toISOString(),
          customer_name: 'Closure Customer',
          customer_phone: '+251911000444',
        });
      expect(res.status).toBe(422);
      expect(String(res.body.error || '').toLowerCase()).toMatch(/closed/i);
    } finally {
      await db
        .delete(tenantClosures)
        .where(eq(tenantClosures.tenantId, tenantId));
    }
  });
});
