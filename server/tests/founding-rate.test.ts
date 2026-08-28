/**
 * P1.1 — founding-rate pricing ladder.
 *
 * Pro price is unified at 1000 ETB (100000 cents) per operator decision, so
 * founding and list resolve to the same amount; these tests lock the COHORT
 * machinery: the first FOUNDING_RATE_CAP paying tenants hold the
 * `founding_rate_locked_until` lock, tenants #26+ do not, and a granted lock
 * survives edits to the plans row.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { eq, inArray } from 'drizzle-orm';

import { db } from '../../src/db';
import { tenants, payments, plans } from '../../src/db/schema';
import {
  resolvePriceForTenant,
  countFoundingCohort,
  FOUNDING_RATE_CAP,
  FOUNDING_RATE_PRICE_CENTS,
  PRO_PLAN_PRICE_BIRR,
  FOUNDING_RATE_LOCK_MS,
} from '../../server/lib/billing';

function paidProPaymentMeta() {
  return { purpose: 'pro_subscription', planId: null, product: 'pro-monthly' };
}

async function makeTenant(name: string): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(tenants).values({
    id,
    name,
    slug: `founding-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    settings: {},
    createdAt: Date.now(),
  });
  return id;
}

async function makePaidProSubscription(tenantId: string) {
  await db.insert(payments).values({
    id: crypto.randomUUID(),
    tenantId,
    amount: Number(PRO_PLAN_PRICE_BIRR) * 100,
    gateway: 'chapa',
    method: 'checkout',
    gatewayReference: `TX-founding-${crypto.randomUUID().slice(0, 12)}`,
    status: 'completed',
    meta: paidProPaymentMeta(),
  });
}

describe('founding-rate pricing ladder (P1.1)', () => {
  const syntheticTenantIds: string[] = [];
  const paymentIdsToDelete: string[] = [];
  let lockedTenantId: string | null = null;
  const proPlanPriceBefore = { price: 0 };

  beforeAll(async () => {
    // Pad the shared test DB with synthetic PAID tenants until exactly
    // (FOUNDING_RATE_CAP - 1) occupants precede our boundary tests. This is
    // robust against leftovers from other suites sharing sqlite.db.
    let cohort = await countFoundingCohort();
    while (cohort < FOUNDING_RATE_CAP - 1) {
      const id = await makeTenant(`Founding Filler ${cohort}`);
      syntheticTenantIds.push(id);
      const paymentId = crypto.randomUUID();
      paymentIdsToDelete.push(paymentId);
      await db.insert(payments).values({
        id: paymentId,
        tenantId: id,
        amount: Number(PRO_PLAN_PRICE_BIRR) * 100,
        gateway: 'chapa',
        method: 'checkout',
        gatewayReference: `TX-founding-${paymentId.slice(0, 8)}`,
        status: 'completed',
        meta: paidProPaymentMeta(),
      });
      cohort = await countFoundingCohort();
    }

    const proPlan = await db.select().from(plans).where(eq(plans.name, 'pro')).get();
    if (proPlan) proPlanPriceBefore.price = proPlan.price;
  });

  afterAll(async () => {
    // Restore the plans row first (lock-survival test mutates it).
    await db.update(plans)
      .set({ price: proPlanPriceBefore.price })
      .where(eq(plans.name, 'pro'))
      .catch(() => {});

    for (const id of syntheticTenantIds) {
      await db.delete(payments).where(eq(payments.tenantId, id)).catch(() => {});
      await db.delete(tenants).where(eq(tenants.id, id)).catch(() => {});
    }
    if (paymentIdsToDelete.length > 0) {
      await db.delete(payments).where(inArray(payments.id, paymentIdsToDelete)).catch(() => {});
    }
  });

  it('a paying tenant inside the cap resolves to the founding rate and gets locked', async () => {
    // With CAP-1 others present, this tenant is exactly #CAP — the last seat.
    const tenantA = await makeTenant('Founding Tenant A');
    syntheticTenantIds.push(tenantA);
    await makePaidProSubscription(tenantA);

    const resolved = await resolvePriceForTenant(tenantA);
    expect(resolved.isFoundingRate).toBe(true);
    expect(resolved.amountEtb).toBe(PRO_PLAN_PRICE_BIRR);
    expect(resolved.amountCents).toBe(FOUNDING_RATE_PRICE_CENTS);

    // The lock was granted for ~12 months.
    const row = await db.select().from(tenants).where(eq(tenants.id, tenantA)).get();
    const lockUntil = row?.foundingRateLockedUntil ?? 0;
    expect(lockUntil).toBeGreaterThan(Date.now());
    const delta = lockUntil - Date.now();
    expect(delta).toBeGreaterThan(FOUNDING_RATE_LOCK_MS - 60 * 1000);
    expect(delta).toBeLessThan(FOUNDING_RATE_LOCK_MS + 60 * 1000);

    lockedTenantId = tenantA;
  });

  it('tenants beyond the cap (#26+) resolve to list price and get NO lock', async () => {
    // One more paid tenant fills the cohort to CAP; the next one misses out.
    const filler = await makeTenant('Founding Cap Filler');
    syntheticTenantIds.push(filler);
    await makePaidProSubscription(filler);

    const tenantB = await makeTenant('Founding Tenant B (missed)');
    syntheticTenantIds.push(tenantB);
    await makePaidProSubscription(tenantB);

    const resolved = await resolvePriceForTenant(tenantB);
    expect(resolved.isFoundingRate).toBe(false);
    expect(resolved.amountEtb).toBe(PRO_PLAN_PRICE_BIRR);
    expect(resolved.amountCents).toBe(Number(PRO_PLAN_PRICE_BIRR) * 100);

    const row = await db.select().from(tenants).where(eq(tenants.id, tenantB)).get();
    expect(row?.foundingRateLockedUntil ?? null).toBeNull();
  });

  it('a granted founding lock survives plan-row price edits', async () => {
    expect(lockedTenantId).toBeTruthy();
    const before = await resolvePriceForTenant(lockedTenantId!);
    expect(before.isFoundingRate).toBe(true);

    // Edit the canonical plans row to an absurd price.
    await db.update(plans).set({ price: 999_999_999 }).where(eq(plans.name, 'pro'));

    const after = await resolvePriceForTenant(lockedTenantId!);
    expect(after.isFoundingRate).toBe(true);
    expect(after.amountCents).toBe(FOUNDING_RATE_PRICE_CENTS);
    expect(after.amountCents).not.toBe(999_999_999);
  });
});
