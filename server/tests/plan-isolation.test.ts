import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants,
  users,
  services,
  staff,
  appointments,
  tenantBusinessHours,
  tenantSubscriptions,
  plans,
  proSiteFiles,
} from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

/**
 * Test Suite: Plan-gate enforcement + tenant isolation + booking CRUD
 *
 * Creates two tenants — one Free, one Pro — and verifies that Free tenants
 * are blocked from Pro-only routes while Pro tenants can access them. Also
 * verifies that each tenant's bookings / staff / services / pro-site files
 * are invisible to the other tenant.
 */
describe('Plan-gate enforcement & tenant isolation', () => {
  const freeSlug = `free-${Date.now()}`;
  const proSlug = `pro-${Date.now()}`;

  let freeTenantId: string;
  let proTenantId: string;
  let freeToken: string;
  let proToken: string;
  let freeStaffId: string;
  let freeServiceId: string;
  let proStaffId: string;
  let proServiceId: string;

  beforeAll(async () => {
    freeTenantId = crypto.randomUUID();
    proTenantId = crypto.randomUUID();

    const freeUserId = crypto.randomUUID();
    const proUserId = crypto.randomUUID();

    const freePhone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    const proPhone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    const pwHash = await bcrypt.hash('pass1234', 10);

    // Free tenant
    await db.insert(tenants).values({
      id: freeTenantId,
      name: 'Free Salon',
      slug: freeSlug,
      settings: { require_payment_upfront: false },
      createdAt: Date.now(),
    });
    await db.insert(users).values({
      id: freeUserId,
      tenantId: freeTenantId,
      name: 'Free Owner',
      phone: freePhone,
      email: `free-${Date.now()}@egebeya.test`,
      passwordHash: pwHash,
      role: 'owner',
      createdAt: Date.now(),
    });

    // Pro tenant
    await db.insert(tenants).values({
      id: proTenantId,
      name: 'Pro Salon',
      slug: proSlug,
      settings: { require_payment_upfront: false },
      createdAt: Date.now(),
    });
    await db.insert(users).values({
      id: proUserId,
      tenantId: proTenantId,
      name: 'Pro Owner',
      phone: proPhone,
      email: `pro-${Date.now()}@egebeya.test`,
      passwordHash: pwHash,
      role: 'owner',
      createdAt: Date.now(),
    });

    // Resolve plan rows (seeded by server.ts)
    const freePlan = await db.select().from(plans).where(eq(plans.name, 'free')).get();
    const proPlan = await db.select().from(plans).where(eq(plans.name, 'pro')).get();

    // Free subscription
    await db.insert(tenantSubscriptions).values({
      id: crypto.randomUUID(),
      tenantId: freeTenantId,
      planId: freePlan!.id,
      status: 'active',
      startsAt: Date.now(),
    });

    // Pro subscription
    await db.insert(tenantSubscriptions).values({
      id: crypto.randomUUID(),
      tenantId: proTenantId,
      planId: proPlan!.id,
      status: 'active',
      startsAt: Date.now(),
    });

    freeToken = jwt.sign({ userId: freeUserId, tenantId: freeTenantId, role: 'owner' }, JWT_SECRET, { expiresIn: '15m' });
    proToken = jwt.sign({ userId: proUserId, tenantId: proTenantId, role: 'owner' }, JWT_SECRET, { expiresIn: '15m' });

    // Seed staff + services for both tenants
    freeStaffId = crypto.randomUUID();
    freeServiceId = crypto.randomUUID();
    proStaffId = crypto.randomUUID();
    proServiceId = crypto.randomUUID();

    await db.insert(services).values({
      id: freeServiceId,
      tenantId: freeTenantId,
      name: 'Free Haircut',
      durationMinutes: 30,
      price: 5000,
      active: true,
    });
    await db.insert(staff).values({
      id: freeStaffId,
      tenantId: freeTenantId,
      name: 'Free Stylist',
      active: true,
    });

    await db.insert(services).values({
      id: proServiceId,
      tenantId: proTenantId,
      name: 'Pro Massage',
      durationMinutes: 60,
      price: 15000,
      active: true,
    });
    await db.insert(staff).values({
      id: proStaffId,
      tenantId: proTenantId,
      name: 'Pro Therapist',
      active: true,
    });

    // Business hours for both (all days)
    for (const [tid, slug] of [[freeTenantId, freeSlug], [proTenantId, proSlug]] as const) {
      const rows = [];
      for (let d = 0; d <= 6; d++) {
        rows.push({
          id: crypto.randomUUID(),
          tenantId: tid,
          dayOfWeek: d,
          openTime: '09:00',
          closeTime: '17:00',
          isClosed: false,
        });
      }
      await db.insert(tenantBusinessHours).values(rows);
    }
  });

  afterAll(async () => {
    await db.delete(appointments).where(eq(appointments.tenantId, freeTenantId));
    await db.delete(appointments).where(eq(appointments.tenantId, proTenantId));
    await db.delete(proSiteFiles).where(eq(proSiteFiles.tenantId, freeTenantId));
    await db.delete(proSiteFiles).where(eq(proSiteFiles.tenantId, proTenantId));
    await db.delete(tenantBusinessHours).where(eq(tenantBusinessHours.tenantId, freeTenantId));
    await db.delete(tenantBusinessHours).where(eq(tenantBusinessHours.tenantId, proTenantId));
    await db.delete(services).where(eq(services.tenantId, freeTenantId));
    await db.delete(services).where(eq(services.tenantId, proTenantId));
    await db.delete(staff).where(eq(staff.tenantId, freeTenantId));
    await db.delete(staff).where(eq(staff.tenantId, proTenantId));
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, freeTenantId));
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, proTenantId));
    await db.delete(users).where(eq(users.tenantId, freeTenantId));
    await db.delete(users).where(eq(users.tenantId, proTenantId));
    await db.delete(tenants).where(eq(tenants.id, freeTenantId));
    await db.delete(tenants).where(eq(tenants.id, proTenantId));
  });

  // ----------------- PLAN-GATE: Pro-site endpoints -----------------

  describe('Pro-site endpoint gating', () => {
    it('Free tenant → GET /pro-site/files returns 403 PLAN_REQUIRED', async () => {
      const res = await request(app)
        .get('/api/tenant/pro-site/files')
        .set('Authorization', `Bearer ${freeToken}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PLAN_REQUIRED');
    });

    it('Pro tenant → GET /pro-site/files returns 200 after init', async () => {
      // Init first (idempotent)
      await request(app)
        .post('/api/tenant/pro-site/init')
        .set('Authorization', `Bearer ${proToken}`);

      const res = await request(app)
        .get('/api/tenant/pro-site/files')
        .set('Authorization', `Bearer ${proToken}`);
      expect(res.status).toBe(200);
      expect(typeof res.body).toBe('object');
      expect(Object.keys(res.body).length).toBeGreaterThan(0);
    });

    it('Free tenant → POST /pro-site/init returns 403', async () => {
      const res = await request(app)
        .post('/api/tenant/pro-site/init')
        .set('Authorization', `Bearer ${freeToken}`);
      expect(res.status).toBe(403);
    });

    it('Free tenant → PUT /pro-site/files returns 403', async () => {
      const res = await request(app)
        .put('/api/tenant/pro-site/files')
        .set('Authorization', `Bearer ${freeToken}`)
        .send({ 'App.js': '/* nope */' });
      expect(res.status).toBe(403);
    });
  });

  // ----------------- TENANT ISOLATION: bookings -----------------

  describe('Tenant isolation — cross-tenant queries', () => {
    it('Free tenant cannot see Pro tenant services', async () => {
      const res = await request(app)
        .get('/api/tenant/services')
        .set('Authorization', `Bearer ${freeToken}`);
      expect(res.status).toBe(200);
      const names = res.body.map((s: any) => s.name);
      expect(names).toContain('Free Haircut');
      expect(names).not.toContain('Pro Massage');
    });

    it('Pro tenant cannot see Free tenant services', async () => {
      const res = await request(app)
        .get('/api/tenant/services')
        .set('Authorization', `Bearer ${proToken}`);
      expect(res.status).toBe(200);
      const names = res.body.map((s: any) => s.name);
      expect(names).toContain('Pro Massage');
      expect(names).not.toContain('Free Haircut');
    });

    it("Pro tenant can't book against Free tenant's staff (cross-tenant)", async () => {
      const future = new Date(Date.now() + 4 * 24 * 3600 * 1000);
      const futureSlot = new Date(Date.UTC(
        future.getUTCFullYear(),
        future.getUTCMonth(),
        future.getUTCDate(),
        11, 0, 0, 0,
      ));

      const res = await request(app)
        .post('/api/public/bookings')
        .set('X-Tenant-Slug', proSlug)
        .send({
          staff_id: freeStaffId,
          service_id: freeServiceId,
          start_time: futureSlot.toISOString(),
          customer_name: 'Cross-Tenant Customer',
          customer_phone: '+251911000999',
        });
      expect(res.status).toBe(404);
      expect(String(res.body.error || '').toLowerCase()).toMatch(/not found/);
    });

    it("Free tenant can't see Pro tenant's pro-site files", async () => {
      const res = await request(app)
        .get('/api/tenant/pro-site/files')
        .set('Authorization', `Bearer ${freeToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ──────────────── BOOKING CRUD (authenticated) ────────────────

  describe('Booking CRUD (authenticated)', () => {
    const slotMs = (() => {
      const f = new Date(Date.now() + 5 * 24 * 3600 * 1000);
      return Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate(), 12, 0, 0, 0);
    })();
    let bookingId: string;

    it('creates a public booking for the Pro tenant', async () => {
      const res = await request(app)
        .post('/api/public/bookings')
        .set('X-Tenant-Slug', proSlug)
        .send({
          staff_id: proStaffId,
          service_id: proServiceId,
          start_time: new Date(slotMs).toISOString(),
          customer_name: 'CRUD Customer',
          customer_phone: '+251912000888',
        });
      expect(res.status).toBe(201);
      expect(res.body.appointment?.id).toBeDefined();
      bookingId = res.body.appointment.id;
    });

    it('GET /api/bookings lists the booking for the authenticated tenant', async () => {
      const res = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${proToken}`);
      expect(res.status).toBe(200);
      const ids = (res.body ?? []).map((b: any) => b.id);
      expect(ids).toContain(bookingId);
    });

    it('Free tenant GET /api/bookings does NOT see the Pro booking', async () => {
      const res = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${freeToken}`);
      expect(res.status).toBe(200);
      const ids = (res.body ?? []).map((b: any) => b.id);
      expect(ids).not.toContain(bookingId);
    });

    it('owner can mark booking as confirmed via PUT /:id/status', async () => {
      const res = await request(app)
        .put(`/api/bookings/${bookingId}/status`)
        .set('Authorization', `Bearer ${proToken}`)
        .send({ status: 'confirmed' });
      expect(res.ok).toBe(true);
    });

    it('GET /api/bookings/:id returns the updated status', async () => {
      const res = await request(app)
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${proToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('confirmed');
    });
  });
});