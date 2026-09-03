/**
 * T4.6 — stuck-tenants admin panel + T4.8 — price-seen winback leads.
 *
 * Both are pure segmentation reads plus one deliberate superadmin action
 * (the offer POST). The beacons they read are side-effect-free; this suite
 * pins the queries and the idempotency of the offer flow.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';

import { db } from '../../src/db';
import { tenants, users, tenantSubscriptions, activationEvents, promoCodes } from '../../src/db/schema';
import {
  mountApp, makeSuperadmin, makeOwner, deleteTenantCascade,
} from './chain-helpers';
import type { App } from './chain-helpers';

// The offer POST dispatches through the notify adapter; stub only notify so
// the test is deterministic and no SMS provider is touched.
vi.mock('../../server/lib/notifications', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/lib/notifications')>();
  return {
    ...actual,
    notify: vi.fn(async () => ({ ok: true })),
  };
});

const DAY = 24 * 60 * 60 * 1000;

describe('T4.6 stuck tenants + T4.8 winback leads (admin)', () => {
  let app: App;
  let superToken: string;
  let superuserId: string;
  let proPlanId = '';
  const createdTenants: string[] = [];

  async function insertTenant(opts: {
    name: string;
    createdAt: number;
    trialEndsAt?: number | null;
  }): Promise<string> {
    const id = crypto.randomUUID();
    await db.insert(tenants).values({
      id,
      name: opts.name,
      slug: `t4-${id.slice(0, 8)}`,
      category: 'Salon',
      isListed: true,
      isDemo: false,
      createdAt: opts.createdAt,
    });
    createdTenants.push(id);
    if (opts.trialEndsAt != null) {
      await db.insert(tenantSubscriptions).values({
        id: crypto.randomUUID(),
        tenantId: id,
        planId: proPlanId,
        status: 'trial',
        trialEndsAt: opts.trialEndsAt,
        startsAt: opts.createdAt,
      }).catch(() => {});
    }
    return id;
  }

  beforeAll(async () => {
    app = await mountApp();
    const superadmin = await makeSuperadmin();
    superToken = superadmin.token;
    superuserId = superadmin.userId;
    const { getOrCreateProPlan } = await import('../../server/lib/plans');
    proPlanId = (await getOrCreateProPlan()).id;
  });

  afterAll(async () => {
    for (const id of createdTenants) await deleteTenantCascade(id).catch(() => {});
    await db.delete(activationEvents).where(and(
      eq(activationEvents.tenantId, createdTenants[0] ?? ''),
      eq(activationEvents.event, 'winback_offer_sent'),
    )).catch(() => {});
    await db.delete(promoCodes).where(eq(promoCodes.tenantId, createdTenants[0] ?? '')).catch(() => {});
    await db.delete(users).where(eq(users.id, superuserId)).catch(() => {});
  });

  describe('T4.6 stuck tenants', () => {
    let stuckSoonId = '';
    let stuckUrgentId = '';
    let hoursConfirmedId = '';
    let freshId = '';

    beforeAll(async () => {
      const now = Date.now();
      // Stuck >48h with 5 trial days left.
      stuckSoonId = await insertTenant({ name: 'Stuck Soon', createdAt: now - 3 * DAY, trialEndsAt: now + 5 * DAY });
      // Stuck >48h with 2 trial days left — must sort FIRST.
      stuckUrgentId = await insertTenant({ name: 'Stuck Urgent', createdAt: now - 4 * DAY, trialEndsAt: now + 2 * DAY });
      // Confirmed hours — NOT stuck.
      hoursConfirmedId = await insertTenant({ name: 'Finished', createdAt: now - 3 * DAY, trialEndsAt: now + 20 * DAY });
      await db.insert(activationEvents).values({
        id: crypto.randomUUID(),
        tenantId: hoursConfirmedId,
        event: 'hours_confirmed',
        createdAt: now - 2 * DAY,
      });
      // Registered <48h ago — too fresh to triage.
      freshId = await insertTenant({ name: 'Fresh', createdAt: now - 10 * 3600 * 1000, trialEndsAt: now + 13 * DAY });
    });

    it('lists stuck tenants only, sorted by trial days left ascending', async () => {
      const res = await request(app)
        .get('/api/admin/stuck-tenants')
        .set('Authorization', `Bearer ${superToken}`);
      expect(res.status).toBe(200);

      const ids = res.body.map((r: any) => r.id);
      expect(ids).toContain(stuckSoonId);
      expect(ids).toContain(stuckUrgentId);
      expect(ids).not.toContain(hoursConfirmedId);
      expect(ids).not.toContain(freshId);

      // Urgent (2d) sorts before soon (5d).
      const urgentIdx = ids.indexOf(stuckUrgentId);
      const soonIdx = ids.indexOf(stuckSoonId);
      expect(urgentIdx).toBeLessThan(soonIdx);

      const urgent = res.body.find((r: any) => r.id === stuckUrgentId);
      expect(urgent.trialDaysLeft).toBe(2);
      expect(urgent.lastStep).toBeNull();
    });

    it('requires superadmin auth', async () => {
      const res = await request(app).get('/api/admin/stuck-tenants');
      expect(res.status).toBe(401);
    });
  });

  describe('T4.8 winback leads + offer', () => {
    let leadId = '';
    let checkoutedId = '';
    let ownerCtx: Awaited<ReturnType<typeof makeOwner>> | null = null;

    beforeAll(async () => {
      const now = Date.now();
      // A warm lead: saw pricing, never started checkout.
      ownerCtx = await makeOwner({ name: 'Lead Owner' });
      leadId = ownerCtx.tenantId;
      createdTenants.push(leadId);
      await db.insert(activationEvents).values({
        id: crypto.randomUUID(), tenantId: leadId, event: 'price_seen',
        meta: { amountEtb: 1000 }, createdAt: now - 2 * DAY,
      });
      // Saw pricing AND reached checkout — not a lead.
      checkoutedId = await insertTenant({ name: 'Converted', createdAt: now - 5 * DAY });
      await db.insert(activationEvents).values([
        { id: crypto.randomUUID(), tenantId: checkoutedId, event: 'price_seen', createdAt: now - 2 * DAY },
        { id: crypto.randomUUID(), tenantId: checkoutedId, event: 'checkout_started', createdAt: now - DAY },
      ]);
    });

    it('segments price-seen-without-checkout only', async () => {
      const res = await request(app)
        .get('/api/admin/winback-leads')
        .set('Authorization', `Bearer ${superToken}`);
      expect(res.status).toBe(200);
      const ids = res.body.map((r: any) => r.id);
      expect(ids).toContain(leadId);
      expect(ids).not.toContain(checkoutedId);
      const lead = res.body.find((r: any) => r.id === leadId);
      expect(lead.daysSincePriceSeen).toBe(2);
      expect(lead.ownerPhoneMasked).toMatch(/\*\*\*\*/);
    });

    it('offer creates a founder promo and is idempotent', async () => {
      const res = await request(app)
        .post(`/api/admin/winback-leads/${leadId}/offer`)
        .set('Authorization', `Bearer ${superToken}`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.code).toMatch(/^FOUNDER15-/);

      const promo = await db.select().from(promoCodes)
        .where(and(eq(promoCodes.tenantId, leadId), eq(promoCodes.code, res.body.code)))
        .get();
      expect(promo).toBeTruthy();
      expect(promo!.discountValue).toBe(15);

      const beacon = await db.select().from(activationEvents)
        .where(and(eq(activationEvents.tenantId, leadId), eq(activationEvents.event, 'winback_offer_sent')))
        .all();
      expect(beacon.length).toBe(1);

      // Second offer is refused — no duplicate codes.
      const again = await request(app)
        .post(`/api/admin/winback-leads/${leadId}/offer`)
        .set('Authorization', `Bearer ${superToken}`);
      expect(again.status).toBe(409);
    });

    it('refuses offers for tenants that reached checkout', async () => {
      const res = await request(app)
        .post(`/api/admin/winback-leads/${checkoutedId}/offer`)
        .set('Authorization', `Bearer ${superToken}`);
      expect(res.status).toBe(409);
    });
  });
});
