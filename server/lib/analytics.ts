/**
 * Activation events + funnel math (P3.5).
 *
 * Server-side event emitter writing `activation_events` with a canonical
 * event set (the funnel stages the council reviews):
 *
 *   Lifecycle:  site_generated → hours_confirmed → site_shared →
 *               first_booking → first_invoice_paid
 *   Attribution agent_attributed (?ref= captured at register)
 *   Pricing funnel (M9 hybrid-arm elasticity data): price_seen,
 *               checkout_started, checkout_abandoned
 *
 * trackEvent is fire-and-forget: analytics must never break the request that
 * produced it. The pure aggregation helpers at the bottom are unit-tested
 * against synthetic months of data (see server/tests/activation-funnel.test.ts).
 */

import crypto from 'crypto';
import { db } from '../../src/db';
import { activationEvents } from '../../src/db/schema';

export const ACTIVATION_EVENTS = [
  'site_generated',
  'hours_confirmed',
  'site_shared',
  'first_booking',
  'first_invoice_paid',
  'agent_attributed',
  // Pricing-funnel elasticity events.
  'price_seen',
  'checkout_started',
  'checkout_abandoned',
  // P5.6 fill-rate delta input.
  'quiet_hours_booking',
  // T4.8 idempotency beacon for the merchant winback offer.
  'winback_offer_sent',
  // T4.9 anonymous pre-register beacons (NULL tenant, cookie-bound).
  'reg_step_viewed',
  'slug_checked',
  'reg_details_submitted',
] as const;

export type ActivationEvent = (typeof ACTIVATION_EVENTS)[number];

// Events that are meaningful WITHOUT a tenant — pre-identity touches only.
const NULL_TENANT_EVENTS: ReadonlySet<string> = new Set([
  'price_seen',
  'reg_step_viewed',
  'slug_checked',
  'reg_details_submitted',
]);

/**
 * Record one activation event. Never throws into the caller's path.
 */
export function trackEvent(
  tenantId: string | null | undefined,
  event: ActivationEvent,
  meta?: Record<string, unknown>,
): void {
  try {
    if (!tenantId && !NULL_TENANT_EVENTS.has(event)) {
      // Events without a tenant are only meaningful for pre-tenant funnel
      // touches; everything else requires attribution context.
      console.warn(`[analytics] ${event} fired without tenantId; dropped`);
      return;
    }
    void db.insert(activationEvents).values({
      id: crypto.randomUUID(),
      tenantId: tenantId ?? null,
      event,
      meta: meta ?? null,
      createdAt: Date.now(),
    }).catch((err) => {
      console.error('[analytics] insert failed:', err?.message || err);
    });
  } catch (err: any) {
    console.error('[analytics] trackEvent threw:', err?.message || err);
  }
}

// ── Pure aggregation helpers ─────────────────────────────────────────────

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Monday-00:00 UTC week start for a timestamp (stable bucketing for funnels).
 */
export function weekStart(ts: number): number {
  const d = new Date(ts);
  const day = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return midnight - day * DAY_MS;
}

export interface FunnelStageCounts {
  siteGenerated: number;
  hoursConfirmed: number;
  siteShared: number;
  firstBooking: number;
  firstInvoicePaid: number;
}

export interface WeeklyFunnelRow {
  weekStart: number;
  stages: FunnelStageCounts;
}

/**
 * Bucket raw activation-event rows into weekly funnel stage counts.
 * (Rows come pre-filtered to the canonical lifecycle events.)
 */
