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
 *
 * Mirrors the server gate in src/api/pro-site.ts: `active` subscriptions
 * whose `endsAt` has lapsed stay unlocked during the 5-day grace period so
 * the UI and the server agree on access.
 */
const GRACE_PERIOD_MS = 5 * 24 * 60 * 60 * 1000;

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
  if (
    subscription.status === 'active' &&
    typeof subscription.endsAt === 'number' &&
    subscription.endsAt <= Date.now() &&
    subscription.endsAt + GRACE_PERIOD_MS <= Date.now()
  ) {
    // Lapsed past the grace window — same as expired on the server.
    return false;
  }
  return true;
}

/**
 * Billing state for the dashboard, mirroring the server's `billing.state`:
 * 'trial' | 'active' | 'grace' | 'expired'. A paid Pro subscription whose
 * `endsAt` has passed but is still inside the 5-day window is 'grace' (the
 * UI shows a "Renew" banner); past the window it is 'expired'.
 */
export type BillingState = 'trial' | 'active' | 'grace' | 'expired';

export function billingState(summary: SubscriptionSummary | null | undefined): BillingState {
  if (!summary?.plan || !summary.subscription) return 'expired';
  const { plan, subscription } = summary;
  if (plan.name?.toLowerCase() !== 'pro') return 'active';
  if (subscription.status === 'trial') return 'trial';
  if (subscription.status !== 'active') return 'expired';
  if (typeof subscription.endsAt !== 'number' || subscription.endsAt > Date.now()) return 'active';
  if (subscription.endsAt + GRACE_PERIOD_MS > Date.now()) return 'grace';
  return 'expired';
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
