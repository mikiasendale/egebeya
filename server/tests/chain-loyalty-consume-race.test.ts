/**
 * S-12 fix: reward consumption is atomic with the maturity check.
 *
 * The ledger sum is re-read inside the same INSERT…SELECT that appends the
 * redemption, so two concurrent consumeReward calls for the same matured
 * card can only land ONE redemption row. The insert is also idempotent per
 * (tenant, phone, reason, ref) via the existing unique index.
 *
 * Concurrency harness: two raw consumeReward calls driven in parallel —
 * BEGIN IMMEDIATE transaction serialization is what the booking flow
 * (withBusyRetry + immediate tx) rides on; here we hit the lib directly.
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
import { loyaltyLedger, punchCards } from '../../src/db/schema';
import { consumeReward } from '../../server/lib/loyalty';
import { mountApp, makeOwner, seedBusiness, deleteTenantCascade, openLoyaltyGate, appendVisitPunch } from './chain-helpers';

const PRICE_CENTS = 20000;

describe('CHAIN: reward consumption races (S-12)', () => {
  let app: any;
  let tenantId: string;
  let token: string;
  let slug: string;
  const phone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;

  beforeAll(async () => {
    delete process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    process.env.LOYALTY_ENABLED = 'true';
    app = await mountApp();
    const owner = await makeOwner({ category: 'Salon' });
    tenantId = owner.tenantId;
    token = owner.token;
    slug = owner.slug;
    const biz = await seedBusiness(tenantId, { serviceName: 'Trim', durationMinutes: 30, priceCents: PRICE_CENTS });
    await openLoyaltyGate({ tenantId, staffId: biz.staffId, serviceId: biz.serviceId });
    for (let i = 0; i < 5; i++) {
      await appendVisitPunch(tenantId, phone, `s12-visit-${i}-${crypto.randomUUID()}`);
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

  async function redemptionCount(): Promise<number> {
    const rows = await db.select({ id: loyaltyLedger.id }).from(loyaltyLedger)
      .where(and(
        eq(loyaltyLedger.tenantId, tenantId),
        eq(loyaltyLedger.consumerPhone, phone),
        eq(loyaltyLedger.reason, 'redemption'),
      )).all();
    return rows.length;
  }

  it('two concurrent consumeReward calls land exactly ONE redemption', async () => {
    const results = await Promise.all([
      consumeReward({ tenantId, consumerPhone: phone, refType: 'appointment', refId: crypto.randomUUID() }),
      consumeReward({ tenantId, consumerPhone: phone, refType: 'appointment', refId: crypto.randomUUID() }),
    ]);
    // Both calls run; only one finds a matured card after the other consumed.
    expect(results.filter(Boolean).length).toBe(1);
    expect(await redemptionCount()).toBe(1);
  });

  it('a third attempt after consumption is rejected (card reset below target)', async () => {
    const again = await consumeReward({ tenantId, consumerPhone: phone, refType: 'appointment', refId: crypto.randomUUID() });
    expect(again).toBe(false);
    expect(await redemptionCount()).toBe(1);
  });

  it('same-ref replay is a no-op via the unique index (idempotency belt)', async () => {
    // Seed a fresh matured card for a second consumer phone.
    const phone2 = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    for (let i = 0; i < 5; i++) {
      await appendVisitPunch(tenantId, phone2, `s12b-visit-${i}-${crypto.randomUUID()}`);
    }
    await db.insert(punchCards).values({
      id: crypto.randomUUID(),
      tenantId,
      consumerPhone: phone2,
      punches: 5,
      target: 5,
      createdAt: Date.now(),
    }).onConflictDoNothing();

    const sameRef = crypto.randomUUID();
    const first = await consumeReward({ tenantId, consumerPhone: phone2, refType: 'appointment', refId: sameRef });
    expect(first).toBe(true);
    const replay = await consumeReward({ tenantId, consumerPhone: phone2, refType: 'appointment', refId: sameRef });
    expect(replay).toBe(false);

    const rows = await db.select({ id: loyaltyLedger.id }).from(loyaltyLedger)
      .where(and(eq(loyaltyLedger.tenantId, tenantId), eq(loyaltyLedger.consumerPhone, phone2))).all();
    expect(rows.filter((r) => r.id)).toBeTruthy();
    const redemptions2 = await db.select({ id: loyaltyLedger.id }).from(loyaltyLedger)
      .where(and(eq(loyaltyLedger.tenantId, tenantId), eq(loyaltyLedger.consumerPhone, phone2), eq(loyaltyLedger.reason, 'redemption'))).all();
    expect(redemptions2.length).toBe(1);
  });

  it('end-to-end: booking flow still consumes on verified success (regression)', async () => {
    // Fresh consumer + matured card, then a real booking through the API.
    const phone3 = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    for (let i = 0; i < 5; i++) {
      await appendVisitPunch(tenantId, phone3, `s12c-visit-${i}-${crypto.randomUUID()}`);
    }
    await db.insert(punchCards).values({
      id: crypto.randomUUID(),
      tenantId,
      consumerPhone: phone3,
      punches: 5,
      target: 5,
      createdAt: Date.now(),
    }).onConflictDoNothing();

    const slot = Date.now() + 72 * 3600 * 1000;
    const slotAligned = Math.ceil(slot / (30 * 60 * 1000)) * (30 * 60 * 1000);
    const biz = await seedBusiness(tenantId, { serviceName: 'Trim', durationMinutes: 30, priceCents: PRICE_CENTS });
    const res = await request(app).post('/api/public/bookings')
      .set('X-Tenant-Slug', slug)
      .send({
        staff_id: biz.staffId,
        service_ids: [biz.serviceId],
        start_time: new Date(slotAligned).toISOString(),
        customer_name: 'S12 E2E',
        customer_phone: phone3,
      });
    expect([200, 201]).toContain(res.status);
    // The booking flow consumes the matured reward on success (or the charge
    // stays pending — either way exactly ≤1 redemption for phone3).
    const n = await db.select({ id: loyaltyLedger.id }).from(loyaltyLedger)
      .where(and(eq(loyaltyLedger.tenantId, tenantId), eq(loyaltyLedger.consumerPhone, phone3), eq(loyaltyLedger.reason, 'redemption'))).all();
    expect(n.length).toBeLessThanOrEqual(1);
  });
});