export function aggregateWeeklyFunnel(
  rows: Array<{ event: string; createdAt: number }>,
): WeeklyFunnelRow[] {
  const byWeek = new Map<number, FunnelStageCounts>();
  const blank = (): FunnelStageCounts => ({
    siteGenerated: 0, hoursConfirmed: 0, siteShared: 0, firstBooking: 0, firstInvoicePaid: 0,
  });

  for (const r of rows) {
    const wk = weekStart(r.createdAt);
    if (!byWeek.has(wk)) byWeek.set(wk, blank());
    const bucket = byWeek.get(wk)!;
    switch (r.event) {
      case 'site_generated': bucket.siteGenerated += 1; break;
      case 'hours_confirmed': bucket.hoursConfirmed += 1; break;
      case 'site_shared': bucket.siteShared += 1; break;
      case 'first_booking': bucket.firstBooking += 1; break;
      case 'first_invoice_paid': bucket.firstInvoicePaid += 1; break;
      default: break;
    }
  }

  return Array.from(byWeek.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([weekStartTs, stages]) => ({ weekStart: weekStartTs, stages }));
}

/**
 * Week-over-week conversion between adjacent funnel stages, as fractions in
 * [0,1]. A stage with zero predecessors yields null (undefined rate), not 0 —
 * "nobody got there" ≠ "everyone converted".
 */
export function funnelConversion(
  weeks: WeeklyFunnelRow[],
): Array<{ weekStart: number; generatedToConfirmed: number | null; confirmedToShared: number | null; sharedToBooking: number | null; bookingToPaid: number | null }> {
  const prevOf = (idx: number, key: keyof FunnelStageCounts): number =>
    idx > 0 ? weeks[idx - 1].stages[key] : weeks[idx].stages[key];
  // Stage N this week is compared against stage N-1 available so far
  // (this week's or any earlier week's latest nonzero? Keep it honest and
  // simple: same-week adjacency, falling back to cumulative-to-date counts.)
  const cum = (upTo: number, key: keyof FunnelStageCounts): number =>
    weeks.slice(0, upTo + 1).reduce((acc, w) => acc + w.stages[key], 0);

  return weeks.map((w, i) => {
    const rate = (numerator: number, denominator: number): number | null =>
      denominator === 0 ? null : numerator / denominator;
    return {
      weekStart: w.weekStart,
      generatedToConfirmed: rate(cum(i, 'hoursConfirmed'), cum(i, 'siteGenerated')),
      confirmedToShared: rate(cum(i, 'siteShared'), cum(i, 'hoursConfirmed')),
      sharedToBooking: rate(cum(i, 'firstBooking'), cum(i, 'siteShared')),
      bookingToPaid: rate(cum(i, 'firstInvoicePaid'), cum(i, 'firstBooking')),
    };
  });
}

export interface BookingRowLike {
  startTime: number;
  status: string;
  tenantId: string;
}

export interface SubscriptionSpanLike {
  tenantId: string;
  startsAt: number | null;
  endsAt: number | null;
}

export interface NorthStarWeek {
  weekStart: number;
  /** Confirmed bookings across billing-active tenants that week. */
  confirmedBookings: number;
  /** Tenants whose subscription overlapped the week (active or trial). */
  billingActiveTenants: number;
  /** The north-star itself: confirmed bookings per billing-active tenant. */
  value: number | null;
}

/**
 * NORTH-STAR (ROADMAP §1): weekly confirmed bookings per billing-active
 * tenant, ≥1.0 by Day 90. A tenant is billing-active for a week when its
 * pro subscription span [startsAt, endsAt] overlaps that week (null endsAt =
 * still open). Confirmed bookings counted by appointment START time within
 * the week with status confirmed|completed.
 */
