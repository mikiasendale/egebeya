/**
 * Inventory Management (Pharmacy) tests (Phase 2).
 *
 * Covers:
 *   1. PUT /api/tenant/inventory creates new items.
 *   2. GET /api/tenant/inventory lists items with low_stock flag.
 *   3. POST /api/tenant/inventory/:id/adjust adjusts stock (no negative).
 *   4. PUT with existing item id updates it.
 *   5. Rejects adjustment on non-existent item (404).
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
  tenantBusinessHours, inventoryItems, appointmentServices,
} from '../../src/db/schema';

const JWT_SECRET = process.env.JWT_SECRET as string;

function tokenFor(userId: string, tenantId: string): string {
  return jwt.sign({ userId, tenantId, role: 'owner', tokenVersion: 0 }, JWT_SECRET, { expiresIn: '15m' });
}

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

const suffix = `inv-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;

describe('Inventory Management', () => {
  let tenantId: string;
  let ownerId: string;
  let serviceId: string;
  let staffId: string;
  let token: string;

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    ownerId = crypto.randomUUID();
    serviceId = crypto.randomUUID();
    staffId = crypto.randomUUID();
    const phone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;

    await db.insert(tenants).values({
      id: tenantId, name: 'Inventory Test Salon', slug: `inv-${suffix}`,
      settings: { require_payment_upfront: false }, createdAt: Date.now(),
    });
    const pwHash = await bcrypt.hash('pass', 8);
    await db.insert(users).values({
      id: ownerId, tenantId, name: 'Inv Owner', phone,
      email: `inv-owner-${suffix}@egebeya.test`, passwordHash: pwHash,
      role: 'owner', createdAt: Date.now(),
    });
    await db.insert(servicesTable).values({
      id: serviceId, tenantId, name: 'Inv Service', durationMinutes: 30, price: 5000, active: true,
    });
    await db.insert(staff).values({ id: staffId, tenantId, name: 'Inv Stylist', active: true });

    token = tokenFor(ownerId, tenantId);
  });

  afterAll(async () => {
    const apps = await db.select({ id: appointments.id }).from(appointments).where(eq(appointments.tenantId, tenantId)).all();
    for (const a of apps) {
      // delete appointment_services if any
      await db.delete(appointmentServices).where(eq(appointmentServices.appointmentId, a.id)).catch(() => {});
    }
    await db.delete(appointments).where(eq(appointments.tenantId, tenantId)).catch(() => {});
    await db.delete(inventoryItems).where(eq(inventoryItems.tenantId, tenantId)).catch(() => {});
    await db.delete(tenantBusinessHours).where(eq(tenantBusinessHours.tenantId, tenantId)).catch(() => {});
    await db.delete(servicesTable).where(eq(servicesTable.tenantId, tenantId)).catch(() => {});
    await db.delete(staff).where(eq(staff.tenantId, tenantId)).catch(() => {});
    await db.delete(users).where(eq(users.tenantId, tenantId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
  });

  it('PUT /inventory creates new items', async () => {
    const res = await request(app)
      .put('/api/tenant/inventory')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          { name: 'Shampoo Bottle', sku: 'SHA-001', quantity_on_hand: 20, reorder_threshold: 5, unit: 'bottle' },
          { name: 'Hair Gel', sku: 'GEL-002', quantity_on_hand: 2, reorder_threshold: 10, unit: 'tube' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.items.length).toBe(2);
    expect(res.body.items[0].name).toBe('Shampoo Bottle');
    expect(res.body.items[1].name).toBe('Hair Gel');

    // Verify DB.
    const count = await db.select().from(inventoryItems)
      .where(eq(inventoryItems.tenantId, tenantId))
      .all();
    expect(count.length).toBe(2);
  });

  it('GET /inventory lists items with low_stock flag', async () => {
    const res = await request(app)
      .get('/api/tenant/inventory')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);

    const hairGel = res.body.find((i: any) => i.name === 'Hair Gel');
    expect(hairGel).toBeTruthy();
    // 2 on hand, threshold 10 → low stock.
    expect(hairGel?.lowStock).toBe(true);

    const shampoo = res.body.find((i: any) => i.name === 'Shampoo Bottle');
    expect(shampoo?.lowStock).toBe(false);
  });

  it('POST /inventory/:id/adjust increases stock', async () => {
    const items = await db.select().from(inventoryItems).where(eq(inventoryItems.tenantId, tenantId)).all();
    const gel = items.find((i) => i.name === 'Hair Gel');
    expect(gel).toBeTruthy();

    const res = await request(app)
      .post(`/api/tenant/inventory/${gel!.id}/adjust`)
      .set('Authorization', `Bearer ${token}`)
      .send({ delta: 8 });

    expect(res.status).toBe(200);
    expect(res.body.quantityOnHand).toBe(10);
    // 10 >= threshold(10) → not low stock anymore.
  });

  it('POST /inventory/:id/adjust never goes below 0', async () => {
    const items = await db.select().from(inventoryItems).where(eq(inventoryItems.tenantId, tenantId)).all();
    const shampoo = items.find((i) => i.name === 'Shampoo Bottle');

    const res = await request(app)
      .post(`/api/tenant/inventory/${shampoo!.id}/adjust`)
      .set('Authorization', `Bearer ${token}`)
      .send({ delta: -999 });

    expect(res.status).toBe(200);
    expect(res.body.quantityOnHand).toBe(0);
  });

  it('PUT /inventory updates existing item by id', async () => {
    const items = await db.select().from(inventoryItems).where(eq(inventoryItems.tenantId, tenantId)).all();
    const shampoo = items.find((i) => i.name === 'Shampoo Bottle');

    const res = await request(app)
      .put('/api/tenant/inventory')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{
          id: shampoo!.id,
          name: 'Shampoo Bottle XL',
          sku: 'SHA-001-XL',
          quantity_on_hand: 50,
          reorder_threshold: 10,
          unit: 'bottle',
        }],
      });

    expect(res.status).toBe(200);
    expect(res.body.items[0].name).toBe('Shampoo Bottle XL');
    expect(res.body.items[0].quantityOnHand).toBe(50);
  });

  it('POST /inventory/:id/adjust 404s for non-existent item', async () => {
    const res = await request(app)
      .post('/api/tenant/inventory/does-not-exist/adjust')
      .set('Authorization', `Bearer ${token}`)
      .send({ delta: 1 });

    expect(res.status).toBe(404);
  });
});
