/**
 * CHAIN 10 (P5.1): booking completion → punch → card → reward-ready.
 *
 *   PUT /api/bookings/:id/status { status: 'completed' } (bookings.ts)
 *     → loyalty.recordPunch (server/lib/loyalty.ts)
 *       → loyalty_ledger append + punch_cards cache refresh
 *     → customer_stats visitCount/totalSpend/health-tag side effects
 *     → 5 completed visits → punches == target → consumer card reports
 *       rewardReady (council gate open, seeded with real rows).
 *
 * Failure modes: non-whitelisted status → 400; unknown appointment → 404;
 * replaying the same completion never double-punches (ledger UNIQUE).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';

import { db } from '../../src/db';
import {
  appointments, loyaltyLedger, punchCards, customerStats,
} from '../../src/db/schema';
import {
  mountApp, makeOwner, seedBusiness, deleteTenantCascade, openLoyaltyGate,
  consumerTokenFor,
} from './chain-helpers';
import type { App } from './chain-helpers';

describe('CHAIN: booking completion → punch → card → reward', () => {
  let app: App;
  let tenantId: string;
  let token: string;
  let staffId: string;
  let serviceId: string;
  const phone = '+251955667788';
  const visitIds: string[] = [];

  beforeAll(async () => {
    app = await mountApp();
    const owner = await makeOwner({ category: 'Salon' });
    tenantId = owner.tenantId;
    token = owner.token;
    const biz = await seedBusiness(tenantId, { durationMinutes: 30, priceCents: 25000 });
    staffId = biz.staffId;
    serviceId = biz.serviceId;
    await openLoyaltyGate({ tenantId, staffId, serviceId });
  });

  afterAll(async () => {
    await deleteTenantCascade(tenantId);
    delete process.env.LOYALTY_ENABLED;
  });

  async function seedVisit(index: number): Promise<string> {
    const id = crypto.randomUUID();
    visitIds.push(id);
    await db.insert(appointments).values({
      id,
      tenantId,
      staffId,
      serviceId,
      customerName: `Punch Pat ${index}`,
      customerPhone: phone,
      startTime: Date.now() - (index + 2) * 3600 * 1000,
      endTime: Date.now() - (index + 2) * 3600 * 1000 + 30 * 60 * 1000,
      status: 'confirmed',
      reminderSent: false,
      opaqueId: crypto.randomBytes(16).toString('hex'),
    });
    return id;
  }

  it('happy path: completing a visit punches the card and updates customer stats', async () => {
    const id = await seedVisit(1);

    const res = await request(app)
      .put(`/api/bookings/${id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // 1. Ledger append (append-only truth).
    const ledger = await db.select().from(loyaltyLedger)
      .where(and(
        eq(loyaltyLedger.tenantId, tenantId),
        eq(loyaltyLedger.consumerPhone, phone),
        eq(loyaltyLedger.refId, id),
      )).get();
    expect(ledger).toBeTruthy();
    expect(ledger!.pointsDelta).toBe(1);
    expect(ledger!.reason).toBe('visit');

    // 2. Card cache refreshed from the ledger.
    const card = await db.select().from(punchCards)
      .where(and(eq(punchCards.tenantId, tenantId), eq(punchCards.consumerPhone, phone))).get();
    expect(card!.punches).toBe(1);
    expect(card!.target).toBe(5);

    // 3. customer_stats visit recorded with the paid amount.
    const stats = await db.select().from(customerStats)
      .where(and(eq(customerStats.tenantId, tenantId), eq(customerStats.customerPhone, phone))).get();
    expect(stats!.visitCount).toBe(1);
  });

  it('failure mode: non-whitelisted status is rejected and nothing is written', async () => {
    const id = await seedVisit(2);
    const ledgerBefore = (await db.select().from(loyaltyLedger)
      .where(eq(loyaltyLedger.tenantId, tenantId)).all()).length;

    const res = await request(app)
      .put(`/api/bookings/${id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'hacked' });
    expect(res.status).toBe(400);

    const ledgerAfter = (await db.select().from(loyaltyLedger)
      .where(eq(loyaltyLedger.tenantId, tenantId)).all()).length;
    expect(ledgerAfter).toBe(ledgerBefore); // no punch from a rejected write
    const row = await db.select().from(appointments).where(eq(appointments.id, id)).get();
    expect(row!.status).toBe('confirmed'); // untouched
  });

  it('failure mode: unknown appointment id returns 404', async () => {
    const res = await request(app)
      .put(`/api/bookings/${crypto.randomUUID()}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' });
    expect(res.status).toBe(404);
  });

  it('5th completed visit matures the card: consumer ring reports rewardReady', async () => {
    // Complete visits 2–5 through the real endpoint (visit 1 done above).
    for (let i = 2; i <= 5; i++) {
      const id = await seedVisit(i);
      const res = await request(app)
        .put(`/api/bookings/${id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'completed' });
      expect(res.status).toBe(200);
    }

    const card = await db.select().from(punchCards)
      .where(and(eq(punchCards.tenantId, tenantId), eq(punchCards.consumerPhone, phone))).get();
    expect(card!.punches).toBe(5);

    // Consumer-facing card over HTTP (consumer JWT, audience 'consumer').
    const { upsertConsumerByPhone } = await import('../../server/lib/consumers');
    const consumerId = await upsertConsumerByPhone({ phone, basis: 'booking' });
    const loyalty = await request(app)
      .get(`/api/consumer/loyalty/${tenantId}`)
      .set('Authorization', `Bearer ${consumerTokenFor(consumerId, phone)}`);
    expect(loyalty.status).toBe(200);
    expect(loyalty.body.punches).toBe(5);
    expect(loyalty.body.matured).toBe(true);
    expect(loyalty.body.rewardReady).toBe(true); // gate open + matured
    expect(loyalty.body.gateOpen).toBe(true);
  });

  it('idempotency: replaying the completed status over HTTP never double-punches', async () => {
    const ledgerBefore = (await db.select().from(loyaltyLedger)
      .where(and(eq(loyaltyLedger.tenantId, tenantId), eq(loyaltyLedger.consumerPhone, phone))).all()).length;

    // Re-send the same transition through the endpoint: previousStatus is
    // already 'completed', so the punch branch must not run again.
    const res = await request(app)
      .put(`/api/bookings/${visitIds[0]}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' });
    expect(res.status).toBe(200);

    const ledgerAfter = (await db.select().from(loyaltyLedger)
      .where(and(eq(loyaltyLedger.tenantId, tenantId), eq(loyaltyLedger.consumerPhone, phone))).all()).length;
    expect(ledgerAfter).toBe(ledgerBefore); // exactly one punch per visit

    const card = await db.select().from(punchCards)
      .where(and(eq(punchCards.tenantId, tenantId), eq(punchCards.consumerPhone, phone))).get();
    expect(card!.punches).toBe(5); // unchanged
  });
});
