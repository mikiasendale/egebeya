/**
 * T4.5 — structural is_demo exclusion across admin aggregates.
 *
 * A seeded/fictional tenant not on any real billing plan must not flatter
 * platform counts anywhere a superadmin reads them:
 *   - /admin/stats    → tenants, bookings (via an appointment with valid
 *                       staff/service FKs), suspended
 *   - /admin/tenants  → never triaged (absent from the operator list)
 *
 * Delta-based so the shared test DB's pre-existing rows can't skew it: add a
 * flagged tenant + a real tenant, then assert only the real one moved the
 * counters. /discover listing behavior is covered elsewhere and unchanged.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';

import { db } from '../../src/db';
import { tenants, appointments, users } from '../../src/db/schema';
import {
  mountApp, makeOwner, makeSuperadmin, seedBusiness, deleteTenantCascade,
} from './chain-helpers';
import type { App } from './chain-helpers';

describe('T4.5 admin aggregates exclude is_demo tenants', () => {
  let app: App;
  let superToken: string;
  let superuserId: string;
  let flagTenantId = '';
  let realTenantId = '';
  let baseline: { tenants: number; bookings: number; suspended: number } = { tenants: 0, bookings: 0, suspended: 0 };

  async function addAppointment(tenantId: string, staffId: string, serviceId: string): Promise<void> {
    const now = Date.now();
    await db.insert(appointments).values({
      id: crypto.randomUUID(),
      tenantId,
      customerName: 'Delta Customer',
      customerPhone: '+251955990001',
      staffId,
      serviceId,
      startTime: now,
      endTime: now + 1800_000,
      status: 'confirmed',
      reminderSent: false,
      opaqueId: crypto.randomBytes(16).toString('hex'),
    });
  }

  beforeAll(async () => {
    app = await mountApp();
    const superadmin = await makeSuperadmin();
    superToken = superadmin.token;
    superuserId = superadmin.userId;

    // Baseline BEFORE seeding either tenant.
    const b1 = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${superToken}`);
    baseline = b1.body;

    // A fictional/seed tenant, explicitly flagged, with a real booking FKs.
    const flagCtx = await makeOwner({ name: 'Demo Flag Tenant' });
    flagTenantId = flagCtx.tenantId;
    const flagBiz = await seedBusiness(flagTenantId, { durationMinutes: 30, priceCents: 20000 });
    await db.update(tenants).set({ isDemo: true }).where(eq(tenants.id, flagTenantId));
    await addAppointment(flagTenantId, flagBiz.staffId, flagBiz.serviceId);

    // A real, un-flagged tenant with the same shape.
    const realCtx = await makeOwner({ name: 'Real Tenant' });
    realTenantId = realCtx.tenantId;
    const realBiz = await seedBusiness(realTenantId, { durationMinutes: 30, priceCents: 20000 });
    await addAppointment(realTenantId, realBiz.staffId, realBiz.serviceId);
  });

  afterAll(async () => {
    await deleteTenantCascade(flagTenantId).catch(() => {});
    await deleteTenantCascade(realTenantId).catch(() => {});
    await db.delete(users).where(eq(users.id, superuserId)).catch(() => {});
  });

  it('/admin/stats counts only the real tenant and its booking', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);

    expect(res.body.tenants - baseline.tenants).toBe(1);
    expect(res.body.bookings - baseline.bookings).toBe(1);
    expect(res.body.suspended - baseline.suspended).toBe(0);
  });

  it('/admin/tenants lists the real tenant and never the flagged one', async () => {
    const res = await request(app)
      .get('/api/admin/tenants')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.map((t: any) => t.id);
    expect(ids).toContain(realTenantId);
    expect(ids).not.toContain(flagTenantId);
  });
});
