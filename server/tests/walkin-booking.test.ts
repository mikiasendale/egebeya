import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import { tenants, users, services, staff, appointments, securityEvents } from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET as string;
const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

function tokenFor(userId: string, tenantId: string): string {
  return jwt.sign({ userId, tenantId, role: 'owner', tokenVersion: 0 }, JWT_SECRET, { expiresIn: '15m' });
}

describe('Owner walk-in bookings', () => {
  const slug = `walkin-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  const slugF = `walkf-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  let tenantId: string;
  let foreignTenantId: string;
  let userId: string;
  let staffId: string;
  let serviceId: string;
  let foreignStaffId: string;
  let foreignServiceId: string;
  let token: string;

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    foreignTenantId = crypto.randomUUID();
    userId = crypto.randomUUID();
    const phone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;

    await db.insert(tenants).values({ id: tenantId, name: 'Walk In Lodge', slug, settings: { require_payment_upfront: false }, createdAt: Date.now() });
    await db.insert(tenants).values({ id: foreignTenantId, name: 'Foreign Biz', slug: slugF, settings: { require_payment_upfront: false }, createdAt: Date.now() });
    await db.insert(users).values({ id: userId, tenantId, name: 'Walk In Owner', phone, email: `${slug}@egebeya.test`, passwordHash: await bcrypt.hash('pass1234', 10), role: 'owner', createdAt: Date.now() });

    serviceId = crypto.randomUUID();
    await db.insert(services).values({ id: serviceId, tenantId, name: 'Walk-in Barber', durationMinutes: 30, price: 20000, active: true });
    staffId = crypto.randomUUID();
    await db.insert(staff).values({ id: staffId, tenantId, name: 'Walk-in Stylist', active: true });

    foreignServiceId = crypto.randomUUID();
    await db.insert(services).values({ id: foreignServiceId, tenantId: foreignTenantId, name: 'Foreign service', durationMinutes: 30, price: 100, active: true });
    foreignStaffId = crypto.randomUUID();
    await db.insert(staff).values({ id: foreignStaffId, tenantId: foreignTenantId, name: 'Foreign Staff', active: true });

    token = tokenFor(userId, tenantId);
  });

  afterAll(async () => {
    await db.delete(appointments).where(eq(appointments.tenantId, tenantId));
    await db.delete(appointments).where(eq(appointments.tenantId, foreignTenantId));
    await db.delete(services).where(and(eq(services.tenantId, tenantId)));
    await db.delete(services).where(and(eq(services.tenantId, foreignTenantId)));
    await db.delete(staff).where(and(eq(staff.tenantId, tenantId)));
    await db.delete(staff).where(and(eq(staff.tenantId, foreignTenantId)));
    await db.delete(securityEvents).where(eq(securityEvents.tenantId, tenantId));
    await db.delete(users).where(eq(users.id, userId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(tenants).where(eq(tenants.id, foreignTenantId));
  });

  it('creates a confirmed (no-payment) walk-in appointment', async () => {
    const res = await request(app)
      .post('/api/tenant/bookings/walk-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ staffId, serviceId, startTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString(), customerName: 'Walk-in Customer', customerPhone: '+251911000111' });
    expect(res.status).toBe(201);
    expect(res.body.appointment.status).toBe('confirmed');
    const row = await db.select().from(appointments).where(eq(appointments.id, res.body.appointment.id)).get();
    expect(row?.status).toBe('confirmed');
  });

  it('rejects a past time with 422', async () => {
    const res = await request(app)
      .post('/api/tenant/bookings/walk-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ staffId, serviceId, startTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(), customerName: 'Late' });
    expect(res.status).toBe(422);
  });

  it('rejects an overlapping sequential time with 409', async () => {
    const t = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
    const ok = await request(app)
      .post('/api/tenant/bookings/walk-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ staffId, serviceId, startTime: t, customerName: 'First', customerPhone: '+251911000222' });
    expect(ok.status).toBe(201);
    const startMs = new Date(t).getTime();
    const overlap = new Date(startMs + 10 * 60 * 1000).toISOString();
    const conflictRes = await request(app)
      .post('/api/tenant/bookings/walk-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ staffId, serviceId, startTime: overlap, customerName: 'Second', customerPhone: '+251911000333' });
    expect(conflictRes.status).toBe(409);
  });

  it('serializes a 5-way concurrent burst to exactly one confirmed appointment', async () => {
    const start = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
    const burst = Array.from({ length: 5 }, (_, i) =>
      request(app)
        .post('/api/tenant/bookings/walk-in')
        .set('Authorization', `Bearer ${token}`)
        .send({ staffId, serviceId, startTime: start, customerName: `Burst ${i}`, customerPhone: `+251911000${500 + i}` }),
    );
    const reses = await Promise.all(burst);
    const statuses = reses.map((r) => r.status).filter((s) => s === 201 || s === 409);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(4);
  });

  it('rejects a foreign service with 404', async () => {
    const res = await request(app)
      .post('/api/tenant/bookings/walk-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ staffId, serviceId: foreignServiceId, startTime: new Date(Date.now() + 7 * 3600 * 1000).toISOString(), customerName: 'Foreign Svc' });
    expect(res.status).toBe(404);
  });

  it('rejects a foreign staff with 404 AND logs a cross_tenant_attempt', async () => {
    const res = await request(app)
      .post('/api/tenant/bookings/walk-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ staffId: foreignStaffId, serviceId, startTime: new Date(Date.now() + 8 * 3600 * 1000).toISOString(), customerName: 'Foreign Staff' });
    expect(res.status).toBe(404);
    const events = await db
      .select()
      .from(securityEvents)
      .where(and(eq(securityEvents.eventType, 'cross_tenant_attempt'), eq(securityEvents.tenantId, tenantId)))
      .all();
    expect(events.length).toBeGreaterThan(0);
  });
});
