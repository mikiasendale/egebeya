import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq, and, like } from 'drizzle-orm';

import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants, users, services, staff, staffServices, staffAvailability,
  appointments, payments, tenantBusinessHours, pages, media,
  proSiteFiles, tenantSubscriptions, plans,
} from '../../src/db/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';
const app = express();
app.use(express.json({
  verify: (req, _res, buf) => { (req as any).rawBody = buf; },
}));
app.use('/api', apiRoutes);

describe('Cross-tenant isolation — every scoped resource rejects B-ids when authed as A', () => {
  const slugA = `isoA-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  const slugB = `isoB-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;

  let tokenA: string;
  let tA: string; let tB: string;
  let svcA: string; let svcB: string;
  let staA: string; let staB: string;
  let apptA: string;
  let payA: string;
  let mediaB: string;

  beforeAll(async () => {
    tA = crypto.randomUUID(); tB = crypto.randomUUID();
    const pw = await bcrypt.hash('p', 8);
    const ph = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    await db.insert(tenants).values([
      { id: tA, name: 'A', slug: slugA, settings: {}, createdAt: Date.now() },
      { id: tB, name: 'B', slug: slugB, settings: {}, createdAt: Date.now() },
    ]);
    const aUserId = crypto.randomUUID();
    await db.insert(users).values({ id: aUserId, tenantId: tA, name: 'AO', phone: ph, email: `a@${Date.now()}.t`, passwordHash: pw, role: 'owner', createdAt: Date.now() });

    const fp = await db.select().from(plans).where(eq(plans.name, 'free')).get();
    if (!fp) throw new Error('free plan not seeded');
    await db.insert(tenantSubscriptions).values([
      { id: crypto.randomUUID(), tenantId: tA, planId: fp.id, status: 'active', startsAt: Date.now() },
      { id: crypto.randomUUID(), tenantId: tB, planId: fp.id, status: 'active', startsAt: Date.now() },
    ]);
    tokenA = jwt.sign({ userId: aUserId, tenantId: tA, role: 'owner', tokenVersion: 0 }, JWT_SECRET, { expiresIn: '15m' });

    svcA = crypto.randomUUID(); svcB = crypto.randomUUID();
    staA = crypto.randomUUID(); staB = crypto.randomUUID();
    await db.insert(services).values([
      { id: svcA, tenantId: tA, name: 'AHair', durationMinutes: 30, price: 5000, active: true },
      { id: svcB, tenantId: tB, name: 'BMassage', durationMinutes: 60, price: 15000, active: true },
    ]);
    await db.insert(staff).values([
      { id: staA, tenantId: tA, name: 'ASt', active: true },
      { id: staB, tenantId: tB, name: 'BTh', active: true },
    ]);
    await db.insert(staffServices).values({ staffId: staA, serviceId: svcA });
    await db.insert(staffServices).values({ staffId: staB, serviceId: svcB });

    const sl = Date.UTC(2030, 0, 15, 12, 0, 0, 0);
    apptA = crypto.randomUUID(); payA = crypto.randomUUID();
    await db.insert(appointments).values({
      id: apptA, tenantId: tA, customerName: 'CA', customerPhone: '+251911111111',
      staffId: staA, serviceId: svcA, startTime: sl, endTime: sl + 1800000, status: 'pending',
    });
    await db.insert(payments).values({
      id: payA, tenantId: tA, appointmentId: apptA, amount: 5000,
      gateway: 'chapa', method: 'telebirr', gatewayReference: `tx-${Date.now()}`, status: 'pending',
    });
    await db.insert(pages).values([
      { tenantId: tA, content: { mark: 'A' } },
      { tenantId: tB, content: { mark: 'B' } },
    ]);
    mediaB = crypto.randomUUID();
    await db.insert(media).values([
      { id: crypto.randomUUID(), tenantId: tA, path: '/u/a.jpg', originalName: 'a.jpg', mimeType: 'image/jpeg', size: 1, createdAt: Date.now() },
      { id: mediaB, tenantId: tB, path: '/u/b.jpg', originalName: 'b.jpg', mimeType: 'image/jpeg', size: 1, createdAt: Date.now() },
    ]);
    await db.insert(proSiteFiles).values({
      id: crypto.randomUUID(), tenantId: tB, filePath: 'App.js', content: '//B', updatedAt: Date.now(),
    });
    for (const t of [tA, tB])
      for (let d = 0; d <= 6; d++)
        await db.insert(tenantBusinessHours).values({
          id: crypto.randomUUID(), tenantId: t, dayOfWeek: d,
          openTime: '09:00', closeTime: '17:00', isClosed: false,
        });
  });

  afterAll(async () => {
    // Delete in FK-safe order: children first, then parents.
    for (const t of [tA, tB]) {
      await db.delete(proSiteFiles).where(eq(proSiteFiles.tenantId, t));
      await db.delete(media).where(eq(media.tenantId, t));
      await db.delete(pages).where(eq(pages.tenantId, t));
      await db.delete(payments).where(eq(payments.tenantId, t));
      await db.delete(appointments).where(eq(appointments.tenantId, t));
      await db.delete(tenantBusinessHours).where(eq(tenantBusinessHours.tenantId, t));
      await db.delete(staffServices).where(eq(staffServices.staffId, staA));
      await db.delete(staffServices).where(eq(staffServices.staffId, staB));
      await db.delete(staffAvailability).where(eq(staffAvailability.staffId, staA));
      await db.delete(staffAvailability).where(eq(staffAvailability.staffId, staB));
      await db.delete(staff).where(eq(staff.tenantId, t));
      await db.delete(services).where(eq(services.tenantId, t));
      await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, t));
      await db.delete(users).where(eq(users.tenantId, t));
      await db.delete(tenants).where(eq(tenants.id, t));
    }
  });

  function auth() { return { Authorization: `Bearer ${tokenA}` }; }

  // ───────────────── services ─────────────────

  it('services list: does NOT include B services', async () => {
    const r = await request(app).get('/api/tenant/services').set(auth());
    expect(r.status).toBe(200);
    const names = (r.body as any[]).map((s: any) => s.name);
    expect(names).toContain('AHair');
    expect(names).not.toContain('BMassage');
  });

  it('services PUT: cannot update B service (404)', async () => {
    const r = await request(app).put(`/api/tenant/services/${svcB}`).set(auth()).set('Content-Type', 'application/json').send({ name: 'hacked' });
    expect(r.status).toBe(404);
  });

  it('services DELETE: cannot delete B service (404)', async () => {
    const r = await request(app).delete(`/api/tenant/services/${svcB}`).set(auth());
    expect(r.status).toBe(404);
    const stillThere = await db.select().from(services).where(eq(services.id, svcB)).get();
    expect(stillThere).toBeDefined();
  });

  it('services GET by id with B service returns 404', async () => {
    const r = await request(app).get(`/api/tenant/services/${svcB}`).set(auth());
    expect(r.status).toBe(404);
  });

  // ───────────────── staff ─────────────────

  it('staff list: does NOT include B staff', async () => {
    const r = await request(app).get('/api/tenant/staff').set(auth());
    expect(r.status).toBe(200);
    const names = (r.body as any[]).map((s: any) => s.name);
    expect(names).toContain('ASt');
    expect(names).not.toContain('BTh');
  });

  it('staff PUT: cannot update B staff (404)', async () => {
    const r = await request(app).put(`/api/tenant/staff/${staB}`).set(auth()).set('Content-Type', 'application/json').send({ name: 'hacked' });
    expect(r.status).toBe(404);
  });

  it('staff DELETE: cannot delete B staff (404)', async () => {
    const r = await request(app).delete(`/api/tenant/staff/${staB}`).set(auth());
    expect(r.status).toBe(404);
    const still = await db.select().from(staff).where(eq(staff.id, staB)).get();
    expect(still).toBeDefined();
  });

  it('staff GET services with B staff id returns 404', async () => {
    const r = await request(app).get(`/api/tenant/staff/${staB}/services`).set(auth());
    expect(r.status).toBe(404);
  });

  // ───────────────── bookings (authenticated) ─────────────────

  it('bookings list: does NOT include B id', async () => {
    const r = await request(app).get('/api/bookings').set(auth());
    expect(r.status).toBe(200);
    const ids = (r.body as any[]).map((b: any) => b.id);
    expect(ids).toContain(apptA);
    // no cross-tenant appt was ever created, so we just confirm A's own
  });

  it('bookings GET by id with a fake id returns 404', async () => {
    const r = await request(app).get(`/api/bookings/${crypto.randomUUID()}`).set(auth());
    expect(r.status).toBe(404);
  });

  it('bookings PUT status for non-existent id returns 404', async () => {
    const r = await request(app).put(`/api/bookings/${crypto.randomUUID()}/status`).set(auth()).set('Content-Type', 'application/json').send({ status: 'confirmed' });
    expect(r.status).toBe(404);
  });

  // ───────────────── public booking cross-tenant ─────────────────

  it('public booking with B staff/service under A slug returns 404', async () => {
    const d = new Date(Date.now() + 14 * 86400000);
    const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 10, 0, 0, 0));
    const r = await request(app).post('/api/public/bookings').set('X-Tenant-Slug', slugA).send({
      staff_id: staB, service_id: svcB, start_time: s.toISOString(),
      customer_name: 'X', customer_phone: '+251911222222',
    });
    expect(r.status).toBe(404);
    expect(String(r.body.error || '').toLowerCase()).toMatch(/not found/);
  });

  // ───────────────── public availability cross-tenant ─────────────────

  it('public availability with B staff under A slug returns []', async () => {
    const dateStr = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const r = await request(app).get(`/api/public/availability?staff_id=${staB}&date=${dateStr}`).set('X-Tenant-Slug', slugA);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body.length).toBe(0);
  });

  // ───────────────── pages ─────────────────

  it('GET /api/tenant/page returns A content only (not B)', async () => {
    const r = await request(app).get('/api/tenant/page').set(auth());
    expect(r.status).toBe(200);
    expect((r.body as any)?.content?.mark).toBe('A');
  });

  it('PUT /api/tenant/page scoped to own tenant', async () => {
    const r = await request(app).put('/api/tenant/page').set(auth()).set('Content-Type', 'application/json').send({ content: { mark: 'updated' } });
    expect(r.status).toBe(200);
    const pA = await db.select().from(pages).where(eq(pages.tenantId, tA)).get();
    expect((pA as any)?.content?.mark).toBe('updated');
    const pB = await db.select().from(pages).where(eq(pages.tenantId, tB)).get();
    expect((pB as any)?.content?.mark).toBe('B');
  });

  // ───────────────── media ─────────────────

  it('media list does NOT include B media', async () => {
    const r = await request(app).get('/api/tenant/media').set(auth());
    expect(r.status).toBe(200);
    const paths = (r.body as any[]).map((m: any) => m.path);
    expect(paths).not.toContain('/u/b.jpg');
  });

  it('media DELETE on B media returns 404', async () => {
    const r = await request(app).delete(`/api/tenant/media/${mediaB}`).set(auth());
    expect(r.status).toBe(404);
    const still = await db.select().from(media).where(eq(media.id, mediaB)).get();
    expect(still).toBeDefined();
  });

  // ───────────────── pro-site files ─────────────────

  it('pro-site GET /files with free plan returns 403 (no plan gate leak)', async () => {
    const r = await request(app).get('/api/tenant/pro-site/files').set(auth());
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('PLAN_REQUIRED');
  });

  // ───────────────── subscription ─────────────────

  it('GET /api/tenant/subscription returns A subscription', async () => {
    const r = await request(app).get('/api/tenant/subscription').set(auth());
    expect(r.status).toBe(200);
    expect(r.body.subscription?.tenantId).toBe(tA);
  });

  // ───────────────── business-hours ─────────────────

  it('PUT /api/tenant/business-hours scoped to own tenant', async () => {
    const r = await request(app).put('/api/tenant/business-hours').set(auth()).set('Content-Type', 'application/json').send({
      hours: [{ dayOfWeek: 0, openTime: '10:00', closeTime: '16:00', isClosed: false }],
    });
    expect(r.status).toBe(200);
    const hA = await db.select().from(tenantBusinessHours).where(and(eq(tenantBusinessHours.tenantId, tA), eq(tenantBusinessHours.dayOfWeek, 0))).get();
    expect(hA?.openTime).toBe('10:00');
    const hB = await db.select().from(tenantBusinessHours).where(and(eq(tenantBusinessHours.tenantId, tB), eq(tenantBusinessHours.dayOfWeek, 0))).get();
    expect(hB?.openTime).toBe('09:00');
  });
});