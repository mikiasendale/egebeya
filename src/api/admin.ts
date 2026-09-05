import { Router } from 'express';
import { db } from '../db';
import {
  tenants, users, tenantSubscriptions, plans, appointments,
  customerStats, notificationLog, activationEvents, staff, tenantBusinessHours,
  promoCodes, contentReports,
} from '../db/schema';
import { eq, and, sql, desc, inArray, gte, lt } from 'drizzle-orm';
import crypto from 'crypto';
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
  trackEvent,
} from '../../server/lib/analytics';
import { getDemoTenantIds, excludeDemoRows } from '../../server/lib/demoTenant';
import { notify } from '../../server/lib/notifications';

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
    // T4.5: seeded/demo tenants must never inflate platform counts.
    const tenantRow = await db
      .select({ n: sql<number>`count(*)`.as('n') })
      .from(tenants)
      .where(eq(tenants.isDemo, false))
      .get();
    const bookingRow = await db
      .select({ n: sql<number>`count(*)`.as('n') })
      .from(appointments)
      .innerJoin(tenants, eq(appointments.tenantId, tenants.id))
      .where(eq(tenants.isDemo, false))
      .get();
    const suspendedRow = await db
      .select({ n: sql<number>`count(*)`.as('n') })
      .from(tenants)
      .where(and(eq(tenants.isSuspended, true), eq(tenants.isDemo, false)))
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
      // T4.5: fictional/demo tenants are content, not operators — never triaged.
      .where(eq(tenants.isDemo, false))
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
    // T4.5: structural exclusion — EVERY flagged demo/seed tenant, plus its
    // log rows, stays out of delivery outcomes and the opt-in rate.
    const demoIds = await getDemoTenantIds();
    const [logRowsAll, customerRows] = await Promise.all([
      db.select({
        channel: notificationLog.channel,
        status: notificationLog.status,
        createdAt: notificationLog.createdAt,
        tenantId: notificationLog.tenantId,
      }).from(notificationLog).all(),
      db.select({
        tenantId: customerStats.tenantId,
        marketingOptIn: customerStats.marketingOptIn,
      }).from(customerStats).all(),
    ]);

    const logRows = logRowsAll
      .filter((r) => !r.tenantId || !demoIds.has(r.tenantId))
      .map(({ channel, status, createdAt }) => ({ channel, status, createdAt }));
    const customerRowsExDemo = customerRows.filter((r) => !demoIds.has(r.tenantId));
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
 * GET /api/admin/stuck-tenants (T4.6)
 *
 * Tenants that registered > 48h ago but never confirmed hours — the silent
 * trial-burn cohort. The funnel data already exists; this is the operational
 * query that was missing. Sorted by trial-days-remaining ascending (urgent
 * first, no-subscription rows last) so a superadmin can triage the tenants
 * most likely to churn before they ever see the paywall.
 */
router.get('/stuck-tenants', async (_req, res) => {
  const now = Date.now();
  const cutoff = now - 48 * 60 * 60 * 1000;
  const DAY = 24 * 60 * 60 * 1000;
  try {
    const rows = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        category: tenants.category,
        createdAt: tenants.createdAt,
        subStatus: tenantSubscriptions.status,
        trialEndsAt: tenantSubscriptions.trialEndsAt,
      })
      .from(tenants)
      .leftJoin(tenantSubscriptions, eq(tenantSubscriptions.tenantId, tenants.id))
      .where(and(
        lt(tenants.createdAt, cutoff),
        eq(tenants.isDemo, false),
        // The stuck condition: hours were never confirmed.
        sql`NOT EXISTS (
          SELECT 1 FROM activation_events ae
          WHERE ae.tenant_id = tenants.id AND ae.event = 'hours_confirmed'
        )`,
      ))
      .all();

    // Last completed step from each tenant's activation events (one batched
    // query — N+1 law).
    const ids = rows.map((r) => r.id);
    let events: Array<{ tenantId: string | null; event: string }> = [];
    if (ids.length > 0) {
      events = await db.select({ tenantId: activationEvents.tenantId, event: activationEvents.event })
        .from(activationEvents)
        .where(inArray(activationEvents.tenantId, ids))
        .all();
    }
    const STAGE_RANK: Record<string, number> = {
      site_generated: 1, hours_confirmed: 2, site_shared: 3,
      first_booking: 4, first_invoice_paid: 5,
    };
    const lastStepByTenant = new Map<string, string>();
    for (const e of events) {
      if (!e.tenantId) continue;
      const prev = lastStepByTenant.get(e.tenantId);
      const rank = STAGE_RANK[e.event] ?? 0;
      if (prev == null || (STAGE_RANK[prev] ?? 0) < rank) lastStepByTenant.set(e.tenantId, e.event);
    }

    const list = rows
      .map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        category: r.category,
        registeredAt: r.createdAt,
        lastStep: lastStepByTenant.get(r.id) ?? null,
        trialDaysLeft: typeof r.trialEndsAt === 'number'
          ? Math.max(0, Math.ceil((r.trialEndsAt - now) / DAY))
          : null,
        subStatus: r.subStatus,
      }))
      .sort((a, b) => {
        const aNull = a.trialDaysLeft == null ? 1 : 0;
        const bNull = b.trialDaysLeft == null ? 1 : 0;
        if (aNull !== bNull) return aNull - bNull;
        return (a.trialDaysLeft ?? Infinity) - (b.trialDaysLeft ?? Infinity);
      });

    res.json(list);
  } catch (error) {
    console.error('admin stuck-tenants error:', error);
    res.status(500).json({ error: 'Failed to fetch stuck tenants' });
  }
});

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

    // P2.5 reopen (C3) / T4.5: the demo + all seeded fictional tenants'
    // plausible activity must not flatter the north-star or churn numbers the
    // council reviews — structural is_demo exclusion, not a single slug.
    const demoIds = await getDemoTenantIds();
    const funnelEventRows = excludeDemoRows(eventRows, demoIds);
    const funnelBookingRows = excludeDemoRows(bookingRows, demoIds);
    const funnelSubRows = excludeDemoRows(subRows, demoIds);

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

