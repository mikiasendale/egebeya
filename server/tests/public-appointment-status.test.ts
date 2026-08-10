/**
 * Public appointment status endpoint tests.
 *
 * Feature C: GET /api/public/appointments/:id/status
 *
 * Covers:
 *   - Returns 403 when phone does not match
 *   - Returns 404 for cross-tenant appointment id
 *   - Returns 200 with correct Ethiopic date projection when phone matches
 *   - Payment status is filtered (no raw Chapa meta)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import { tenants, services, staff, appointments, payments } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

describe('Public appointment status (Feature C)', () => {
  const slug = `pubstatus-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  let tenantId: string;
  let serviceId: string;
  let staffId: string;
  let apptId: string;
  let apptOpaqueId: string;
  const customerPhone = '+251911123456';

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    serviceId = crypto.randomUUID();
    staffId = crypto.randomUUID();
    apptId = crypto.randomUUID();
    apptOpaqueId = crypto.randomBytes(16).toString('hex');

    await db.insert(tenants).values({
      id: tenantId, name: 'Status Test Shop', slug,
      settings: { defaultLocale: 'en' },
      createdAt: Date.now(),
    });
    await db.insert(services).values({
      id: serviceId, tenantId, name: 'Consultation', durationMinutes: 30, price: 5000, active: true,
    });
    await db.insert(staff).values({
      id: staffId, tenantId, name: 'Dr. A', active: true,
    });
    await db.insert(appointments).values({
      id: apptId, tenantId, customerName: 'John',
      customerPhone, customerEmail: 'john@test.com',
      staffId, serviceId,
      startTime: Date.now() + 86400000,
      endTime: Date.now() + 86400000 + 1800000,
      status: 'confirmed', reminderSent: false,
      opaqueId: apptOpaqueId,
    });
    await db.insert(payments).values({
      id: crypto.randomUUID(), tenantId, appointmentId: apptId,
      amount: 5000, gateway: 'chapa', method: 'telebirr',
      gatewayReference: 'tx-ref-status', status: 'completed',
    });
  });

  afterAll(async () => {
    await db.delete(payments).where(eq(payments.appointmentId, apptId)).catch(() => {});
    await db.delete(appointments).where(eq(appointments.id, apptId)).catch(() => {});
    await db.delete(services).where(eq(services.id, serviceId)).catch(() => {});
    await db.delete(staff).where(eq(staff.id, staffId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
  });

  it('returns 200 with Ethiopian date projection when phone matches', async () => {
    const res = await request(app)
      .get(`/api/public/appointments/${apptOpaqueId}/status`)
      .query({ customer_phone: customerPhone })
      .set('X-Tenant-Slug', slug);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('paymentStatus');
    expect(res.body).toHaveProperty('startDateDisplay');
    expect(res.body.startDateDisplay).toBeTruthy();
    // Should contain Ethiopian month name (not raw epoch)
    expect(res.body.startDateDisplay).toMatch(/[A-Z][a-z]+/);
    // Should NOT expose internal IDs or raw Chapa meta
    expect(res.body).not.toHaveProperty('meta');
    expect(res.body).not.toHaveProperty('gatewayReference');
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('returns 403 when phone does not match', async () => {
    const res = await request(app)
      .get(`/api/public/appointments/${apptOpaqueId}/status`)
      .query({ customer_phone: '+251911999999' })
      .set('X-Tenant-Slug', slug);

    expect(res.status).toBe(403);
  });

  it('returns 404 for cross-tenant appointment id', async () => {
    // Create a second tenant
    const otherSlug = `other-status-${Date.now()}`;
    const otherTenantId = crypto.randomUUID();
    await db.insert(tenants).values({
      id: otherTenantId, name: 'Other Shop', slug: otherSlug, createdAt: Date.now(),
    });

    const res = await request(app)
      .get(`/api/public/appointments/${apptOpaqueId}/status`)
      .query({ customer_phone: customerPhone })
      .set('X-Tenant-Slug', otherSlug);

    expect(res.status).toBe(404);

    await db.delete(tenants).where(eq(tenants.id, otherTenantId)).catch(() => {});
  });

  it('returns 400 when phone query param is missing', async () => {
    const res = await request(app)
      .get(`/api/public/appointments/${apptOpaqueId}/status`)
      .set('X-Tenant-Slug', slug);

    expect(res.status).toBe(400);
  });
});