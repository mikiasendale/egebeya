/**
 * P5.1 — redemption lowers the Chapa charge END-TO-END in test mode.
 *
 * The council gate is satisfied with REAL rows (not mocks): all customer_stats
 * opted in + this week's confirmed bookings pushed over 0.7 per billing-active
 * tenant. Then: matured card → public booking on a require-payment tenant →
 * the payments row records the LOWERED amount + loyalty meta, and the reward
 * is consumed (append-only) so the next cycle starts fresh.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

vi.mock('../../server/lib/chapa', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    initiateDirectCharge: vi.fn(async () => ({ ref_id: 'test-ref-1', status: 'success' })),
    authorizeDirectCharge: vi.fn(async () => ({ status: 'success' })),
    verifyPayment: vi.fn(async () => ({ status: 'success', amount: '', tx_ref: '', raw: {} })),
    generateTxRef: actual.generateTxRef,
  };
});

import { db } from '../../src/db';
import {
  tenants, users, plans, tenantSubscriptions, services as servicesTable,
  staff, appointments, customerStats, loyaltyLedger, punchCards, payments,
} from '../../src/db/schema';
import { eq } from 'drizzle-orm';

const app = express();
app.use(express.json());
const { default: apiRoutes } = await import('../../src/api');
app.use('/api', apiRoutes);

describe('loyalty redemption end-to-end (P5.1)', () => {
  let tenantId = ''; let svcId = ''; let staffId = '';
  const slug = `redemption-${Date.now()}`;
  const PHONE = `+2519${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
const LEGACY = PHONE;
  const createdAppts: string[] = [];
  let seededCustomerPhones = false;

  beforeAll(async () => {
    process.env.LOYALTY_ENABLED = 'true';
    tenantId = crypto.randomUUID();
    svcId = crypto.randomUUID();
    staffId = crypto.randomUUID();

    await db.insert(tenants).values({
      id: tenantId, name: 'Redemption Salon', slug,
      category: 'Salon',
      settings: { require_payment_upfront: true },
      createdAt: Date.now(),
    });
    await db.insert(users).values({
      id: crypto.randomUUID(), tenantId, name: 'Owner',
      phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
      email: `${slug}@egebeya.test`,
      passwordHash: await bcrypt.hash('pass1234', 10),
      role: 'owner', createdAt: Date.now(),
    });
    await db.insert(servicesTable).values({ id: svcId, tenantId, name: 'Braid Set', durationMinutes: 60, price: 30000, active: true });
    await db.insert(staff).values({ id: staffId, tenantId, name: 'Braider', active: true });

    // ── OPEN THE COUNCIL GATE WITH REAL ROWS (scoped to this fixture) ───
    // (1) Opt-in rate ≥ 50%: seed OPTED-IN customers belonging to THIS
    //     tenant only — never touch co-resident suites' rows. 400 opted
    //     rows dominate the shared DB's ~170-row population; teardown
    //     deletes exactly these, restoring the prior rate.
    for (let i = 0; i < 400; i++) {
      await db.insert(customerStats).values({
        tenantId,
        customerPhone: `+25187${String(i).padStart(7, '0')}`,
        customerName: `Gate Seed ${i}`,
        marketingOptIn: true,
        visitCount: 1,
        createdAt: Date.now(),
      }).catch(() => {}); // UNIQUE-safe on rerun collisions
    }
    seededCustomerPhones = true;
    // (2) North-star ≥ 0.7 this week: bulk confirmed bookings across a few
    //     billing-active tenants. Insert enough rows to dominate the ratio.
    const proPlan = await db.select().from(plans).where(eq(plans.name, 'pro')).get();
    for (const t of [tenantId]) {
      await db.insert(tenantSubscriptions).values({
        id: crypto.randomUUID(), tenantId: t, planId: proPlan!.id,
        status: 'active', startsAt: Date.now() - 86400_000,
      });
      const weekStart = Date.now() - 3 * 86400_000;
      for (let i = 0; i < 45; i++) {
        const id = crypto.randomUUID();
        createdAppts.push(id);
        await db.insert(appointments).values({
          id, tenantId: t,
          customerName: `Filler ${i}`, customerPhone: '+251888000000',
          staffId, serviceId: svcId,
          startTime: weekStart + i * 60_000,
          endTime: weekStart + i * 60_000 + 1800_000,
          status: 'confirmed', reminderSent: false,
          opaqueId: crypto.randomBytes(16).toString('hex'),
        }).catch(() => {});
      }
    }

    // ── MATURE THE CARD: five visits appended through the ledger ────────
    const driver = (db as any).session?.client ?? (db as any).$client;
    for (let i = 0; i < 5; i++) {
      await driver.execute({
        sql: `INSERT OR IGNORE INTO loyalty_ledger (id, tenant_id, consumer_phone, points_delta, reason, ref_type, ref_id, created_at)
              VALUES (?, ?, ?, 1, 'visit', 'appointment', ?, ?)`,
        args: [crypto.randomUUID(), tenantId, PHONE, `e2e-visit-${i}-${crypto.randomUUID()}`, Date.now()],
      });
    }
    await db.insert(punchCards).values({
      id: crypto.randomUUID(), tenantId, consumerPhone: PHONE,
      punches: 5, target: 5,
      rewardConfig: { type: 'percent', value: 10 },
      createdAt: Date.now(),
    }).onConflictDoNothing();
  });

  afterAll(async () => {
    delete process.env.LOYALTY_ENABLED;
    if (createdAppts.length) {
      const chunk = (arr: string[]) => arr.map((id) => `'${id}'`).join(',');
      await ((db as any).session?.client ?? (db as any).$client).execute(
        { sql: `DELETE FROM appointments WHERE id IN (${chunk(createdAppts)})`, args: [] });
    }
    await db.delete(appointments).where(eq(appointments.tenantId, tenantId)).catch(() => {});
    await db.delete(payments).where(eq(payments.tenantId, tenantId)).catch(() => {});
    await db.delete(punchCards).where(eq(punchCards.tenantId, tenantId)).catch(() => {});
    await db.delete(loyaltyLedger).where(eq(loyaltyLedger.tenantId, tenantId)).catch(() => {});
    await db.delete(customerStats).where(eq(customerStats.tenantId, tenantId)).catch(() => {});
    await db.delete(servicesTable).where(eq(servicesTable.id, svcId)).catch(() => {});
    await db.delete(staff).where(eq(staff.id, staffId)).catch(() => {});
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).catch(() => {});
    await db.delete(users).where(eq(users.tenantId, tenantId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
  });

  it('matured reward lowers the charge; consumption appends −target and resets', async () => {
    const start = new Date(Date.now() + 48 * 3600 * 1000);
    start.setUTCMinutes(0, 0, 0);

    const res = await request(app)
      .post('/api/public/bookings')
      .set('X-Tenant-Slug', slug)
      .send({
        staff_id: staffId,
        service_ids: [svcId],
        start_time: start.toISOString(),
        customer_name: 'Loyal Customer',
        customer_phone: PHONE,
        marketing_opt_in: true,
      });

    expect(res.status).toBe(201);

    // The charge was created at the DISCOUNTED amount: 300 ETB − 10% = 270.
    const pay = await db.select().from(payments).where(eq(payments.tenantId, tenantId)).get();
    expect(pay).toBeTruthy();
    expect(pay!.amount).toBe(27000); // ETB cents
    const meta = pay?.meta as any;
    expect(meta?.loyaltyRedemption?.discountEtbCents).toBe(3000); // 10% of 300 ETB

    // Reward consumed via append: sum back below target.
    const { getCardForConsumer } = await import('../lib/loyalty');
    const card = await getCardForConsumer(tenantId, PHONE);
    expect(card.punches).toBe(0);
    expect(card.rewardReady).toBe(false);
  });
});
