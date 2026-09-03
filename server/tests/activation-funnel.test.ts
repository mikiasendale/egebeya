/**
 * P3.5 — activation events + funnel/north-star math on a synthetic month.
 *
 * The north-star (weekly confirmed bookings per billing-active tenant) and
 * the monthly logo-churn guardrail are pure functions asserted here against
 * hand-built fixtures where the expected values are known by construction.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';

import {
  computeNorthStar,
  computeMonthlyChurn,
  aggregateWeeklyFunnel,
  funnelConversion,
  weekStart,
  trackEvent,
  ACTIVATION_EVENTS,
  computeQuietHoursFillRate,
} from '../lib/analytics';
import { db } from '../../src/db';
import { activationEvents, tenants } from '../../src/db/schema';
import { eq } from 'drizzle-orm';

const WEEK = 7 * 24 * 3600 * 1000;

describe('north-star math (P3.5)', () => {
  // Synthetic month: weeks W0..W3 anchored to a fixed "now".
  const NOW = Date.UTC(2026, 6, 15); // Wed Jul 15 2026
  const W1 = Date.UTC(2026, 6, 13);  // Monday of current week
  const W0 = W1 - WEEK;

  it('computes confirmed bookings per billing-active tenant per week', () => {
    const bookings = [
      // Week W1: tenant A has 2 confirmed + 1 cancelled; B has none.
      { startTime: W1 + DAY(1), status: 'confirmed', tenantId: 'A' },
      { startTime: W1 + DAY(2), status: 'confirmed', tenantId: 'A' },
      { startTime: W1 + DAY(3), status: 'cancelled', tenantId: 'A' },
      // Week W0: one confirmed for B.
      { startTime: W0 + DAY(1), status: 'completed', tenantId: 'B' },
      // Future booking outside both windows.
      { startTime: W1 + WEEK + DAY(1), status: 'confirmed', tenantId: 'A' },
    ];
    const subs = [
      // A active all month.
      { tenantId: 'A', startsAt: W0 - WEEK, endsAt: W1 + WEEK * 4 },
      // B active only through week W0 (ends Saturday of W0 — no W1 overlap).
      { tenantId: 'B', startsAt: W0 - WEEK, endsAt: W0 + DAY(6) },
    ];

    const rows = computeNorthStar(bookings, subs, { now: NOW, weeks: 2 });

    const w0 = rows.find((r) => r.weekStart === W0)!;
    const w1 = rows.find((r) => r.weekStart === W1)!;

    // W0: 1 completed booking, A+B billing-active → 1/2 = 0.5
    expect(w0.confirmedBookings).toBe(1);
    expect(w0.billingActiveTenants).toBe(2);
    expect(w0.value).toBeCloseTo(0.5);

    // W1: 2 confirmed, only A still active → 2/1 = 2.0
    expect(w1.confirmedBookings).toBe(2);
    expect(w1.billingActiveTenants).toBe(1);
    expect(w1.value).toBeCloseTo(2.0);
  });

  it('yields null value when no tenants were billing-active that week', () => {
    const rows = computeNorthStar(
      [{ startTime: Date.now(), status: 'confirmed', tenantId: 'X' }],
      [{ tenantId: 'X', startsAt: Date.now() + WEEK, endsAt: Date.now() + WEEK * 2 }],
      { now: Date.now(), weeks: 1 },
    );
    expect(rows[0].value).toBeNull();
  });

  it('monthly logo churn counts only tenants present at month start', () => {
    const NOW = Date.UTC(2026, 6, 15);
    const MONTH_START = Date.UTC(2026, 6, 1);
    const subs = [
      // Survived the whole month so far.
      { tenantId: 'keep', startsAt: MONTH_START - WEEK, endsAt: null },
      // Churned mid-month.
      { tenantId: 'gone', startsAt: MONTH_START - WEEK, endsAt: MONTH_START + 10 * DAY(1) },
      // Joined AFTER month start — not in denominator, not churned.
      { tenantId: 'newbie', startsAt: MONTH_START + DAY(5), endsAt: null },
      // Ended before this month started — irrelevant.
      { tenantId: 'ancient', startsAt: MONTH_START - WEEK * 8, endsAt: MONTH_START - DAY(1) },
    ];
    const churn = computeMonthlyChurn(subs, { now: NOW });
    expect(churn.activeAtStart).toBe(2); // keep + gone
    expect(churn.churned).toBe(1);
    expect(churn.churnRate).toBeCloseTo(0.5);
  });
});

describe('funnel aggregation (P3.5)', () => {
  it('buckets lifecycle events into weekly stages with conversion rates', () => {
    const base = weekStart(Date.UTC(2026, 6, 15));
    const rows = [
      { event: 'site_generated', createdAt: base + DAY(0) },
      { event: 'site_generated', createdAt: base + DAY(0) + 1 },
      { event: 'hours_confirmed', createdAt: base + DAY(1) },
      { event: 'site_shared', createdAt: base + DAY(2) },
      { event: 'first_booking', createdAt: base + DAY(3) },
      { event: 'first_invoice_paid', createdAt: base + DAY(4) },
    ];
    const weekly = aggregateWeeklyFunnel(rows);
    expect(weekly.length).toBe(1);
    expect(weekly[0].stages.siteGenerated).toBe(2);
    expect(weekly[0].stages.firstInvoicePaid).toBe(1);

    const conv = funnelConversion(weekly);
    expect(conv[0].generatedToConfirmed).toBeCloseTo(0.5);
    expect(conv[0].confirmedToShared).toBe(1);
    expect(conv[0].sharedToBooking).toBe(1);
    expect(conv[0].bookingToPaid).toBe(1);
  });

  it('zero-denominator stages yield null conversion (not 0)', () => {
    const conv = funnelConversion([{ weekStart: weekStart(Date.now()), stages: {
      siteGenerated: 0, hoursConfirmed: 0, siteShared: 0, firstBooking: 0, firstInvoicePaid: 0,
    }}]);
    expect(conv[0].generatedToConfirmed).toBeNull();
    expect(conv[0].bookingToPaid).toBeNull();
  });
});

describe('trackEvent emitter (P3.5)', () => {
  let tenantId: string;
  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    await db.insert(tenants).values({
      id: tenantId, name: 'Funnel Tenant', slug: `funnel-${Date.now()}`, createdAt: Date.now(),
    });
  });
  afterAll(async () => {
    await db.delete(activationEvents).where(eq(activationEvents.tenantId, tenantId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
  });

  it('persists canonical events and drops events without tenant context', async () => {
    trackEvent(tenantId, 'hours_confirmed', { via: 'test' });

    let row: any = null;
    for (let i = 0; i < 20 && !row; i++) {
      await new Promise((r) => setTimeout(r, 50));
      row = await db.select().from(activationEvents)
        .where(eq(activationEvents.tenantId, tenantId)).get();
    }
    expect(row?.event).toBe('hours_confirmed');

    // price_seen is allowed pre-tenant; everything else without a tenant is dropped.
    trackEvent(null, 'first_booking');
    const all = await db.select().from(activationEvents)
      .where(eq(activationEvents.tenantId, tenantId)).all();
    expect(all.length).toBe(1);
  });

  it('exposes exactly the canonical event set', () => {
    expect(ACTIVATION_EVENTS).toContain('site_generated');
    expect(ACTIVATION_EVENTS).toContain('checkout_abandoned');
    expect(ACTIVATION_EVENTS).toContain('quiet_hours_booking'); // P5.6 fill-rate feed
    expect(ACTIVATION_EVENTS).toContain('winback_offer_sent'); // T4.8 offer idempotency
    expect(ACTIVATION_EVENTS).toContain('reg_step_viewed'); // T4.9 pre-register beacons
    expect(ACTIVATION_EVENTS).toContain('slug_checked');
    expect(ACTIVATION_EVENTS).toContain('reg_details_submitted');
    expect(ACTIVATION_EVENTS.length).toBe(14);
  });
});

function DAY(n: number): number {
  return n * 24 * 3600 * 1000;
}

describe('quiet-hours fill rate (P5.6 G3)', () => {
  const NOW = Date.UTC(2026, 6, 15); // Wed Jul 15
  const W1 = Date.UTC(2026, 6, 13);  // Monday of current week
  const W0 = W1 - WEEK;

  function tenant(id: string, cfg: { start: number; end: number; enabled?: boolean }) {
    return {
      id,
      settings: cfg.enabled === false
        ? { quiet_hours_discount: { enabled: false } }
        : { quiet_hours_discount: { enabled: true, start_minute: cfg.start, end_minute: cfg.end, percent: 20 } },
    };
  }

  function appt(tenantId: string, utc: number, day = W1, status = 'confirmed') {
    return { tenantId, startTime: day + utc * 3600 * 1000, status };
  }

  it('normal window: rate = in-window bookings / 30-min slots × staff × open days', () => {
    // Window 13:00–15:00 = 120 min = 4 slots/day. Tenant has 2 staff, 6 open
    // days → 4×2×6 = 48 slots/week. Two confirmed in-window bookings.
    const rate = computeQuietHoursFillRate({
      tenants: [tenant('a', { start: 780, end: 900 })],
      appointments: [
        appt('a', 11), // 14:00 Addis → in-window
        appt('a', 11, W1, 'completed'),
        appt('a', 8, W1, 'cancelled'), // outside window + cancelled → ignored
      ],
      staffCounts: { a: 2 },
      openDaysByTenant: { a: new Set([1, 2, 3, 4, 5, 6]) },
      weeks: 1, now: NOW,
    })!;
    expect(rate).toHaveLength(1);
    expect(rate[0].inWindowSlots).toBe(48);
    expect(rate[0].inWindowBookings).toBe(2);
    expect(rate[0].rate).toBeCloseTo(2 / 48);
  });

  it('overnight wrap window (start > end) still counts bookings on both sides', () => {
    // 22:00–02:00 → 4 slots before midnight + 4 after = 8 slots/day.
    const rate = computeQuietHoursFillRate({
      tenants: [tenant('b', { start: 1320, end: 120 })],
      appointments: [
        appt('b', 23),  // 02:00 Addis? 23 UTC = 02:00 next day → NOT in [1320,1440) nor <120? 02:00=120 not <120 → boundary excluded
        appt('b', 21),  // 00:00 Addis → in (0 < 120)
        appt('b', 22),  // 01:00 Addis → in
      ],
      staffCounts: { b: 1 },
      openDaysByTenant: { b: new Set([0, 1, 2, 3, 4, 5, 6]) },
      weeks: 1, now: NOW,
    })!;
    // 8 slots/day × 7 days × 1 staff = 56 slots.
    expect(rate[0].inWindowSlots).toBe(56);
    // 21 UTC = 00:00 Addis (in, 0<120), 22 UTC=01:00 (in). 23 UTC=02:00 → 120 not <120 (out).
    expect(rate[0].inWindowBookings).toBe(2);
  });

  it('returns null when no tenant has the flag enabled', () => {
    const rate = computeQuietHoursFillRate({
      tenants: [tenant('c', { start: 780, end: 900, enabled: false })],
      appointments: [],
      staffCounts: { c: 1 },
      openDaysByTenant: {},
      weeks: 1, now: NOW,
    });
    expect(rate).toBeNull();
  });

  it('defaults to all-7-days when a tenant has no business-hours rows', () => {
    const rate = computeQuietHoursFillRate({
      tenants: [tenant('d', { start: 480, end: 540 })], // 2 slots/day × 7 × 1 = 14
      appointments: [appt('d', 5)], // 08:00 Addis → in [480,540)
      staffCounts: { d: 1 },
      openDaysByTenant: {},
      weeks: 1, now: NOW,
    })!;
    expect(rate[0].inWindowSlots).toBe(14);
    expect(rate[0].inWindowBookings).toBe(1);
  });
});
