/**
 * Subscription-billing helpers shared by the checkout route, the Chapa
 * webhook handler, and the downgrade cron.
 *
 * Prices / windows are centralised here so the checkout route, the frontend
 * upgrade button, and the grace-period gate can never drift apart.
 */
import { db } from '../../src/db';
import { tenantSubscriptions, plans, tenants, payments } from '../../src/db/schema';
import { eq, and, gt, sql } from 'drizzle-orm';
import crypto from 'crypto';

/** Pro plan price in whole ETB, charged per 30-day cycle. */
export const PRO_PLAN_PRICE_BIRR = '1000';

/**
 * Founding-rate pricing ladder (ROADMAP §0). Per operator decision (Aug 2026)
 * the founding rate currently equals the list price — every Pro charge is
 * 1000 ETB. The cohort machinery below still tracks who is a founding member
 * (locked 12 months, first FOUNDING_RATE_CAP paying tenants) so the ladder
 * can diverge later by changing this one constant.
 */
export const FOUNDING_RATE_PRICE_BIRR = PRO_PLAN_PRICE_BIRR;
export const FOUNDING_RATE_PRICE_CENTS = Number(FOUNDING_RATE_PRICE_BIRR) * 100;

/** Number of paying tenants that can hold the founding rate. */
export const FOUNDING_RATE_CAP = 25;

/** How long a granted founding lock lasts (12 months). */
export const FOUNDING_RATE_LOCK_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * P1.5 prepay cycles. 90 days = 5% off; 365 days is the founding-cohort
 * "10-for-12" offer (pay 10 months, get 12) allowed only while the founding
 * cohort is open — paying it locks the founding rate. Proration is
 * deliberately NOT implemented: every paid cycle runs its full length from
 * the activation moment.
 */
export const SUPPORTED_CYCLE_DAYS = [30, 90, 365] as const;
export type CycleDays = (typeof SUPPORTED_CYCLE_DAYS)[number];

/** Quarterly prepay discount. */
export const QUARTERLY_DISCOUNT = 0.05;

/**
 * Price for a cycle given the per-30-day base price in cents.
 *   30 → base · 90 → base*3*0.95 · 365 → base*10 (10-for-12).
 */
export function priceForCycle(baseCents: number, cycleDays: CycleDays): number {
  switch (cycleDays) {
    case 90:
      return Math.round(baseCents * 3 * (1 - QUARTERLY_DISCOUNT));
    case 365:
      return baseCents * 10;
    case 30:
    default:
      return baseCents;
  }
}

/** Length of one paid Pro cycle in milliseconds (30 days). */
export const PRO_CYCLE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Grace period after `endsAt` lapses during which Pro access is still
 * granted but the frontend is told to show a "Renew" banner. Past this,
 * requireProPlan denies access.
 */
export const GRACE_PERIOD_MS = 5 * 24 * 60 * 60 * 1000;

/** Window after which the downgrade cron reverts a lapsed Pro tenant to Free. */
export const DOWNGRADE_AFTER_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A Drizzle executor: either the root `db` handle or a transaction-scoped `tx`.
 * Lets the webhook handler run activation inside its transaction.
 */
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Activate (or create) the Pro subscription row for a tenant after a
 * successful Chapa checkout webhook. Sets `status = 'active'` with a fresh
 * cycle from `now` (P1.5: cycle length comes from the paid payment's meta —
 * 30/90/365 days). Pass a transaction as `exec` to join the caller's atomic
 * write (P1.2); defaults to the standalone db handle.
 */
export async function activateProSubscription(
  tenantId: string,
  planId: string | null | undefined,
  now: number = Date.now(),
  exec?: Executor,
  cycleDays: CycleDays = 30,
): Promise<void> {
  const d = (exec ?? db) as typeof db;
  const proPlan = planId
    ? await d.select().from(plans).where(eq(plans.id, planId)).get()
    : null;
  const resolvedPlanId = proPlan
    ? proPlan.id
    : (await d.select().from(plans).where(eq(plans.name, 'pro')).get())?.id;

  const existing = await d.select().from(tenantSubscriptions)
    .where(eq(tenantSubscriptions.tenantId, tenantId)).get();

  const values = {
    planId: resolvedPlanId ?? null,
    status: 'active',
    trialEndsAt: null,
    startsAt: now,
    endsAt: now + cycleDays * 24 * 60 * 60 * 1000,
  };

  if (existing) {
    await d.update(tenantSubscriptions)
      .set(values)
      .where(eq(tenantSubscriptions.tenantId, tenantId));
  } else {
    await d.insert(tenantSubscriptions).values({
      id: crypto.randomUUID(),
      tenantId,
      ...values,
    });
  }
}

/**
 * Size of the founding cohort: distinct tenants that either hold an unexpired
 * founding lock or have completed a Pro-subscription payment. The two counts
 * are combined with max() because locked tenants also appear in the paid set —
 * max() approximates the union without a join. Pass `excludeTenantId` to
 * measure only the OTHER occupants of the cohort (cap checks must not count
 * the tenant being resolved, or seat #25 would be denied).
 */