export function computeNorthStar(
  bookings: BookingRowLike[],
  subscriptions: SubscriptionSpanLike[],
  opts: { weeks?: number; now?: number } = {},
): NorthStarWeek[] {
  const now = opts.now ?? Date.now();
  const nWeeks = Math.max(1, Math.min(opts.weeks ?? 12, 52));
  const currentWeek = weekStart(now);

  const out: NorthStarWeek[] = [];
  for (let i = nWeeks - 1; i >= 0; i--) {
    const ws = currentWeek - i * WEEK_MS;
    const we = ws + WEEK_MS;

    const confirmedBookings = bookings.filter((b) =>
      (b.status === 'confirmed' || b.status === 'completed') &&
      b.startTime >= ws && b.startTime < we,
    ).length;

    const activeTenantIds = new Set<string>();
    for (const sub of subscriptions) {
      const startsAt = sub.startsAt ?? Number.MIN_SAFE_INTEGER;
      const endsAt = sub.endsAt ?? Number.MAX_SAFE_INTEGER;
      if (startsAt < we && endsAt >= ws) {
        activeTenantIds.add(sub.tenantId);
      }
    }
    const denom = activeTenantIds.size;
    out.push({
      weekStart: ws,
      confirmedBookings,
      billingActiveTenants: denom,
      value: denom === 0 ? null : confirmedBookings / denom,
    });
  }
  return out;
}

/**
 * GUARDRAIL (ROADMAP §2): gross monthly logo churn — share of tenants that
 * were billing-active at month start whose subscription ended during the
 * month. `endedDuringMonth` rows are subscriptions with endsAt inside the
 * window; `activeAtStart` spans overlap the month start instant.
 */

/**
 * Quiet-hours fill rate (P5.6 G3) — weekly share of in-window bookable slots
 * that actually received a booking.
 *
 * DENOMINATOR (documented choice): bookable in-window slots = the same
 * 30-minute grid the availability endpoint emits, restricted to the merchant's
 * window: distinct 30-min slot starts inside [start_minute, end_minute) (with
 * overnight wrap handling) × that tenant's ACTIVE staff count × open weekdays
 * per tenant_business_hours (defaults to all 7 when no hours rows exist).
 * Closures/blackouts are not subtracted — there is no derived inventory to
 * subtract against; that refinement needs the slot generator and is parked.
 *
 * Numerator: confirmed/completed appointments whose Addis minute-of-day falls
 * inside the window. Pure-function style: rows in → buckets out.
 */

export interface QuietHoursConfig {
  enabled: boolean;
  start_minute: number;
  end_minute: number;
  percent: number;
}

export interface QuietHoursTenantLike {
  id: string;
  settings: Record<string, unknown> | null;
}

export interface QuietHoursAppointmentLike {
  tenantId: string;
  startTime: number;
  status: string;
}

export interface QuietHoursFillWeek {
  weekStart: number;
  inWindowBookings: number;
  inWindowSlots: number;
  /** inWindowBookings / inWindowSlots; null when no slots (or nothing enabled). */
  rate: number | null;
}

const MINUTE = 60_000;
const SLOT_MINUTES = 30;

/** Minutes in the window given the overnight-wrap possibility. */
function windowSegments(startMinute: number, endMinute: number): Array<[number, number]> {
  if (startMinute <= endMinute) return [[startMinute, endMinute]];
  return [[startMinute, 24 * 60], [0, endMinute]];
}

function minuteInWindow(minute: number, startMinute: number, endMinute: number): boolean {
  return startMinute <= endMinute
    ? minute >= startMinute && minute < endMinute
    : minute >= startMinute || minute < endMinute;
}

export function quietHoursConfigOf(settings: Record<string, unknown> | null | undefined): QuietHoursConfig | null {
  const qh = (settings ?? {})?.quiet_hours_discount as Partial<QuietHoursConfig> | undefined;
  if (!qh || qh.enabled !== true) return null;
  const sm = Number(qh.start_minute); const em = Number(qh.end_minute); const pc = Number(qh.percent);
  if (![sm, em, pc].every(Number.isFinite)) return null;
  return { enabled: true, start_minute: sm, end_minute: em, percent: pc };
}

