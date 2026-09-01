/**
 * T4.2 — merchant loyalty card issuance behind the council gate.
 *
 *   GET  /api/tenant/loyalty/gate-status  — honest gate read for the UI.
 *   POST /api/tenant/loyalty/cards        — upsert the consumer, then issue
 *                                           through the engine; REFUSED (no
 *                                           punch_cards row) while the gate is
 *                                           closed so we never write a card a
 *                                           dead feature cannot consume.
 *
 * The consumer-facing ring (GET /api/consumer/loyalty/:tenantId) is out of
 * scope here — this suite pins only the merchant surfaces.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq, and } from 'drizzle-orm';

import { db } from '../../src/db';
import { punchCards, consumers } from '../../src/db/schema';
import {
  mountApp, makeOwner, seedBusiness, deleteTenantCascade, openLoyaltyGate,
} from './chain-helpers';
import type { App } from './chain-helpers';

describe('T4.2 merchant loyalty card issuance', () => {
  let app: App;
  let tenantId: string;
  let token: string;
  let staffId: string;
  let serviceId: string;
  const phone = '+251955778899';

  beforeAll(async () => {
    app = await mountApp();
    const owner = await makeOwner({ category: 'Salon' });
    tenantId = owner.tenantId;
    token = owner.token;
  });

  afterAll(async () => {
    await deleteTenantCascade(tenantId);
    delete process.env.LOYALTY_ENABLED;
  });

  describe('gate closed (dark default)', () => {
    beforeAll(() => {
      delete process.env.LOYALTY_ENABLED;
    });

    it('GET /gate-status reports the gate as closed', async () => {
      const res = await request(app)
        .get('/api/tenant/loyalty/gate-status')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.gateOpen).toBe(false);
      expect(res.body.enabledFlag).toBe(false);
    });

    it('POST /cards refuses and never creates a punch_cards row (no ghost card)', async () => {
      const res = await request(app)
        .post('/api/tenant/loyalty/cards')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone });
      expect(res.status).toBe(200);
      expect(res.body.issued).toBe(false);
      expect(res.body.gateOpen).toBe(false);
      expect(res.body.card).toBeNull();

      // The consumer profile (P3.7, consent stamped) is legitimate; the CARD
      // is the ghost-data risk and must NOT exist when the gate is closed.
      const card = await db.select().from(punchCards)
        .where(and(eq(punchCards.tenantId, tenantId), eq(punchCards.consumerPhone, phone))).get();
      expect(card).toBeUndefined();
    });
  });

  describe('gate open (council seeded)', () => {
    beforeAll(async () => {
      const biz = await seedBusiness(tenantId, { durationMinutes: 30, priceCents: 25000 });
      staffId = biz.staffId;
      serviceId = biz.serviceId;
      await openLoyaltyGate({ tenantId, staffId, serviceId });
    });

    it('GET /gate-status reports the gate as open', async () => {
      const res = await request(app)
        .get('/api/tenant/loyalty/gate-status')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.gateOpen).toBe(true);
      expect(res.body.enabledFlag).toBe(true);
    });

    it('POST /cards issues a fresh empty card and stamps the consumer consent', async () => {
      const res = await request(app)
        .post('/api/tenant/loyalty/cards')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone });
      expect(res.status).toBe(201);
      expect(res.body.issued).toBe(true);
      expect(res.body.gateOpen).toBe(true);
      expect(res.body.card.punches).toBe(0);
      expect(res.body.card.target).toBe(5);

      const card = await db.select().from(punchCards)
        .where(and(eq(punchCards.tenantId, tenantId), eq(punchCards.consumerPhone, phone))).get();
      expect(card).toBeTruthy();
      expect(card!.punches).toBe(0);

      // P3.7: the consumer row only ever exists with a stamped consent moment.
      const consumer = await db.select().from(consumers).where(eq(consumers.phone, phone)).get();
      expect(consumer).toBeTruthy();
      expect(consumer!.consentGivenAt).toBeGreaterThan(0);
    });

    it('POST /cards is idempotent — re-issuing never duplicates or double-punches', async () => {
      const before = await db.select().from(punchCards)
        .where(and(eq(punchCards.tenantId, tenantId), eq(punchCards.consumerPhone, phone))).all();

      const res = await request(app)
        .post('/api/tenant/loyalty/cards')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone });
      expect(res.status).toBe(201);
      expect(res.body.issued).toBe(true);

      const after = await db.select().from(punchCards)
        .where(and(eq(punchCards.tenantId, tenantId), eq(punchCards.consumerPhone, phone))).all();
      expect(after.length).toBe(1);
      expect(after[0].punches).toBe(before[0].punches);
    });
  });

  it('missing phone is rejected with 400', async () => {
    const res = await request(app)
      .post('/api/tenant/loyalty/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('unparseable phone is a client error (400), never a 500', async () => {
    const res = await request(app)
      .post('/api/tenant/loyalty/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: 'not-a-phone' });
    expect(res.status).toBe(400);
  });

  it('unauthenticated requests are rejected with 401', async () => {
    const res = await request(app).get('/api/tenant/loyalty/gate-status');
    expect(res.status).toBe(401);
  });
});
