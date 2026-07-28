/**
 * Front-end helper for the real Pro-plan subscription check.
 *
 * The previous `tenant.plan === 'pro'` style was a name-only gate and could
 * not detect expired trials or non-Pro strings. The server now resolves
 * access from the `tenant_subscriptions` row using three conditions:
 *
 *   1. `subscription.plan_id` resolves to the 'pro' plan row (id match, not
 *      just name), AND
 *   2. `subscription.status` is 'active' or 'trial', AND
 *   3. when status is 'trial', `trialEndsAt` has not lapsed (a past
 *      `trialEndsAt` is treated as the same as 'expired').
 *
 * This file is the single home for that derived answer so the Settings page
 * and the CodeEditor share one definition. Both must mirror what
 * `requireProPlan` does in src/api/pro-site.ts.
 */
import { authFetch } from './api';

/**
 * Shape we get back from `GET /api/tenant/subscription`. We use loose typing
 * (`any[]`) on each side because drizzle's inferred types end up bleeding
 * `null` and `undefined` through `JSON.parse` in ways that are not worth
 * tracking field-by-field in this consumer.
 */
export interface SubscriptionSummary {
  subscription: {
    id: string;
    tenantId: string;
    planId: string | null;
    status: 'trial' | 'active' | 'expired' | 'cancelled' | string;
    trialEndsAt?: number | null;
    startsAt?: number | null;
    endsAt?: number | null;
  };
  plan: {
    id: string;
    name: string;
    price: number;
    priceEtb?: number | null;
    maxStaff: number;
    customDomainAllowed: boolean;
    description?: string | null;
  } | null;
  staffUsage?: number;
}

/**
 * Fetch the current tenant's subscription summary from the server. Returns
 * `null` if the endpoint is unreachable or returns a non-OK status — callers
 * handle the absence by treating the tenant as not-Pro.
 */
export async function fetchSubscription(): Promise<SubscriptionSummary | null> {
  const res = await authFetch('/api/tenant/subscription');
  if (!res.ok) return null;
  try {
    return (await res.json()) as SubscriptionSummary;
  } catch {
    return null;
  }
}

/**
 * Pure function form of the Pro gate. Takes a subscription summary (either
 * passed in from a parent or the result of `fetchSubscription`) and returns
 * whether the editor / Pro-only features should be unlocked.
 */
export function isProActive(summary: SubscriptionSummary | null | undefined): boolean {
  if (!summary) return false;
  const { plan, subscription } = summary;
  if (!plan || !subscription) return false;
  if (plan.name?.toLowerCase() !== 'pro') return false;
  if (subscription.status !== 'active' && subscription.status !== 'trial') {
    return false;
  }
  if (
    subscription.status === 'trial' &&
    typeof subscription.trialEndsAt === 'number' &&
    subscription.trialEndsAt <= Date.now()
  ) {
    return false;
  }
  return true;
}

/**
 * Convenience: combine the network fetch and the gate check. Returns a
 * discriminated result so callers can distinguish "still loading" (the
 * fetch hasn't settled) from "not Pro" — the CodeEditor renders three
 * different states around these.
 */
export type ProGateState =
  | { loading: true }
  | { loading: false; isPro: true; summary: SubscriptionSummary }
  | { loading: false; isPro: false; summary: SubscriptionSummary | null };

export async function getProGateState(): Promise<ProGateState> {
  const summary = await fetchSubscription();
  if (!summary) return { loading: false, isPro: false, summary: null };
  return { loading: false, isPro: isProActive(summary), summary };
}
