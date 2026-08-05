/**
 * Subscription-billing helpers shared by the checkout route, the Chapa
 * webhook handler, and the downgrade cron.
 *
 * Prices / windows are centralised here so the checkout route, the frontend
 * upgrade button, and the grace-period gate can never drift apart.
 */
import { db } from '../../src/db';
import { tenantSubscriptions, plans } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

/** Pro plan price in whole ETB, charged per 30-day cycle. */
export const PRO_PLAN_PRICE_BIRR = '500';

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
 * Activate (or create) the Pro subscription row for a tenant after a
 * successful Chapa checkout webhook. Sets `status = 'active'` with a fresh
 * 30-day cycle from `now`.
 */
export async function activateProSubscription(
  tenantId: string,
  planId: string | null | undefined,
  now: number = Date.now(),
): Promise<void> {
  const proPlan = planId
    ? await db.select().from(plans).where(eq(plans.id, planId)).get()
    : null;
  const resolvedPlanId = proPlan
    ? proPlan.id
    : (await db.select().from(plans).where(eq(plans.name, 'pro')).get())?.id;

  const existing = await db.select().from(tenantSubscriptions)
    .where(eq(tenantSubscriptions.tenantId, tenantId)).get();

  const values = {
    planId: resolvedPlanId ?? null,
    status: 'active',
    trialEndsAt: null,
    startsAt: now,
    endsAt: now + PRO_CYCLE_MS,
  };

  if (existing) {
    await db.update(tenantSubscriptions)
      .set(values)
      .where(eq(tenantSubscriptions.tenantId, tenantId));
  } else {
    await db.insert(tenantSubscriptions).values({
      id: crypto.randomUUID(),
      tenantId,
      ...values,
    });
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