/**
 * GET /api/admin/winback-leads (T4.8 v1)
 *
 * The warmest merchant list that exists: tenants that SAW the price ladder
 * (price_seen) but never started a checkout (no checkout_started). Already-
 * offered tenants (winback_offer_sent) are excluded so the operator can
 * re-scan safely. Read-only segmentation — the beacons stay side-effect-free.
 */
router.get('/winback-leads', async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        category: tenants.category,
        createdAt: tenants.createdAt,
        ownerPhone: sql<string>`(SELECT u.phone FROM users u WHERE u.tenant_id = tenants.id AND u.role = 'owner' LIMIT 1)`,
      })
      .from(tenants)
      .where(and(
        eq(tenants.isDemo, false),
        sql`EXISTS (SELECT 1 FROM activation_events ae WHERE ae.tenant_id = tenants.id AND ae.event = 'price_seen')`,
        sql`NOT EXISTS (SELECT 1 FROM activation_events ae2 WHERE ae2.tenant_id = tenants.id AND ae2.event = 'checkout_started')`,
        sql`NOT EXISTS (SELECT 1 FROM activation_events ae3 WHERE ae3.tenant_id = tenants.id AND ae3.event = 'winback_offer_sent')`,
      ))
      .orderBy(desc(tenants.createdAt))
      .all();

    // price_seen timestamps (batched, one query) so the list shows recency.
    const ids = rows.map((r) => r.id);
    let seenAtByTenant = new Map<string, number>();
    if (ids.length > 0) {
      const events = await db.select({ tenantId: activationEvents.tenantId, createdAt: activationEvents.createdAt })
        .from(activationEvents)
        .where(and(inArray(activationEvents.tenantId, ids), eq(activationEvents.event, 'price_seen')))
        .all();
      for (const e of events) {
        if (!e.tenantId) continue;
        const prev = seenAtByTenant.get(e.tenantId);
        if (prev == null || e.createdAt > prev) seenAtByTenant.set(e.tenantId, e.createdAt);
      }
    }

    const now = Date.now();
    const list = rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      category: r.category,
      registeredAt: r.createdAt,
      priceSeenAt: seenAtByTenant.get(r.id) ?? null,
      daysSincePriceSeen: seenAtByTenant.has(r.id)
        ? Math.max(0, Math.floor((now - seenAtByTenant.get(r.id)!) / (24 * 60 * 60 * 1000)))
        : null,
      // Superadmin-only surface; mask on the wire, use raw server-side on send.
      ownerPhoneMasked: r.ownerPhone ? `${r.ownerPhone.slice(0, 7)}****` : null,
    }));

    res.json(list);
  } catch (error) {
    console.error('admin winback-leads error:', error);
    res.status(500).json({ error: 'Failed to fetch winback leads' });
  }
});

/**
 * POST /api/admin/winback-leads/:tenantId/offer (T4.8 v1)
 *
 * Generate a founder-discount promo code for one lead and send it through the
 * EXISTING blast machinery (promo_codes + the notify adapter, the same path
 * runWinbackAutomations uses). Re-qualifies on every call so a stale lead
 * can't get an offer twice. Delivery requires real SMS (T1.1); the offer is
 * recorded regardless so re-runs never spam duplicate codes.
 */
