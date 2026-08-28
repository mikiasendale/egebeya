import { Router } from 'express';
import { db } from '../db';
import {
  tenants, users, tenantSubscriptions, plans, appointments,
  customerStats, notificationLog, activationEvents, staff, tenantBusinessHours,
} from '../db/schema';
import { eq, sql, desc, inArray, gte } from 'drizzle-orm';
import { requireAuth, requireSuperadmin } from './middleware/auth';
import { csrfProtection } from './middleware/csrf';
import { adminWriteLimiter } from '../../server/middleware/rateLimiter';
import { aggregateNotificationStats } from '../../server/lib/notificationStats';
import {
  aggregateWeeklyFunnel,
  funnelConversion,
  computeNorthStar,
  computeMonthlyChurn,
  computeQuietHoursFillRate,
} from '../../server/lib/analytics';
import { getDemoTenantId, excludeDemoRows } from '../../server/lib/demoTenant';

const router = Router();

// Auth gate: only JWTs that identify a superadmin may proceed.
//
// The `is_superadmin` flag is on the users table (NOT the JWT) — we verify
// the JWT's `userId`, then look up the user fresh on every request so
// revoking superadmin status takes effect immediately. requireAuth also
// verifies tokenVersion so a revoked session cannot reach admin surfaces.
router.use(requireAuth());
router.use(csrfProtection);
router.use(adminWriteLimiter);
router.use(requireSuperadmin());

/**
 * GET /api/admin/stats
 * Platform-wide counts surfaced at the top of /admin.
 */
router.get('/stats', async (_req, res) => {
  try {
    const tenantRow = await db.select({ n: sql<number>`count(*)`.as('n') }).from(tenants).get();
    const bookingRow = await db.select({ n: sql<number>`count(*)`.as('n') }).from(appointments).get();
    const suspendedRow = await db
      .select({ n: sql<number>`count(*)`.as('n') })
      .from(tenants)
      .where(eq(tenants.isSuspended, true))
      .get();
    res.json({
      tenants: Number(tenantRow?.n ?? 0),
      bookings: Number(bookingRow?.n ?? 0),
      suspended: Number(suspendedRow?.n ?? 0),
    });
  } catch (error) {
    console.error('admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch platform stats' });
  }
});

/**
 * GET /api/admin/tenants
 * List every tenant alongside their plan+subscription status and suspension
 * state. Sorted newest-first so a superadmin triages just-onboarded tenants
 * first if any start misbehaving.
 */
