/**
 * CHAIN 11 (P5.1): reward redemption → discounted Chapa charge.
 *
 *   matured punch card (5 punches) + council gate open
 *     → POST /api/public/bookings on a require_payment_upfront tenant
 *       (public.ts → loyalty.pendingRewardDiscount BEFORE Chapa initialize)
 *       → payments.amount = original − 10% and meta.loyaltyRedemption recorded
 *       → verified success → loyalty.consumeReward appends −target so the
 *         next cycle starts fresh.
 *
 * Failure mode: with the gate closed (LOYALTY_ENABLED unset) the SAME
 * booking charges FULL price — a dark program never moves money.
 *
 * The Chapa SDK is stubbed via vi.mock (external provider, sandbox network);
 * everything from the HTTP handler to the DB rows is real.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

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

import request from 'supertest';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';

import { db } from '../../src/db';
import {
  tenants, payments, punchCards, loyaltyLedger, appointments,
} from '../../src/db/schema';
import {
  mountApp, makeOwner, seedBusiness, deleteTenantCascade, openLoyaltyGate,
  appendVisitPunch,
} from './chain-helpers';
import type { App } from './chain-helpers';

const PRICE_CENTS = 30000;

describe('CHAIN: reward redemption → discounted Chapa charge', () => {
  let app: App;
  let tenantId: string;
  let token: string;
  let staffId: string;
  let serviceId: string;
  let slug: string;
  const phone = '+251966778899';
  const bonusPhone = '+251966778800'; // gate-closed control tenant's customer

  beforeAll(async () => {
    app = await mountApp();
    const owner = await makeOwner({
      category: 'Salon',
      settings: { require_payment_upfront: true },
    });
    tenantId = owner.tenantId;
    token = owner.token;
    slug = owner.slug;
    const biz = await seedBusiness(tenantId, {
      serviceName: 'Braid Set', durationMinutes: 60, priceCents: PRICE_CENTS,
    });
    staffId = biz.staffId;
    serviceId = biz.serviceId;

    // Open the council gate with real rows, then mature the card.
    await openLoyaltyGate({ tenantId, staffId, serviceId });
    for (let i = 0; i < 5; i++) {
      await appendVisitPunch(tenantId, phone, `chain11-visit-${i}-${crypto.randomUUID()}`);
    }
    await db.insert(punchCards).values({
      id: crypto.randomUUID(),
      tenantId,
      consumerPhone: phone,
      punches: 5,
      target: 5,
      rewardConfig: { type: 'percent', value: 10 },
      createdAt: Date.now(),
    }).onConflictDoNothing();
  });

  afterAll(async () => {
    await deleteTenantCascade(tenantId);
    delete process.env.LOYALTY_ENABLED;
  });

  it('happy path: matured reward lowers the charge and is consumed on success', async () => {
    const slot = Date.now() + 48 * 3600 * 1000;
    const slotAligned = Math.ceil(slot / (30 * 60 * 1000)) * (30 * 60 * 1000);

    const res = await request(app)
      .post('/api/public/bookings')
      .set('X-Tenant-Slug', slug)
      .send({
        staff_id: staffId,
        service_ids: [serviceId],
        start_time: new Date(slotAligned).toISOString(),
        customer_name: 'Redeem Rediet',
        customer_phone: phone,
      });
    expect(res.status).toBe(201);
    expect(res.body.appointment.status).toBe('confirmed'); // verified → confirmed
    expect(res.body.appointment.paymentStatus).toBe('completed');

    // 1. Money record: 10% merchant-funded discount BEFORE initialize.
    const appt = await db.select().from(appointments)
      .where(eq(appointments.opaqueId, res.body.appointment.id)).get();
    const payment = await db.select().from(payments)
      .where(eq(payments.appointmentId, appt!.id)).get();
    expect(payment).toBeTruthy();
    expect(payment!.amount).toBe(PRICE_CENTS - Math.floor(PRICE_CENTS * 10 / 100)); // 27000
    const meta: any = payment!.meta;
    expect(meta?.loyaltyRedemption?.discountEtbCents).toBe(Math.floor(PRICE_CENTS * 10 / 100));

    // 2. Reward consumed: −target append, card resets to 0.
    const redemption = await db.select().from(loyaltyLedger)
      .where(and(
        eq(loyaltyLedger.tenantId, tenantId),
        eq(loyaltyLedger.consumerPhone, phone),
        eq(loyaltyLedger.reason, 'redemption'),
      )).get();
    expect(redemption).toBeTruthy();
    expect(redemption!.pointsDelta).toBe(-5);

    const card = await db.select().from(punchCards)
      .where(and(eq(punchCards.tenantId, tenantId), eq(punchCards.consumerPhone, phone))).get();
    expect(card!.punches).toBe(0); // next cycle starts fresh
  });

  it('failure mode: gate closed → no discount, full-price charge, no consumption', async () => {
    // A second tenant whose card is matured but whose program is DARK.
    const owner2 = await makeOwner({
      category: 'Salon',
      settings: { require_payment_upfront: true },
    });
    const biz2 = await seedBusiness(owner2.tenantId, {
      serviceName: 'Full Price Cut', durationMinutes: 30, priceCents: PRICE_CENTS,
    });
    await db.insert(punchCards).values({
      id: crypto.randomUUID(),
      tenantId: owner2.tenantId,
      consumerPhone: bonusPhone,
      punches: 5,
      target: 5,
      rewardConfig: { type: 'percent', value: 25 },
      createdAt: Date.now(),
    }).onConflictDoNothing();

    try {
      delete process.env.LOYALTY_ENABLED; // the env flag alone closes the gate

      const slot = Math.ceil((Date.now() + 72 * 3600 * 1000) / (30 * 60 * 1000)) * (30 * 60 * 1000);
      const res = await request(app)
        .post('/api/public/bookings')
        .set('X-Tenant-Slug', owner2.slug)
        .send({
          staff_id: biz2.staffId,
          service_ids: [biz2.serviceId],
          start_time: new Date(slot).toISOString(),
          customer_name: 'Full Price Fira',
          customer_phone: bonusPhone,
        });
      expect(res.status).toBe(201);

      const appt2 = await db.select().from(appointments)
        .where(eq(appointments.opaqueId, res.body.appointment.id)).get();
      const payment = await db.select().from(payments)
        .where(eq(payments.appointmentId, appt2!.id)).get();
      expect(payment).toBeTruthy();
      expect(payment!.amount).toBe(PRICE_CENTS); // FULL price — gate refused
      expect((payment!.meta as any)?.loyaltyRedemption ?? null).toBeNull();

      const redemption = await db.select().from(loyaltyLedger)
        .where(and(
          eq(loyaltyLedger.tenantId, owner2.tenantId),
          eq(loyaltyLedger.reason, 'redemption'),
        )).get();
      expect(redemption ?? null).toBeNull();
    } finally {
      await deleteTenantCascade(owner2.tenantId);
    }
  });
});
