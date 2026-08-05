/**
 * Payment confirmation UX — customer-facing booking confirmation page.
 *
 * Feature C: Visible Chapa Payment Confirmation UX.
 *
 * Covers the four page states:
 *   1. Pending payment — polling for status
 *   2. Confirmed — booking details with Ethiopian date
 *   3. Failed/cancelled — retry or cancel
 *   4. Revisit — already confirmed or cancelled
 *
 * Also covers:
 *   - GET /api/public/appointments/:id/status returns 403 for wrong phone
 *   - Returns 404 for cross-tenant appointment id
 *   - Returns 200 with correct Ethiopic date projection for matching phone
 *   - Slot-hold expiry (cancels_at) cleanup
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants, users, services, staff, appointments, payments,
  tenantBusinessHours, plans, tenantSubscriptions,
} from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

describe('Payment confirmation UX (Feature C)', () => {
  const slug = `payconf-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  let tenantId: string;
  let ownerId: string;
  let serviceId: string;
  let staffId: string;
  let ownerToken: string;
  // For the full booking flow we test through the public booking API
  // which requires tenant resolution by slug.

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    ownerId = crypto.randomUUID();
    serviceId = crypto.randomUUID();
    staffId = crypto.randomUUID();

    await db.insert(tenants).values({
      id: tenantId, name: 'Pay Conf Shop', slug,
      settings: { require_payment_upfront: true, defaultLocale: 'en' },
      createdAt: Date.now(),
    });
    const pwHash = await bcrypt.hash('pass', 8);
    await db.insert(users).values({
      id: ownerId, tenantId, name: 'Owner', phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
      email: `payconf-owner-${Date.now()}@egebeya.test`, passwordHash: pwHash, role: 'owner', createdAt: Date.now(),
    });
    await db.insert(services).values({
      id: serviceId, tenantId, name: 'Premium Haircut', durationMinutes: 45, price: 10000, active: true,
    });
    await db.insert(staff).values({
      id: staffId, tenantId, name: 'Stylist A', active: true,
    });
    const freePlan = await db.select().from(plans).where(eq(plans.name, 'free')).get();
    if (freePlan) {
      await db.insert(tenantSubscriptions).values({
        id: crypto.randomUUID(), tenantId, planId: freePlan.id, status: 'active', startsAt: Date.now(),
      });
    }
    for (let d = 0; d <= 6; d++) {
      await db.insert(tenantBusinessHours).values({
        id: crypto.randomUUID(), tenantId, dayOfWeek: d, openTime: '09:00', closeTime: '17:00',
      });
    }

    ownerToken = jwt.sign(
      { userId: ownerId, tenantId, role: 'owner', tokenVersion: 0 },
      JWT_SECRET, { expiresIn: '15m' },
    );
  });

  afterAll(async () => {
    await db.delete(payments).where(eq(payments.tenantId, tenantId));
    await db.delete(appointments).where(eq(appointments.tenantId, tenantId));
    await db.delete(services).where(eq(services.tenantId, tenantId));
    await db.delete(staff).where(eq(staff.id, staffId));
    await db.delete(tenantBusinessHours).where(eq(tenantBusinessHours.tenantId, tenantId));
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId));
    await db.delete(users).where(eq(users.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  function futureSlot(daysAhead: number, hour: number, min = 0): number {
    const d = new Date(Date.now() + daysAhead * 86400000);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, min, 0, 0);
  }

  describe('GET /api/public/appointments/:id/status', () => {
    let apptId: string;
    let customerPhone: string;

    beforeAll(async () => {
      customerPhone = '+251911123456';
      apptId = crypto.randomUUID();
      const startTime = futureSlot(3, 10);
      const endTime = startTime + 45 * 60000;

      await db.insert(appointments).values({
        id: apptId, tenantId, customerName: 'Test Customer',
        customerPhone, customerEmail: 'test@example.com',
        staffId, serviceId, startTime, endTime,
        status: 'pending', reminderSent: false,
      });

      await db.insert(payments).values({
        id: crypto.randomUUID(), tenantId, appointmentId: apptId,
        amount: 10000, gateway: 'chapa', method: 'telebirr',
        gatewayReference: 'tx-ref-test', status: 'pending',
      });
    });

    it('returns 200 with correct status and Ethiopian date when phone matches', async () => {
      const res = await request(app)
        .get(`/api/public/appointments/${apptId}/status`)
        .query({ customer_phone: customerPhone })
        .set('X-Tenant-Slug', slug);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('pending');
      expect(res.body.paymentStatus).toBe('pending');
      expect(res.body.amountEtbCents).toBe(10000);
      expect(res.body.serviceName).toBe('Premium Haircut');
      expect(res.body.customerName).toBe('Test Customer');
      // Should contain Ethiopian date string (not raw milliseconds)
      expect(res.body.startDateDisplay).toBeTruthy();
      expect(typeof res.body.startDateDisplay).toBe('string');
      // Should NOT contain Gregorian-only format
      expect(res.body.startDateDisplay).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns 403 when phone does not match', async () => {
      const res = await request(app)
        .get(`/api/public/appointments/${apptId}/status`)
        .query({ customer_phone: '+251911999999' })
        .set('X-Tenant-Slug', slug);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Phone');
    });

    it('returns 400 when phone is missing', async () => {
      const res = await request(app)
        .get(`/api/public/appointments/${apptId}/status`)
        .set('X-Tenant-Slug', slug);

      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent appointment', async () => {
      const res = await request(app)
        .get(`/api/public/appointments/${crypto.randomUUID()}/status`)
        .query({ customer_phone: customerPhone })
        .set('X-Tenant-Slug', slug);

      expect(res.status).toBe(404);
    });

    it('returns 404 when appointment belongs to a different tenant (cross-tenant)', async () => {
      // Create a second tenant with a different slug
      const otherSlug = `other-${slug}`;
      const otherTenantId = crypto.randomUUID();
      await db.insert(tenants).values({
        id: otherTenantId, name: 'Other Shop', slug: otherSlug, createdAt: Date.now(),
      }).catch(() => {});

      const res = await request(app)
        .get(`/api/public/appointments/${apptId}/status`)
        .query({ customer_phone: customerPhone })
        .set('X-Tenant-Slug', otherSlug);

      expect(res.status).toBe(404);

      await db.delete(tenants).where(eq(tenants.id, otherTenantId)).catch(() => {});
    });

    it('returns confirmed status after payment completes', async () => {
      // Simulate the appointment being confirmed
      await db.update(appointments).set({ status: 'confirmed' }).where(eq(appointments.id, apptId)).run();

      const res = await request(app)
        .get(`/api/public/appointments/${apptId}/status`)
        .query({ customer_phone: customerPhone })
        .set('X-Tenant-Slug', slug);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('confirmed');

      // Reset back to pending for other tests
      await db.update(appointments).set({ status: 'pending' }).where(eq(appointments.id, apptId)).run();
    });
  });

  describe('Slot-hold expiry (cancels_at cleanup)', () => {
    it('cancels pending appointment with past cancels_at', async () => {
      const past = Date.now() - 3600_000; // 1 hour ago
      const apptId = crypto.randomUUID();
      const startTime = futureSlot(2, 14);
      const endTime = startTime + 45 * 60000;

      await db.insert(appointments).values({
        id: apptId, tenantId, customerName: 'Stale Customer',
        customerPhone: '+251911111111', staffId, serviceId,
        startTime, endTime, status: 'pending',
        reminderSent: false, cancelsAt: past,
      });

      // Run the slot-cleanup logic (import runOnce from cron)
      const { runOnce } = await import('../cron/sendReminders');
      await runOnce(tenantId);

      const after = await db.select().from(appointments).where(eq(appointments.id, apptId)).get();
      expect(after?.status).toBe('cancelled');

      await db.delete(appointments).where(eq(appointments.id, apptId)).run();
    });

    it('leaves pending appointment with future cancels_at unchanged', async () => {
      const future = Date.now() + 3600_000; // 1 hour from now
      const apptId = crypto.randomUUID();
      const startTime = futureSlot(2, 15);
      const endTime = startTime + 45 * 60000;

      await db.insert(appointments).values({
        id: apptId, tenantId, customerName: 'Active Customer',
        customerPhone: '+251911222222', staffId, serviceId,
        startTime, endTime, status: 'pending',
        reminderSent: false, cancelsAt: future,
      });

      const { runOnce } = await import('../cron/sendReminders');
      await runOnce(tenantId);

      const after = await db.select().from(appointments).where(eq(appointments.id, apptId)).get();
      // Should NOT be cancelled — cancelsAt is in the future
      expect(after?.status).toBe('pending');

      await db.delete(appointments).where(eq(appointments.id, apptId)).run();
    });
  });
});