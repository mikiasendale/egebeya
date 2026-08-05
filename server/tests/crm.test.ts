/**
 * CRM tests (Phase 2): customer history, promo codes, marketing blast.
 *
 * Covers:
 *   1. GET /api/tenant/customers includes marketingOptIn flag.
 *   2. POST /api/tenant/promo-codes creates a valid code; rejects duplicates.
 *   3. POST /api/tenant/marketing/blast sends only to opted-in customers.
 *   4. PATCH /api/tenant/customers/:phone/marketing-opt-in updates consent.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
  tenantBusinessHours, customerStats, promoCodes,
} from '../../src/db/schema';

const JWT_SECRET = process.env.JWT_SECRET as string;

function tokenFor(userId: string, tenantId: string): string {
  return jwt.sign({ userId, tenantId, role: 'owner', tokenVersion: 0 }, JWT_SECRET, { expiresIn: '15m' });
}

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

const suffix = `crm-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;

describe('CRM: Customers, Promo Codes, Marketing', () => {
  let tenantId: string;
  let ownerId: string;
  let serviceId: string;
  let staffId: string;
  let token: string;
  let optInPhone: string;
  let optOutPhone: string;

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    ownerId = crypto.randomUUID();
    serviceId = crypto.randomUUID();
    staffId = crypto.randomUUID();
    const phone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    optInPhone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    optOutPhone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;

    await db.insert(tenants).values({
      id: tenantId, name: 'CRM Test Salon', slug: `crm-${suffix}`,
      settings: { require_payment_upfront: false }, createdAt: Date.now(),
    });
    const pwHash = await bcrypt.hash('pass', 8);
    await db.insert(users).values({
      id: ownerId, tenantId, name: 'CRM Owner', phone,
      email: `crm-owner-${suffix}@egebeya.test`, passwordHash: pwHash,
      role: 'owner', createdAt: Date.now(),
    });
    await db.insert(servicesTable).values({
      id: serviceId, tenantId, name: 'CRM Service', durationMinutes: 30, price: 5000, active: true,
    });
    await db.insert(staff).values({ id: staffId, tenantId, name: 'CRM Stylist', active: true });
    for (let d = 0; d <= 6; d++) {
      await db.insert(tenantBusinessHours).values({
        id: crypto.randomUUID(), tenantId, dayOfWeek: d, openTime: '08:00', closeTime: '20:00', isClosed: false,
      });
    }

    // Seed two customers: one opted-in, one opted-out.
    const now = Date.now();
    await db.insert(customerStats).values({
      tenantId, customerPhone: optInPhone, customerName: 'Opt In Customer',
      visitCount: 3, totalSpendEtbCents: 30000, marketingOptIn: true, createdAt: now,
    });
    await db.insert(customerStats).values({
      tenantId, customerPhone: optOutPhone, customerName: 'Opt Out Customer',
      visitCount: 1, totalSpendEtbCents: 5000, marketingOptIn: false, createdAt: now,
    });

    token = tokenFor(ownerId, tenantId);
  });

  afterAll(async () => {
    await db.delete(appointments).where(eq(appointments.tenantId, tenantId)).catch(() => {});
    await db.delete(promoCodes).where(eq(promoCodes.tenantId, tenantId)).catch(() => {});
    await db.delete(customerStats).where(eq(customerStats.tenantId, tenantId)).catch(() => {});
    await db.delete(tenantBusinessHours).where(eq(tenantBusinessHours.tenantId, tenantId)).catch(() => {});
    await db.delete(servicesTable).where(eq(servicesTable.tenantId, tenantId)).catch(() => {});
    await db.delete(staff).where(eq(staff.tenantId, tenantId)).catch(() => {});
    await db.delete(users).where(eq(users.tenantId, tenantId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
  });

  it('GET /customers includes marketingOptIn flag', async () => {
    const res = await request(app)
      .get('/api/tenant/customers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const optInRow = res.body.find((c: any) => c.phone === optInPhone);
    const optOutRow = res.body.find((c: any) => c.phone === optOutPhone);
    expect(optInRow).toBeTruthy();
    expect(optInRow?.marketingOptIn).toBe(true);
    expect(optInRow?.name).toBe('Opt In Customer');
    expect(optInRow?.visitCount).toBe(3);
    expect(optOutRow).toBeTruthy();
    expect(optOutRow?.marketingOptIn).toBe(false);
  });

  it('GET /customers supports prefix search (q)', async () => {
    const res = await request(app)
      .get('/api/tenant/customers?q=Opt')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('POST /promo-codes creates a valid percent code', async () => {
    const res = await request(app)
      .post('/api/tenant/promo-codes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        code: 'WELCOME10',
        discountType: 'percent',
        discountValue: 10,
        maxUses: 50,
      });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe('WELCOME10');
    expect(res.body.discountType).toBe('percent');
    expect(res.body.discountValue).toBe(10);
    expect(res.body.maxUses).toBe(50);
    expect(res.body.isActive).toBe(true);
  });

  it('POST /promo-codes rejects duplicate code', async () => {
    // First creation should succeed.
    await request(app)
      .post('/api/tenant/promo-codes')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'SUMMER25', discountType: 'fixed_etb_cents', discountValue: 2500 });

    // Second with same code should 409.
    const res = await request(app)
      .post('/api/tenant/promo-codes')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'SUMMER25', discountType: 'fixed_etb_cents', discountValue: 2500 });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/);
  });

  it('POST /promo-codes rejects invalid discount type', async () => {
    const res = await request(app)
      .post('/api/tenant/promo-codes')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'BADTYPE', discountType: 'bogus', discountValue: 10 });

    expect(res.status).toBe(400);
  });

  it('POST /marketing/blast sends only to opted-in customers', async () => {
    const res = await request(app)
      .post('/api/tenant/marketing/blast')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hi! Our salon is offering weekend discounts.' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.sent).toBe(1); // only optInPhone
    expect(res.body.skipped).toBe(0);
  });

  it('POST /marketing/blast rejects empty message', async () => {
    const res = await request(app)
      .post('/api/tenant/marketing/blast')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: '' });

    expect(res.status).toBe(400);
  });

  it('PATCH /customers/:phone/marketing-opt-in updates consent', async () => {
    // Opt the opted-out customer in.
    const res = await request(app)
      .patch(`/api/tenant/customers/${optOutPhone}/marketing-opt-in`)
      .set('Authorization', `Bearer ${token}`)
      .send({ marketing_opt_in: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify the DB row changed.
    const row = await db.select().from(customerStats)
      .where(eq(customerStats.customerPhone, optOutPhone))
      .get();
    expect(row?.marketingOptIn).toBe(true);
  });

  it('PATCH /customers/:phone/marketing-opt-in 404s for unknown customer', async () => {
    const fakePhone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    const res = await request(app)
      .patch(`/api/tenant/customers/${fakePhone}/marketing-opt-in`)
      .set('Authorization', `Bearer ${token}`)
      .send({ marketing_opt_in: false });

    expect(res.status).toBe(404);
  });
});