router.post('/winback-leads/:tenantId/offer', async (req, res) => {
  const tenantId = String(req.params.tenantId || '');
  try {
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (tenant.isDemo) return res.status(409).json({ error: 'Demo tenants are not leads' });

    const events = await db.select({ event: activationEvents.event })
      .from(activationEvents).where(eq(activationEvents.tenantId, tenantId)).all();
    const has = (ev: string) => events.some((e) => e.event === ev);
    if (!has('price_seen')) return res.status(409).json({ error: 'Tenant never saw pricing' });
    if (has('checkout_started')) return res.status(409).json({ error: 'Tenant already reached checkout' });
    if (has('winback_offer_sent')) return res.status(409).json({ error: 'Offer already sent' });

    const owner = await db.select({ phone: users.phone, name: users.name })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.role, 'owner')))
      .get();
    if (!owner?.phone) return res.status(409).json({ error: 'No owner phone on file' });

    const now = Date.now();
    const code = `FOUNDER15-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    await db.insert(promoCodes).values({
      id: crypto.randomUUID(),
      tenantId,
      code,
      discountType: 'percent',
      discountValue: 15,
      maxUses: 1,
      usedCount: 0,
      isActive: true,
      validFrom: now,
      validUntil: now + 30 * 24 * 60 * 60 * 1000,
      createdAt: now,
    });

    // Amharic-first message through the existing notify adapter (T1.1 real
    // SMS required for actual delivery — the machinery is already in place).
    const link = `https://${tenant.slug}.egebeya.et`;
    const name = owner.name?.trim() || 'there';
    const text = `ሰላም ${name}፣ ጣቢያዎ ዝግጁ ነው! የመስራች ቅናሽ ${code} (15% off) ይጠቀሙ እና ዛሬ ይጀምሩ። ${link} / Hi ${name}, your site is ready! Use founder code ${code} for 15% off. Start today: ${link}`;

    let sent = false;
    let sendError: string | null = null;
    try {
      const outcome = await notify({
        channel: 'sms',
        template: 'winback',
        to: { phone: owner.phone },
        text,
        tenantId,
        refType: 'merchant',
        refId: tenantId,
      });
      sent = outcome.ok;
      if (!outcome.ok) sendError = outcome.error || 'send failed';
    } catch (err: any) {
      sendError = err?.message || 'send failed';
    }

    // Idempotency beacon — the offer exists either way; a retry would spam a
    // second code, so it is recorded as sent regardless of SMS delivery.
    trackEvent(tenantId, 'winback_offer_sent', { code, sent });

    if (!sent) {
      return res.json({ ok: false, code, error: sendError ?? 'SMS delivery failed (T1.1 must be live)' });
    }
    res.json({ ok: true, code });
  } catch (error) {
    console.error('admin winback offer error:', error);
    res.status(500).json({ error: 'Failed to send winback offer' });
  }
});

/**
 * GET /api/admin/reports — platform-direct moderation queue (Wayfinder #14).
 * ?status=open|actioned|dismissed (default: open). Joined with the reported
 * merchant for one-glance review. Stated SLA: review within 7 days.
 */
router.get('/reports', async (req, res) => {
  try {
    const status = ['open', 'actioned', 'dismissed'].includes(String(req.query.status))
      ? String(req.query.status)
      : 'open';
    const rows = await db
      .select({
        id: contentReports.id,
        tenantId: contentReports.tenantId,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
        reporterPhone: contentReports.reporterPhone,
        reason: contentReports.reason,
        details: contentReports.details,
        status: contentReports.status,
        resolutionNote: contentReports.resolutionNote,
        createdAt: contentReports.createdAt,
        resolvedAt: contentReports.resolvedAt,
      })
      .from(contentReports)
      .leftJoin(tenants, eq(tenants.id, contentReports.tenantId))
      .where(eq(contentReports.status, status))
      .orderBy(desc(contentReports.createdAt))
      .limit(200)
      .all();
    res.json(rows);
  } catch (error) {
    console.error('admin reports list error:', error);
    res.status(500).json({ error: 'Failed to list reports' });
  }
});

/**
 * PATCH /api/admin/reports/:id — resolve a report (actioned | dismissed).
 */
router.patch('/reports/:id', adminWriteLimiter, async (req, res) => {
  try {
    const id = String(req.params.id || '');
    const status = String(req.body?.status || '');
    if (!['actioned', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'status must be actioned or dismissed' });
    }
    const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 1000) : null;
    const updated = await db
      .update(contentReports)
      .set({ status, resolutionNote: note, resolvedAt: Date.now() })
      .where(eq(contentReports.id, id))
      .returning({ id: contentReports.id });
    if (updated.length === 0) return res.status(404).json({ error: 'Report not found' });
    res.json({ ok: true });
  } catch (error) {
    console.error('admin report resolve error:', error);
    res.status(500).json({ error: 'Failed to resolve report' });
  }
});

export default router;
