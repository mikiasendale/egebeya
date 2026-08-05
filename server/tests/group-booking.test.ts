/**
 * Group / Multi-Service Booking tests (Phase 2).
 *
 * Covers:
 *   1. POST /api/public/bookings with service_ids array → creates appointment
 *      with multiple services, summing durations and prices.
 *   2. appointment_services rows are created for each service.
 *   3. Backward compatibility — single service_id still works.
 *   4. Promo code discount is applied when valid.
 *   5. Conflict prevention when booking overlapping slots.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';

import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants, users, services as servicesTable, staff, appointments,
  tenantBusinessHours, customerStats, promoCodes, appointmentServices,
} from '../../src/db/schema';

const JWT_SECRET = process.env.JWT_SECRET as string;

function tokenFor(userId: string, tenantId: string): string {
  return jwt.sign({ userId, tenantId, role: 'owner', tokenVersion: 0 }, JWT_SECRET, { expiresIn: '15m' });
}

function makePhone(): string { return `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`; }

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

const suffix = `grp-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
const slug = `grp-${suffix}`;

describe('Group / Multi-Service Bookings', () => {
  let tenantId: string;
  let ownerId: string;
  let serviceA: string;
  let serviceB: string;
  let serviceC: string;
  let staffId: string;
  let token: string;

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    ownerId = crypto.randomUUID();
    serviceA = crypto.randomUUID();
    serviceB = crypto.randomUUID();
    serviceC = crypto.randomUUID();
    staffId = crypto.randomUUID();

    await db.insert(tenants).values({
      id: tenantId, name: 'Group Booking Salon', slug,
      settings: { require_payment_upfront: false }, createdAt: Date.now(),
    });
    const pwHash = await bcrypt.hash('pass', 8);
    await db.insert(users).values({
      id: ownerId, tenantId, name: 'Group Owner', phone: makePhone(),
      email: `grp-owner-${suffix}@egebeya.test`, passwordHash: pwHash,
      role: 'owner', createdAt: Date.now(),
    });

    await db.insert(servicesTable).values({
      id: serviceA, tenantId, name: 'Haircut', durationMinutes: 30, price: 5000, active: true,
    });
    await db.insert(servicesTable).values({
      id: serviceB, tenantId, name: 'Color', durationMinutes: 45, price: 8000, active: true,
    });
    await db.insert(servicesTable).values({
      id: serviceC, tenantId, name: 'Styling', durationMinutes: 15, price: 3000, active: true,
    });
    await db.insert(staff).values({ id: staffId, tenantId, name: 'Group Stylist', active: true });
    for (let d = 0; d <= 6; d++) {
      await db.insert(tenantBusinessHours).values({
        id: crypto.randomUUID(), tenantId, dayOfWeek: d, openTime: '08:00', closeTime: '20:00', isClosed: false,
      });
    }

    token = tokenFor(ownerId, tenantId);
  });

  afterAll(async () => {
    const apps = await db.select({ id: appointments.id }).from(appointments).where(eq(appointments.tenantId, tenantId)).all();
    for (const a of apps) {
      await db.delete(appointmentServices).where(eq(appointmentServices.appointmentId, a.id));
    }
    await db.delete(appointments).where(eq(appointments.tenantId, tenantId)).catch(() => {});
    await db.delete(promoCodes).where(eq(promoCodes.tenantId, tenantId)).catch(() => {});
    await db.delete(customerStats).where(eq(customerStats.tenantId, tenantId)).catch(() => {});
    await db.delete(tenantBusinessHours).where(eq(tenantBusinessHours.tenantId, tenantId)).catch(() => {});
    await db.delete(servicesTable).where(eq(servicesTable.tenantId, tenantId)).catch(() => {});
    await db.delete(staff).where(eq(staff.tenantId, tenantId)).catch(() => {});
    await db.delete(users).where(eq(users.tenantId, tenantId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
  });

  afterEach(async () => {
    const apps = await db.select({ id: appointments.id }).from(appointments).where(eq(appointments.tenantId, tenantId)).all();
    for (const a of apps) {
      await db.delete(appointmentServices).where(eq(appointmentServices.appointmentId, a.id)).catch(() => {});
    }
    await db.delete(appointments).where(eq(appointments.tenantId, tenantId)).catch(() => {});
    await db.delete(customerStats).where(eq(customerStats.tenantId, tenantId)).catch(() => {});
    await db.delete(promoCodes).where(eq(promoCodes.tenantId, tenantId)).catch(() => {});
  });

  // Helper: compute a future UTC timestamp at 11:00 UTC = 14:00 Addis
  // (comfortably inside 08:00–20:00 Addis business hours), aligned to 30-min.
  function futureSlot(daysAhead: number): string {
    const base = new Date(Date.now() + daysAhead * 86400000);
    return new Date(Date.UTC(
      base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(),
      11, 0, 0, 0,
    )).toISOString();
  }

  it('books multiple services in one appointment (service_ids array)', async () => {
    const startTime = futureSlot(7);

    const res = await request(app)
      .post('/api/public/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Slug', slug)
      .send({
        staff_id: staffId,
        service_ids: [serviceA, serviceB, serviceC],
        start_time: startTime,
        customer_name: 'Group Customer',
        customer_phone: makePhone(),
      });

    expect(res.status).toBe(201);
    expect(res.body.appointment).toBeTruthy();

    const appt = await db.select().from(appointments)
      .where(eq(appointments.id, res.body.appointment.id))
      .get();
    expect(appt).toBeTruthy();

    // Total duration: 30 + 45 + 15 = 90 min
    expect(appt!.endTime - appt!.startTime).toBe(90 * 60000);

    // Verify price breakdown via appointment_services.
    const svcRows = await db.select().from(appointmentServices)
      .where(eq(appointmentServices.appointmentId, appt!.id))
      .all();
    expect(svcRows.length).toBe(3);

    // Total price: 5000 + 8000 + 3000 = 16000 cents (sum of priceAtBooking)
    const totalPrice = svcRows.reduce((sum, r) => sum + r.priceAtBooking, 0);
    expect(totalPrice).toBe(16000);

    const svcIds = svcRows.map((r) => r.serviceId).sort();
    expect(svcIds).toEqual([serviceA, serviceB, serviceC].sort());
  });

  it('backward compat: single service_id works', async () => {
    const startTime = futureSlot(8);

    const res = await request(app)
      .post('/api/public/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Slug', slug)
      .send({
        staff_id: staffId,
        service_id: serviceA,
        start_time: startTime,
        customer_name: 'Single Customer',
        customer_phone: makePhone(),
      });

    expect(res.status).toBe(201);
    const appt = await db.select().from(appointments)
      .where(eq(appointments.id, res.body.appointment.id))
      .get();
    expect(appt?.serviceId).toBe(serviceA);
    expect(appt?.endTime - appt?.startTime).toBe(30 * 60000);
  });

  it('applies a valid promo code discount', async () => {
    await db.insert(promoCodes).values({
      id: crypto.randomUUID(), tenantId, code: 'GROUP10',
      discountType: 'percent', discountValue: 10, maxUses: 10, usedCount: 0,
      validFrom: null, validUntil: null, isActive: true, createdAt: Date.now(),
    });

    const startTime = futureSlot(9);

    const res = await request(app)
      .post('/api/public/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Slug', slug)
      .send({
        staff_id: staffId,
        service_ids: [serviceA, serviceB],
        start_time: startTime,
        customer_name: 'Promo Customer',
        customer_phone: makePhone(),
        promo_code: 'GROUP10',
      });
    expect(res.status).toBe(201);

    // The promo code usage count should have incremented.
    const promoRow = await db.select().from(promoCodes)
      .where(eq(promoCodes.code, 'GROUP10'))
      .get();
    expect(promoRow?.usedCount).toBe(1);

    // customer_stats should reflect effective spend (13000 - 1300 = 11700).
    const stats = await db.select().from(customerStats)
      .where(eq(customerStats.tenantId, tenantId))
      .get();
    if (stats) {
      expect(stats.totalSpendEtbCents).toBe(11700);
    }
  });

  it('rejects expired promo code', async () => {
    const past = Date.now() - 86400000;
    await db.insert(promoCodes).values({
      id: crypto.randomUUID(), tenantId, code: 'EXPIRED',
      discountType: 'percent', discountValue: 20, maxUses: 10, usedCount: 0,
      validFrom: past - 172800000, validUntil: past, isActive: true, createdAt: Date.now(),
    });

    const startTime = futureSlot(11);

    const res = await request(app)
      .post('/api/public/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Slug', slug)
      .send({
        staff_id: staffId,
        service_ids: [serviceA],
        start_time: startTime,
        customer_name: 'Expired Promo',
        customer_phone: makePhone(),
        promo_code: 'EXPIRED',
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/expired|invalid|not valid/i);
  });

  it('prevents double-booking overlapping slots', async () => {
    const startTime = futureSlot(12);

    const res1 = await request(app)
      .post('/api/public/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Slug', slug)
      .send({
        staff_id: staffId,
        service_ids: [serviceA, serviceB],
        start_time: startTime,
        customer_name: 'Slot Owner',
        customer_phone: makePhone(),
      });
    expect(res1.status).toBe(201);

    // Overlapping: starts 30 min into the 75-min block (still 30-min aligned)
    // — the second booking (15 min) falls inside the first (75 min), so 409.
    const overlapTime = new Date(new Date(startTime).getTime() + 30 * 60000).toISOString();
    const res2 = await request(app)
      .post('/api/public/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Slug', slug)
      .send({
        staff_id: staffId,
        service_ids: [serviceC],
        start_time: overlapTime,
        customer_name: 'Conflict',
        customer_phone: makePhone(),
      });
    expect(res2.status).toBe(409);
  });
});