router.get('/tenants', async (_req, res) => {
  try {
    const list = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        category: tenants.category,
        isListed: tenants.isListed,
        isSuspended: tenants.isSuspended,
        createdAt: tenants.createdAt,
        planId: tenantSubscriptions.planId,
        planName: plans.name,
        subStatus: tenantSubscriptions.status,
        trialEndsAt: tenantSubscriptions.trialEndsAt,
        endsAt: tenantSubscriptions.endsAt,
      })
      .from(tenants)
      .leftJoin(tenantSubscriptions, eq(tenantSubscriptions.tenantId, tenants.id))
      .leftJoin(plans, eq(plans.id, tenantSubscriptions.planId))
      .orderBy(desc(tenants.createdAt))
      .all();
    res.json(list);
  } catch (error) {
    console.error('admin tenants error:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

/**
 * PUT /api/admin/tenants/:id/suspend
 * Suspend a tenant — blocks their public site, booking ingest, and any
 * tenant-owner route handler that hits the tenant-resolution middleware.
 * Idempotent: suspending an already-suspended tenant is a no-op success.
 */
router.put('/tenants/:id/suspend', async (req, res) => {
  const id = String(req.params.id || '');
  try {
    const existing = await db.select({ id: tenants.id, isSuspended: tenants.isSuspended })
      .from(tenants).where(eq(tenants.id, id)).get();
    if (!existing) return res.status(404).json({ error: 'Tenant not found' });
    if (existing.isSuspended) {
      return res.json({ success: true, id, isSuspended: true, already: true });
    }
    await db.update(tenants).set({ isSuspended: true }).where(eq(tenants.id, id));
    res.json({ success: true, id, isSuspended: true });
  } catch (error) {
    console.error('admin suspend error:', error);
    res.status(500).json({ error: 'Failed to suspend tenant' });
  }
});

/**
 * PUT /api/admin/tenants/:id/reactivate
 * Reverse of /suspend. Also idempotent.
 */
router.put('/tenants/:id/reactivate', async (req, res) => {
  const id = String(req.params.id || '');
  try {
    const existing = await db.select({ id: tenants.id, isSuspended: tenants.isSuspended })
      .from(tenants).where(eq(tenants.id, id)).get();
    if (!existing) return res.status(404).json({ error: 'Tenant not found' });
    if (!existing.isSuspended) {
      return res.json({ success: true, id, isSuspended: false, already: true });
    }
    await db.update(tenants).set({ isSuspended: false }).where(eq(tenants.id, id));
    res.json({ success: true, id, isSuspended: false });
  } catch (error) {
    console.error('admin reactivate error:', error);
    res.status(500).json({ error: 'Failed to reactivate tenant' });
  }
});

/**
 * GET /api/admin/notification-stats (P3.3)
 *
 * Marketing opt-in rate + delivery outcomes by channel/week. Written by the
 * NotificationAdapter into notification_log; this is the evidence base for
 * the SMS revive/kill decision and the Telegram opt-in gate that unlocks
 * P5.1 loyalty.
 */
router.get('/notification-stats', async (_req, res) => {
  try {
    const demoTenantId = await getDemoTenantId();
    const [logRows, customerRows] = await Promise.all([
      db.select({
        channel: notificationLog.channel,
        status: notificationLog.status,
        createdAt: notificationLog.createdAt,
      }).from(notificationLog).all(),
      // P2.5 reopen (C3): the demo tenant's customers never pollute the
      // platform opt-in rate — its rows exist to close deals, not to measure.
      db.select({
        tenantId: customerStats.tenantId,
        marketingOptIn: customerStats.marketingOptIn,
      }).from(customerStats).all(),
    ]);

    const customerRowsExDemo = customerRows.filter((r) => r.tenantId !== demoTenantId);
    res.json(aggregateNotificationStats(logRows, customerRowsExDemo));
  } catch (error) {
    console.error('admin notification-stats error:', error);
    res.status(500).json({ error: 'Failed to fetch notification stats' });
  }
});

const LIFECYCLE_EVENTS = [
  'site_generated', 'hours_confirmed', 'site_shared',
  'first_booking', 'first_invoice_paid',
] as const;

/**
 * GET /api/admin/funnel?weeks=12 (P3.5)
 *
 * Weekly funnel conversion between activation stages, the north-star
 * (weekly confirmed bookings per billing-active tenant) and the monthly
 * logo-churn guardrail. All math is computed from existing tables —
 * no client-side reporting involved, so agent commissions are paid against
 * code-defined events only (ROADMAP risk #8).
 */
router.get('/funnel', async (req, res) => {
  try {
    const weeks = Math.min(Math.max(parseInt(String(req.query.weeks || '12'), 10) || 12, 1), 52);

    const since = Date.now() - weeks * 7 * 24 * 60 * 60 * 1000;

    const [eventRows, bookingRows, subRows, allTenants, staffRows, hoursRows] = await Promise.all([
      db.select({ tenantId: activationEvents.tenantId, event: activationEvents.event, createdAt: activationEvents.createdAt })
        .from(activationEvents)
        .where(inArray(activationEvents.event, [...LIFECYCLE_EVENTS]))
        .all(),
      db.select({
        startTime: appointments.startTime,
        status: appointments.status,
        tenantId: appointments.tenantId,
      }).from(appointments).where(gte(appointments.startTime, since)).all(),
      db.select({
        tenantId: tenantSubscriptions.tenantId,
        startsAt: tenantSubscriptions.startsAt,
        endsAt: tenantSubscriptions.endsAt,
      }).from(tenantSubscriptions).all(),
      db.select({ id: tenants.id, settings: tenants.settings }).from(tenants).all(),
      db.select({ tenantId: staff.id, active: staff.active }).from(staff).all(),
      db.select({ tenantId: tenantBusinessHours.tenantId, dayOfWeek: tenantBusinessHours.dayOfWeek, isClosed: tenantBusinessHours.isClosed })
        .from(tenantBusinessHours).all(),
    ]);

    // P5.6 G3: quiet-hours fill-rate inputs — staff counts + open days.
    const staffCounts: Record<string, number> = {};
    for (const r of staffRows) {
      staffCounts[r.tenantId] = (staffCounts[r.tenantId] ?? 0) + (r.active === false ? 0 : 1);
    }
    const openDaysByTenant: Record<string, Set<number>> = {};
    for (const r of hoursRows) {
      if (r.isClosed) continue;
      (openDaysByTenant[r.tenantId] ??= new Set()).add(r.dayOfWeek);
    }

    // P2.5 reopen (C3): the demo tenant's plausible activity must not
    // flatter the north-star or churn numbers the council reviews.
    const demoTenantId = await getDemoTenantId();
    const funnelEventRows = excludeDemoRows(eventRows, demoTenantId);
    const funnelBookingRows = excludeDemoRows(bookingRows, demoTenantId);
    const funnelSubRows = excludeDemoRows(subRows, demoTenantId);

    const weeklyStages = aggregateWeeklyFunnel(funnelEventRows);
    const conversion = funnelConversion(weeklyStages);

    res.json({
      weekly: weeklyStages.map((w, i) => ({ ...w, conversion: conversion[i] })),
      northStar: computeNorthStar(funnelBookingRows, funnelSubRows, { weeks }),
      churn: computeMonthlyChurn(funnelSubRows),
      // P5.6 G3: null when no tenant has ever enabled the flag.
      quietHoursFillRate: computeQuietHoursFillRate({
        tenants: allTenants.map((t) => ({ id: t.id, settings: (t.settings as Record<string, unknown>) ?? null })),
        appointments: bookingRows,
        staffCounts,
        openDaysByTenant,
        weeks,
      }),
    });
  } catch (error) {
    console.error('admin funnel error:', error);
    res.status(500).json({ error: 'Failed to fetch funnel' });
  }
});

export default router;
