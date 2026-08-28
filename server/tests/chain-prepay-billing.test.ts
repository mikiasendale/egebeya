/**
 * CHAIN 3 (P1.5): prepay cycle → founding-rate lock.
 *
 *   POST /api/tenant/subscription/checkout { cycle: 365 } while the founding
 *   cohort is open → signed webhook → endsAt = now + 365d AND
 *   tenants.founding_rate_locked_until = now + 12 months (billing.ts).
 *
 * Failure modes: cycle=365 with a FULL cohort (25 paying tenants) → 400;
 * unsupported cycle (45) → 400 before any Chapa call.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

vi.mock('../../server/lib/chapa', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/lib/chapa')>();
  return {
    ...actual,
    createCheckout: vi.fn(async (opts: any) => ({
      checkoutUrl: 'https://checkout.chapa.co/sandbox/pay/' + opts.txRef,
      txRef: opts.txRef,
      raw: { status: 'success' },
    })),
    verifyPayment: vi.fn(async () => ({ status: 'success', amount: '10000', tx_ref: '', raw: {} })),
  };
});

import request from 'supertest';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../../src/db';
import { tenants, payments, tenantSubscriptions } from '../../src/db/schema';
import { FOUNDING_RATE_CAP, FOUNDING_RATE_LOCK_MS } from '../../server/lib/billing';
import {
  mountApp, makeOwner, deliverWebhook, deleteTenantCascade, seedProPayment,
} from './chain-helpers';
import type { App } from './chain-helpers';

const ANNUAL_CENTS = 1000000; // 1000 ETB × 10 (10-for-12)

describe('CHAIN: prepay cycle → founding lock', () => {
  let app: App;
  let tenantId: string;
  let token: string;
  const fillerTenantIds: string[] = [];

  beforeAll(async () => {
    app = await mountApp();
    const owner = await makeOwner({
      subscription: { planName: 'free', status: 'active' },
    });
    tenantId = owner.tenantId;
    token = owner.token;
  });

  afterAll(async () => {
    // Remove cohort fillers so the shared DB's founding cohort closes again.
    for (const fid of fillerTenantIds) {
      await db.delete(payments).where(eq(payments.tenantId, fid)).catch(() => {});
      await db.delete(tenants).where(eq(tenants.id, fid)).catch(() => {});
    }
    await deleteTenantCascade(tenantId);
  });

  it('happy path: annual checkout while cohort is open → 365d cycle + 12-month founding lock', async () => {
    const res = await request(app)
      .post('/api/tenant/subscription/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ cycle: 365 });
    expect(res.status).toBe(200);
    expect(res.body.cycleDays).toBe(365);
    expect(res.body.amountCents).toBe(ANNUAL_CENTS);
    expect(res.body.isFoundingRate).toBe(true); // first-time buyer inside the cap

    const hook = await deliverWebhook(app, { tx_ref: res.body.txRef, status: 'success' });
    expect(hook.status).toBe(200);

    const sub = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    const cycleDays = ((sub!.endsAt as number) - Date.now()) / (24 * 3600 * 1000);
    expect(cycleDays).toBeGreaterThan(364.9);
    expect(cycleDays).toBeLessThan(365.1);

    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    const lockMs = (tenant!.foundingRateLockedUntil ?? 0) - Date.now();
    expect(lockMs).toBeGreaterThan(FOUNDING_RATE_LOCK_MS - 60_000);
    expect(lockMs).toBeLessThan(FOUNDING_RATE_LOCK_MS + 60_000);
  });

  it('failure mode: unsupported cycle length is rejected before any provider call', async () => {
    const res = await request(app)
      .post('/api/tenant/subscription/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ cycle: 45 });
    expect(res.status).toBe(400);
    expect(String(res.body.error)).toMatch(/cycle/);
  });

  it('failure mode: annual prepay is refused once the founding cohort is full', async () => {
    // Pad the cohort to the cap with synthetic PAID tenants (countFoundingCohort
    // counts distinct tenants OTHER than this one that either hold an unexpired
    // lock or have a completed pro_subscription payment).
    let cohort = 0;
    const driver = (db as any).session?.client ?? (db as any).$client;
    const countRow = await driver.execute({
      sql: `SELECT COUNT(DISTINCT tenant_id) AS n FROM payments
             WHERE status = 'completed'
               AND json_extract(meta, '$.purpose') = 'pro_subscription'
               AND tenant_id != ?`,
      args: [tenantId],
    });
    cohort = Number((countRow.rows?.[0] as any)?.n ?? 0);
    while (cohort < FOUNDING_RATE_CAP) {
      const fid = crypto.randomUUID();
      fillerTenantIds.push(fid);
      await db.insert(tenants).values({
        id: fid,
        name: `Cap Filler ${fid.slice(0, 6)}`,
        slug: `capfill-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        settings: {},
        createdAt: Date.now(),
      });
      await db.insert(payments).values({
        id: crypto.randomUUID(),
        tenantId: fid,
        amount: 100000,
        gateway: 'chapa',
        method: 'checkout',
        gatewayReference: `TX-cap-${crypto.randomUUID().slice(0, 12)}`,
        status: 'completed',
        meta: { purpose: 'pro_subscription', product: 'pro-30d' },
      });
      cohort += 1;
    }

    const res = await request(app)
      .post('/api/tenant/subscription/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ cycle: 365 });
    expect(res.status).toBe(400);
    expect(String(res.body.error)).toMatch(/founding cohort/i);

    // Monthly checkout still works at list price past the cap.
    const monthly = await request(app)
      .post('/api/tenant/subscription/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ cycle: 30 });
    expect(monthly.status).toBe(200);
    expect(monthly.body.amountCents).toBe(100000);

    // Keep the DB clean: remove the pending payment the monthly checkout made.
    const pay = await db.select().from(payments)
      .where(eq(payments.gatewayReference, monthly.body.txRef)).get();
    if (pay) {
      await db.delete(payments).where(and(eq(payments.id, pay.id)));
    }
  });
});