export async function countFoundingCohort(
  now: number = Date.now(),
  excludeTenantId?: string,
): Promise<number> {
  const locked = await db.select({ count: sql<number>`COUNT(*)` })
    .from(tenants)
    .where(and(
      sql`${tenants.foundingRateLockedUntil} IS NOT NULL`,
      gt(tenants.foundingRateLockedUntil, now),
      excludeTenantId ? sql`${tenants.id} != ${excludeTenantId}` : undefined,
    ))
    .get();
  const paid = await db.select({ count: sql<number>`COUNT(DISTINCT ${payments.tenantId})` })
    .from(payments)
    .where(and(
      eq(payments.status, 'completed'),
      sql`json_extract(${payments.meta}, '$.purpose') = 'pro_subscription'`,
      excludeTenantId ? sql`${payments.tenantId} != ${excludeTenantId}` : undefined,
    ))
    .get();
  return Math.max(locked?.count ?? 0, paid?.count ?? 0);
}

export interface PriceResolution {
  /** Whole ETB amount to charge. */
  amountEtb: string;
  /** Same amount in ETB cents (what payments.amount / invoices.amount store). */
  amountCents: number;
  /** True when this tenant holds (or qualifies for) the founding rate lock. */
  isFoundingRate: boolean;
}

/**
 * Resolve the Pro price for a tenant (P1.1 pricing ladder).
 *
 * Order of precedence:
 *   1. An unexpired `founding_rate_locked_until` on the tenant always wins and
 *      survives any edits to the plans row.
 *   2. Tenants with a completed Pro-subscription payment inside the first
 *      FOUNDING_RATE_CAP paying tenants get the founding lock granted here
 *      (12 months from now).
 *   3. Everyone else resolves to list price.
 *
 * Granting the lock is a write-on-read side effect; it only happens for
 * already-paying tenants while seats remain, so browsing checkout can never
 * consume a slot before money moves.
 */
export async function resolvePriceForTenant(tenantId: string): Promise<PriceResolution> {
  const list: PriceResolution = {
    amountEtb: PRO_PLAN_PRICE_BIRR,
    amountCents: Number(PRO_PLAN_PRICE_BIRR) * 100,
    isFoundingRate: false,
  };
  const founding: PriceResolution = {
    amountEtb: FOUNDING_RATE_PRICE_BIRR,
    amountCents: FOUNDING_RATE_PRICE_CENTS,
    isFoundingRate: true,
  };

  try {
    const now = Date.now();
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) return list;

    // 1. Existing lock wins regardless of plans-row state.
    if (typeof tenant.foundingRateLockedUntil === 'number' && tenant.foundingRateLockedUntil > now) {
      return founding;
    }

    // 2. Only tenants who have actually paid hold a seat. Count the OTHER
    //    occupants — the tenant being resolved must not consume its own seat.
    const hasPaid = await db.select({ id: payments.id })
      .from(payments)
      .where(and(
        eq(payments.tenantId, tenantId),
        eq(payments.status, 'completed'),
        sql`json_extract(${payments.meta}, '$.purpose') = 'pro_subscription'`,
      ))
      .get();

    const othersInCohort = await countFoundingCohort(now, tenantId);
    if (othersInCohort >= FOUNDING_RATE_CAP) return list;

    if (hasPaid) {
      // Grant/refresh the 12-month lock.
      await db.update(tenants)
        .set({ foundingRateLockedUntil: now + FOUNDING_RATE_LOCK_MS })
        .where(eq(tenants.id, tenantId));
      return founding;
    }

    // 3. Not yet paying: within the cap the founding rate is what they'd be
    //    locked into at first payment; past it, list price.
    return othersInCohort < FOUNDING_RATE_CAP ? founding : list;
  } catch (err) {
    console.error('resolvePriceForTenant failed, falling back to list price:', err);
    return list;
  }
}

/**
 * Derive the billing state for a subscription row the way the Pro gate sees
 * it. Exposed so GET /api/tenant/subscription and the frontend share one
 * definition of 'active' / 'grace' / 'expired'.
 */
export function billingStateFor(subscription: {
  status: string;
  endsAt: number | null;
  planName?: string | null;
  now?: number;
}): 'trial' | 'active' | 'grace' | 'expired' {
  const now = subscription.now ?? Date.now();
  if (subscription.status === 'trial') return 'trial';
  if (subscription.status !== 'active') return 'expired';
  if (subscription.planName && subscription.planName !== 'pro') return 'active';
  if (typeof subscription.endsAt !== 'number') return 'active';
  if (subscription.endsAt > now) return 'active';
  if (subscription.endsAt + GRACE_PERIOD_MS > now) return 'grace';
  return 'expired';
}