export function computeQuietHoursFillRate(opts: {
  tenants: QuietHoursTenantLike[];
  appointments: QuietHoursAppointmentLike[];
  /** tenantId → active staff count. */
  staffCounts: Record<string, number>;
  /** tenantId → open day-of-week set (0..6). Empty set = assume all 7 open. */
  openDaysByTenant: Record<string, Set<number>>;
  weeks?: number;
  now?: number;
}): QuietHoursFillWeek[] | null {
  const now = opts.now ?? Date.now();
  const nWeeks = Math.max(1, Math.min(opts.weeks ?? 4, 52));
  const currentWeek = weekStart(now);

  // Tenants with the flag enabled this window.
  const active = opts.tenants
    .map((t) => ({ id: t.id, cfg: quietHoursConfigOf(t.settings) }))
    .filter((t): t is { id: string; cfg: QuietHoursConfig } => t.cfg !== null);
  if (active.length === 0) return null;

  const out: QuietHoursFillWeek[] = [];
  for (let i = nWeeks - 1; i >= 0; i--) {
    const ws = currentWeek - i * WEEK_MS;
    const we = ws + WEEK_MS;

    let inWindowSlots = 0;
    let inWindowBookings = 0;

    for (const tenant of active) {
      const staff = Math.max(1, opts.staffCounts[tenant.id] ?? 1);
      const openDays = opts.openDaysByTenant[tenant.id] ?? new Set([0, 1, 2, 3, 4, 5, 6]);
      const daysOpen = openDays.size === 0 ? 7 : openDays.size;

      // Slot count = per open day, the number of 30-min slot starts in-window.
      let slotsPerDay = 0;
      for (const [segStart, segEnd] of windowSegments(tenant.cfg.start_minute, tenant.cfg.end_minute)) {
        for (let m = segStart; m < segEnd; m += SLOT_MINUTES) slotsPerDay += 1;
      }
      inWindowSlots += slotsPerDay * daysOpen * staff;

      // Bookings in-window within this week.
      for (const appt of opts.appointments) {
        if (appt.tenantId !== tenant.id) continue;
        if (appt.startTime < ws || appt.startTime >= we) continue;
        if (appt.status !== 'confirmed' && appt.status !== 'completed') continue;
        const addis = new Date(appt.startTime + 3 * 3600 * 1000);
        const minute = addis.getUTCHours() * 60 + addis.getUTCMinutes();
        if (minuteInWindow(minute, tenant.cfg.start_minute, tenant.cfg.end_minute)) {
          inWindowBookings += 1;
        }
      }
    }

    out.push({
      weekStart: ws,
      inWindowBookings,
      inWindowSlots,
      rate: inWindowSlots === 0 ? null : inWindowBookings / inWindowSlots,
    });
  }
  return out;
}

export function computeMonthlyChurn(
  subscriptions: SubscriptionSpanLike[],
  opts: { now?: number } = {},
): { monthStart: number; activeAtStart: number; churned: number; churnRate: number | null } {
  const now = opts.now ?? Date.now();
  const d = new Date(now);
  const monthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const nextMonthStart = Date.UTC(
    d.getUTCMonth() === 11 ? d.getUTCFullYear() + 1 : d.getUTCFullYear(),
    d.getUTCMonth() === 11 ? 0 : d.getUTCMonth() + 1,
    1,
  );

  const activeAtStartSet = new Set<string>();
  const churnedSet = new Set<string>();
  for (const sub of subscriptions) {
    const startsAt = sub.startsAt ?? Number.MIN_SAFE_INTEGER;
    const endsAt = sub.endsAt ?? Number.MAX_SAFE_INTEGER;
    // Active at month start: span covers the instant.
    if (startsAt <= monthStart && endsAt >= monthStart) {
      activeAtStartSet.add(sub.tenantId);
    }
    // Churned during the month: subscription ended inside the window.
    if (endsAt > monthStart && endsAt < nextMonthStart) {
      churnedSet.add(sub.tenantId);
    }
  }
  const denom = activeAtStartSet.size;
  // Only count churn among those present at month start ("logo churn").
  let churned = 0;
  for (const id of churnedSet) {
    if (activeAtStartSet.has(id)) churned += 1;
  }
  return {
    monthStart,
    activeAtStart: denom,
    churned,
    churnRate: denom === 0 ? null : churned / denom,
  };
}
