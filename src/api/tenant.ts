import { Router } from 'express';
import { db } from '../db';
import bcrypt from 'bcryptjs';
import {
  pages,
  tenantSubscriptions,
  plans,
  tenants,
  staff,
  services as servicesTable,
  staffServices,
  staffAvailability,
  tenantBusinessHours,
  media,
  users,
  passwordResets,
  payments,
  appointments,
  customerStats,
  promoCodes,
  appointmentServices,
  recurringSeries,
  inventoryItems,
  invoices,
  activationEvents,
} from '../db/schema';
import { eq, and, inArray, desc, sql, gte, lt, lte, or, isNull } from 'drizzle-orm';
import crypto from 'crypto';
import { z } from 'zod';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { requirePlanLimit, requireActiveSubscription } from '../../server/middleware/planLimits';
import { createCheckout, generateTxRef } from '../../server/lib/chapa';
import { deleteTenantAccount } from '../../server/lib/accountDeletion';
import {
  PRO_PLAN_PRICE_BIRR,
  GRACE_PERIOD_MS,
  billingStateFor,
  resolvePriceForTenant,
  countFoundingCohort,
  priceForCycle,
  SUPPORTED_CYCLE_DAYS,
  FOUNDING_RATE_CAP,
} from '../../server/lib/billing';
import type { CycleDays } from '../../server/lib/billing';
import { getOrCreateProPlan } from '../../server/lib/plans';
import { resolveMediaUrl } from '../../server/lib/mediaUrls';
import { requireAuth } from './middleware/auth';
import { buildTemplatePage, templateForCategory, TEMPLATE_BUSINESS_HOURS } from '../../server/lib/siteTemplates';
import { validateBlockDoc, migrateBlockDoc } from '../lib/blocks/schema';
import tenantDashboardRoutes from '../../server/api/tenantRoute';
import { csrfProtection } from './middleware/csrf';
import { tenantWriteLimiter, uploadLimiter } from '../../server/middleware/rateLimiter';
import { normalizePhone } from '../lib/phone';
import { trackEvent, quietHoursConfigOf } from '../../server/lib/analytics';
import { shareLinkFor } from './site-generator';
import {
  getAddisDayOfWeek,
  parseAddisDate,
  formatAddisSlotTime,
  getAddisDateString,
  formatEthiopianDateCompact,
} from '../../server/lib/timezone';
import { logSecurityEvent, ipFromRequest } from '../../server/lib/securityLog';
import { toGregorian } from 'ethiopian-date';

const router = Router();

const uploadDir = path.join(process.cwd(), 'dist', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const tenantDir = (tenantId: string) => {
  const dir = path.join(uploadDir, tenantId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images are allowed'));
  }
});

// Owner-only auth gate (cookie or Bearer) with tokenVersion revocation, then
// CSRF protection for cookie-authenticated mutations, then write throttling.
router.use('/dashboard', tenantDashboardRoutes);
router.use(requireAuth({ roles: ['owner'] }));
router.use(csrfProtection);
router.use(tenantWriteLimiter);



router.post('/staff', requirePlanLimit('staff'), async (req, res) => {
  const { tenantId } = (req as any).user;
  const { name, title, bio, imagePath, userId } = req.body;

  if (!name || String(name).trim().length === 0) {
    return res.status(400).json({ error: 'Staff name is required' });
  }

  const staffId = crypto.randomUUID();
  await db.insert(staff).values({
    id: staffId,
    tenantId,
    userId: userId ?? null,
    name: String(name).trim(),
    title: title ?? null,
    bio: bio ?? null,
    imagePath: imagePath ?? null,
    active: true,
  });
  const created = await db.select().from(staff).where(eq(staff.id, staffId)).get();
  res.status(201).json(created);
});

// ---- Staff CRUD ----

// POST /staff/invite — create a staff login for a staff member. The owner
// supplies the staff's name + phone; the backend creates the `users` row with
// a random password and returns a one-time password-reset link to share.
router.post('/staff/invite', requirePlanLimit('staff'), async (req, res) => {
  const { tenantId } = (req as any).user;
  const { name, phone, email, staff_id } = req.body || {};

  if (!name || String(name).trim().length === 0) {
    return res.status(400).json({ error: 'Staff name is required' });
  }
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ error: 'Enter a valid Ethiopian phone number (+251XXXXXXXXX)' });
  }
  if (email !== undefined && email !== null && email !== '') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
  }

  try {
    const existingUser = await db.select().from(users).where(eq(users.phone, normalizedPhone)).get();
    if (existingUser) {
      return res.status(409).json({ error: 'A user with this phone number already exists' });
    }

    let staffRow: any = null;
    if (staff_id) {
      staffRow = await db.select().from(staff)
        .where(and(eq(staff.id, staff_id), eq(staff.tenantId, tenantId))).get();
      if (!staffRow) return res.status(404).json({ error: 'Staff not found for this tenant' });
    }

    const tempPassword = crypto.randomBytes(18).toString('base64url');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      tenantId,
      name: String(name).trim(),
      phone: normalizedPhone,
      email: email ? String(email).trim().toLowerCase() : null,
      passwordHash,
      role: 'staff',
      createdAt: Date.now(),
    });

    if (staffRow) {
      await db.update(staff).set({ userId }).where(eq(staff.id, staffRow.id));
    } else {
      const newStaffId = crypto.randomUUID();
      await db.insert(staff).values({
        id: newStaffId,
        tenantId,
        userId,
        name: String(name).trim(),
        title: null,
        bio: null,
        imagePath: null,
        active: true,
      });
    }

    // S-2: hash at rest — the raw token lives only in the one-time link.
    const resetToken = crypto.randomUUID();
    const resetTokenHash = crypto.createHash('sha256').update(resetToken, 'utf8').digest('hex');
    await db.insert(passwordResets).values({
      id: crypto.randomUUID(),
      token: resetTokenHash,
      userId,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    res.status(201).json({
      success: true,
      userId,
      staffId: staffRow?.id ?? null,
      resetUrl,
    });
  } catch (error) {
    console.error('Invite staff error:', error);
    res.status(500).json({ error: 'Failed to invite staff' });
  }
});

router.put('/staff/:id', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { id } = req.params;
  const { name, title, bio, imagePath, active } = req.body;

  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ error: 'name cannot be empty' });
  }

  try {
    const owned = await db.select({ id: staff.id }).from(staff)
      .where(and(eq(staff.id, id), eq(staff.tenantId, tenantId))).get();
    if (!owned) return res.status(404).json({ error: 'Staff not found for this tenant' });

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (title !== undefined) updates.title = title ?? null;
    if (bio !== undefined) updates.bio = bio ?? null;
    if (imagePath !== undefined) updates.imagePath = imagePath ?? null;
    if (active !== undefined) updates.active = !!active;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    await db.update(staff).set(updates).where(eq(staff.id, id));
    const updated = await db.select().from(staff).where(eq(staff.id, id)).get();
    res.json(updated);
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ error: 'Failed to update staff' });
  }
});

router.delete('/staff/:id', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { id } = req.params;
  try {
    const owned = await db.select({ id: staff.id }).from(staff)
      .where(and(eq(staff.id, id), eq(staff.tenantId, tenantId))).get();
    if (!owned) return res.status(404).json({ error: 'Staff not found for this tenant' });

    // Clean up links + availability before removing the staff row.
    await db.delete(staffServices).where(eq(staffServices.staffId, id));
    await db.delete(staffAvailability).where(eq(staffAvailability.staffId, id));
    await db.delete(staff).where(eq(staff.id, id));
    res.json({ success: true, id });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({ error: 'Failed to delete staff' });
  }
});

router.get('/staff/:id/services', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { id } = req.params;
  try {
    const owned = await db.select({ id: staff.id }).from(staff)
      .where(and(eq(staff.id, id), eq(staff.tenantId, tenantId))).get();
    if (!owned) return res.status(404).json({ error: 'Staff not found for this tenant' });

    const links = await db.select().from(staffServices).where(eq(staffServices.staffId, id)).all();
    const serviceIds = links.map(l => l.serviceId);
    const rows = serviceIds.length
      ? await db.select().from(servicesTable)
          .where(and(eq(servicesTable.tenantId, tenantId), inArray(servicesTable.id, serviceIds))).all()
      : [];
    res.json(rows.map(s => ({ id: s.id, name: s.name })));
  } catch (error) {
    console.error('Fetch staff services error:', error);
    res.status(500).json({ error: 'Failed to fetch staff services' });
  }
});

router.get('/staff/:id/availability', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { id } = req.params;
  try {
    const owned = await db.select({ id: staff.id }).from(staff)
      .where(and(eq(staff.id, id), eq(staff.tenantId, tenantId))).get();
    if (!owned) return res.status(404).json({ error: 'Staff not found for this tenant' });

    const rows = await db.select().from(staffAvailability)
      .where(eq(staffAvailability.staffId, id)).all();
    res.json(rows.map(r => ({
      id: r.id,
      staffId: r.staffId,
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
    })));
  } catch (error) {
    console.error('Fetch staff availability error:', error);
    res.status(500).json({ error: 'Failed to fetch staff availability' });
  }
});
router.put('/business-hours', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { hours } = req.body as {
    hours: { dayOfWeek: number; openTime: string | null; closeTime: string | null; isClosed: boolean }[];
  };

  if (!Array.isArray(hours) || hours.length === 0) {
    return res.status(400).json({ error: 'hours must be a non-empty array' });
  }

  try {
    await db.delete(tenantBusinessHours).where(eq(tenantBusinessHours.tenantId, tenantId));
    await db.insert(tenantBusinessHours).values(
      hours.map((h) => ({
        id: crypto.randomUUID(),
        tenantId,
        dayOfWeek: h.dayOfWeek,
        openTime: h.isClosed ? null : (h.openTime ?? null),
        closeTime: h.isClosed ? null : (h.closeTime ?? null),
        isClosed: h.isClosed,
      }))
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Business hours error:', error);
    res.status(500).json({ error: 'Failed to save business hours' });
  }
});

router.post('/staff/:id/services', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { id } = req.params;
  const { service_ids } = req.body as { service_ids: string[] };
  if (!Array.isArray(service_ids)) {
    return res.status(400).json({ error: 'service_ids must be an array' });
  }
  try {
    // Ensure the staff belongs to this tenant.
    const staffRow = await db.select({ id: staff.id }).from(staff)
      .where(and(eq(staff.id, id), eq(staff.tenantId, tenantId))).get();
    if (!staffRow) return res.status(404).json({ error: 'Staff not found for this tenant' });

    // Validate that each provided id belongs to this tenant (skip the query
    // when there is nothing to validate — inArray requires a non-empty array).
    const owned = service_ids.length
      ? await db.select({ id: servicesTable.id }).from(servicesTable)
          .where(and(eq(servicesTable.tenantId, tenantId), inArray(servicesTable.id, service_ids))).all()
      : [];
    const ownedIds = new Set(owned.map(s => s.id));
    const validIds = service_ids.filter(sid => ownedIds.has(sid));

    // Replace: remove existing links, then insert the new set.
    await db.delete(staffServices).where(eq(staffServices.staffId, id));
    if (validIds.length > 0) {
      await db.insert(staffServices).values(validIds.map(serviceId => ({ staffId: id, serviceId })));
    }
    res.json({ success: true, assigned: validIds });
  } catch (error) {
    console.error('Assign services error:', error);
    res.status(500).json({ error: 'Failed to assign services' });
  }
});

router.put('/staff/:id/availability', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { id } = req.params;
  const { availability } = req.body as {
    availability: { dayOfWeek: number; startTime: string; endTime: string }[]
  };
  if (!Array.isArray(availability)) {
    return res.status(400).json({ error: 'availability must be an array' });
  }
  try {
    const owned = await db.select({ id: staff.id }).from(staff)
      .where(and(eq(staff.id, id), eq(staff.tenantId, tenantId))).get();
    if (!owned) return res.status(404).json({ error: 'Staff not found for this tenant' });

    await db.delete(staffAvailability).where(eq(staffAvailability.staffId, id));
    if (availability.length > 0) {
      await db.insert(staffAvailability).values(
        availability.map(a => ({
          id: crypto.randomUUID(),
          staffId: id,
          dayOfWeek: a.dayOfWeek,
          startTime: a.startTime,
          endTime: a.endTime,
        }))
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Staff availability error:', error);
    res.status(500).json({ error: 'Failed to set availability' });
  }
});

router.put('/domain', requireActiveSubscription, async (req, res) => {
  const plan = (req as any).plan;
  if (!plan.customDomainAllowed) {
    return res.status(403).json({ error: 'Custom domains require the Pro plan', code: 'PLAN_REQUIRED' });
  }

  const { domain } = req.body || {};
  if (!domain && domain !== '') {
    return res.status(400).json({ error: 'domain is required, pass empty string to clear' });
  }
  if (typeof domain !== 'string') {
    return res.status(400).json({ error: 'domain must be a string' });
  }
  const trimmed = domain.trim().toLowerCase();

  if (trimmed === '') {
    const tenantId = (req as any).user.tenantId;
    await db.update(tenants).set({ domain: null }).where(eq(tenants.id, tenantId));
    return res.json({ success: true, domain: null });
  }

  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(trimmed)) {
    return res.status(400).json({ error: 'Invalid domain format' });
  }

  const reserved = new Set([
    'egebeya.et', 'egebeya.test', 'egebeya.com', 'localhost',
    'example.com', 'example.org', 'example.net',
  ]);
  const suffix = trimmed.split('.').slice(-2).join('.');
  if (reserved.has(suffix) || reserved.has(trimmed)) {
    return res.status(400).json({ error: 'This domain suffix is reserved' });
  }

const conflict = await db.select().from(tenants).where(eq(tenants.domain, trimmed)).get();
if (conflict && conflict.id !== (req as any).user.tenantId) {
  return res.status(409).json({ error: 'This domain is already mapped to another tenant' });
}

const tenantId = (req as any).user.tenantId;
await db.update(tenants).set({ domain: trimmed }).where(eq(tenants.id, tenantId));
res.json({ success: true, domain: trimmed });
});

router.get('/analytics', requireAuth({ roles: ['owner'] }), async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const now = Date.now();
    const utcNow = new Date(now);
    const utcTodayStart = Date.UTC(utcNow.getUTCFullYear(), utcNow.getUTCMonth(), utcNow.getUTCDate());
    const DAY_MS = 86400000;
    const windowStart = utcTodayStart - 6 * DAY_MS;

    let totalRevenue = 0;
    let totalBookings = 0;
    const serviceCounts = new Map<string, number>();
    const customerTotalBookings = new Map<string, number>();
    let repeatCustomerCount = 0;
    const daily: { date: string; bookingCount: number; revenue: number }[] = [];

    for (let i = 0; i < 7; i++) {
      const dayStart = windowStart + i * DAY_MS;
      const dayEnd = dayStart + DAY_MS;

      const [revRow, cntRow, svcRows, custRows] = await Promise.all([
        db.select({ total: sql<number>`COALESCE(SUM(payments.amount), 0)` })
          .from(payments)
          .innerJoin(appointments, eq(payments.appointmentId, appointments.id))
          .where(and(
            eq(appointments.tenantId, tenantId),
            eq(payments.status, 'completed'),
            gte(appointments.startTime, dayStart),
            lt(appointments.startTime, dayEnd),
          )),
        db.select({ n: sql<number>`count(*)` })
          .from(appointments)
          .where(and(
            eq(appointments.tenantId, tenantId),
            gte(appointments.startTime, dayStart),
            lt(appointments.startTime, dayEnd),
          )),
        db.select({ serviceId: appointments.serviceId, n: sql<number>`count(*)` })
          .from(appointments)
          .where(and(
            eq(appointments.tenantId, tenantId),
            gte(appointments.startTime, dayStart),
            lt(appointments.startTime, dayEnd),
          ))
          .groupBy(appointments.serviceId),
        db.select({ customerPhone: appointments.customerPhone, n: sql<number>`count(*)` })
          .from(appointments)
          .where(and(
            eq(appointments.tenantId, tenantId),
            gte(appointments.startTime, dayStart),
            lt(appointments.startTime, dayEnd),
          ))
          .groupBy(appointments.customerPhone),
      ]);

      const dateKey = new Date(dayStart).toISOString().slice(0, 10);
      const dayRev = Number(revRow[0]?.total ?? 0);
      const dayCnt = Number(cntRow[0]?.n ?? 0);
      daily.push({ date: dateKey, bookingCount: dayCnt, revenue: dayRev });
      totalRevenue += dayRev;
      totalBookings += dayCnt;

      for (const s of svcRows) serviceCounts.set(s.serviceId, (serviceCounts.get(s.serviceId) ?? 0) + Number(s.n));
      for (const c of custRows) customerTotalBookings.set(c.customerPhone, (customerTotalBookings.get(c.customerPhone) ?? 0) + Number(c.n));
    }

    for (const n of customerTotalBookings.values()) if (n >= 2) repeatCustomerCount++;

    const todayEstimateRow = await db.select({ n: sql<number>`count(*)` })
      .from(appointments)
      .where(and(
        eq(appointments.tenantId, tenantId),
        or(eq(appointments.status, 'confirmed'), eq(appointments.status, 'pending')),
        gte(appointments.startTime, utcTodayStart),
      ))
      .get();
    const todayEstimate = Number(todayEstimateRow?.n ?? 0);

    const topServices = [...serviceCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([serviceId, bookings]) => ({ serviceId, bookings }));

    res.json({
      period: '7d',
      totalRevenue,
      totalBookings,
      daily,
      topServices,
      repeatCustomerCount,
      todayEstimate,
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

router.get('/subscription', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const subscription = await db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    if (!subscription) return res.status(404).json({ error: 'Subscription not found' });
    const plan = await db.select().from(plans).where(eq(plans.id, subscription.planId!)).get();
    const staffList = await db.select().from(staff).where(eq(staff.tenantId, tenantId)).all();

    // P1.3 price-ladder context.
    const pricing = await resolvePriceForTenant(tenantId);
    const tenantRow = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();

    // Value-frame stat: bookings confirmed in the last 30 days ("በዚህ ወር N ቀጠሮዎች").
    const monthAgo = Date.now() - 30 * 24 * 3600 * 1000;
    const bookingsRow = await db.select({ n: sql<number>`count(*)` })
      .from(appointments)
      .where(and(
        eq(appointments.tenantId, tenantId),
        or(eq(appointments.status, 'confirmed'), eq(appointments.status, 'completed')),
        gte(appointments.startTime, monthAgo),
      ))
      .get();
    const monthlyBookings = Number(bookingsRow?.n ?? 0);

    // A recent unpaid Pro checkout → "payment pending" state on the Billing page.
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    const pendingRow = await db.select({ id: payments.id })
      .from(payments)
      .where(and(
        eq(payments.tenantId, tenantId),
        eq(payments.status, 'pending'),
        sql`json_extract(${payments.meta}, '$.purpose') = 'pro_subscription'`,
        gte(payments.createdAt, dayAgo),
      ))
      .get();
    const pendingCheckout = pendingRow != null;

    res.json({
      subscription,
      plan,
      staffUsage: staffList.length,
      billing: {
        planName: plan?.name ?? null,
        priceEtbPerMonth: PRO_PLAN_PRICE_BIRR,
        state: billingStateFor({
          status: subscription.status,
          endsAt: subscription.endsAt ?? null,
          planName: plan?.name ?? null,
        }),
        graceEndsAt: typeof subscription.endsAt === 'number'
          ? subscription.endsAt + GRACE_PERIOD_MS
          : null,
        renewRequired: typeof subscription.endsAt === 'number' && subscription.endsAt <= Date.now(),
        isFoundingRate: pricing.isFoundingRate,
        foundingRateLockedUntil: typeof tenantRow?.foundingRateLockedUntil === 'number'
          ? tenantRow.foundingRateLockedUntil
          : null,
        monthlyBookings,
        pendingCheckout,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

/**
 * POST /api/tenant/subscription/checkout — owner-only.
 *
 * Starts a Chapa-hosted checkout for a 30-day Pro subscription (500 ETB),
 * records a 'pending' payment row (identified by meta.purpose =
 * 'pro_subscription'), and returns the checkout URL the owner is sent to.
 * Completion is confirmed by the Chapa webhook (see src/api/payments.ts),
 * which flips the tenant's subscription to active with endsAt = +30 days.
 */
router.post('/subscription/checkout', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    // Self-healing: create the canonical 'pro' row if a fresh DB never seeded
    // it (previously a missing row returned 500 "Pro plan is not configured").
    const proPlan = await getOrCreateProPlan();

    const owner = await db.select().from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.role, 'owner')))
      .get();

    // P1.5 prepay cycle: 30 (standard) | 90 (5% off) | 365 (founding 10-for-12).
    const requestedCycle = Number(req.body?.cycle ?? 30);
    if (!(SUPPORTED_CYCLE_DAYS as readonly number[]).includes(requestedCycle)) {
      return res.status(400).json({ error: `cycle must be one of ${SUPPORTED_CYCLE_DAYS.join(', ')} days` });
    }
    const cycleDays = requestedCycle as CycleDays;

    // The annual 10-for-12 offer exists only while the founding cohort is
    // open — paying it locks the founding rate for 12 months.
    if (cycleDays === 365) {
      const othersInCohort = await countFoundingCohort(Date.now(), tenantId);
      if (othersInCohort >= FOUNDING_RATE_CAP) {
        return res.status(400).json({ error: 'Annual prepay is only available while the founding cohort is open' });
      }
    }

    // P1.1 pricing ladder: resolve list vs founding rate for this tenant.
    const pricing = await resolvePriceForTenant(tenantId);
    const amountCents = priceForCycle(pricing.amountCents, cycleDays);
    const amountBirr = String(Math.round(amountCents / 100));

    const txRef = generateTxRef('pro');
    const now = Date.now();

    // P3.5 pricing-funnel: the owner reached a live checkout.
    trackEvent(tenantId, 'checkout_started', { cycleDays, isFoundingRate: pricing.isFoundingRate });

    const checkout = await createCheckout({
      amountBirr,
      txRef,
      firstName: owner?.name?.split(' ')[0] || 'Egebeya',
      lastName: owner?.name?.split(' ').slice(1).join(' ') || undefined,
      email: owner?.email,
      phone: owner?.phone,
      returnUrl: `${req.protocol}://${req.get('host') || 'egebeya.et'}/dashboard/billing`,
    });

    await db.insert(payments).values({
      id: crypto.randomUUID(),
      tenantId,
      amount: amountCents, // ETB cents
      gateway: 'chapa',
      method: 'checkout',
      gatewayReference: txRef,
      status: 'pending',
      createdAt: now,
      meta: {
        purpose: 'pro_subscription',
        planId: proPlan.id,
        product: `pro-${cycleDays}d`,
        cycleDays,
        isFoundingRate: pricing.isFoundingRate,
      },
    });

    res.json({
      success: true,
      checkoutUrl: checkout.checkoutUrl,
      txRef,
      amountEtb: amountBirr,
      amountCents,
      cycleDays,
      isFoundingRate: pricing.isFoundingRate,
      plan: { id: proPlan.id, name: proPlan.name, price: proPlan.price },
      expiresAt: now,
    });
  } catch (error: any) {
    console.error('Subscription checkout error:', error?.message || error);
    // P3.5 pricing-funnel: a checkout that dies before Chapa even returns a
    // URL is the one abandonment signal we can record server-side. (Silent
    // drop-offs after redirect are derived in funnel math from
    // checkout_started rows that never meet a first_invoice_paid.)
    trackEvent((req as any)?.user?.tenantId ?? null, 'checkout_abandoned', {
      reason: 'checkout_error',
      message: String(error?.message || '').slice(0, 200),
    });
    res.status(502).json({ error: 'Failed to start checkout. Please try again.' });
  }
});

// ---- Invoices & receipts (P1.2) ----

/**
 * GET /api/tenant/invoices — owner-only. Lists the tenant's subscription
 * invoices, newest first.
 */
router.get('/invoices', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const rows = await db.select().from(invoices)
      .where(eq(invoices.tenantId, tenantId))
      .orderBy(desc(invoices.issuedAt));
    res.json({ success: true, invoices: rows });
  } catch (error) {
    console.error('List invoices error:', error);
    res.status(500).json({ error: 'Failed to list invoices' });
  }
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * GET /api/tenant/invoices/:id/receipt — owner-only printable receipt HTML.
 * Amharic-first labels ("ደረሰኝ") with English subtitles, business name and
 * ETB amounts — clean enough to hand to an accountant or print for PLC books.
 */
router.get('/invoices/:id/receipt', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const invoice = await db.select().from(invoices)
      .where(and(eq(invoices.id, req.params.id), eq(invoices.tenantId, tenantId)))
      .get();
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    const businessName = tenant?.name ?? 'Egebeya';

    const amountEtb = (invoice.amount / 100).toFixed(2);
    const fmtDate = (ms: number | null) =>
      typeof ms === 'number' ? new Date(ms).toISOString().slice(0, 10) : '—';
    const statusLabels: Record<string, { am: string; en: string; color: string }> = {
      paid: { am: 'ተከፍሏል', en: 'Paid', color: '#0FA958' },
      draft: { am: 'በመጠባበቅ ላይ', en: 'Draft', color: '#B4552D' },
      void: { am: 'ተሰርዟል', en: 'Void', color: '#D64545' },
    };
    const statusLabel = statusLabels[invoice.status] ?? { am: invoice.status, en: invoice.status, color: '#1A1411' };

    const html = `<!doctype html>
<html lang="am">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ደረሰኝ ${escapeHtml(invoice.number)}</title>
<style>
  body { font-family: 'Noto Sans Ethiopic', Inter, system-ui, sans-serif; background: #F7F1E3; color: #1A1411; margin: 0; padding: 24px; line-height: 1.65; }
  .receipt { max-width: 560px; margin: 0 auto; background: #fff; border: 1px solid #1A1411; padding: 32px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  .sub { font-size: 13px; opacity: .7; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  td { padding: 8px 0; border-bottom: 1px solid #e0d8c8; vertical-align: top; }
  td.label { font-weight: 600; width: 45%; }
  .amount { font-size: 28px; font-weight: 700; }
  .status { display: inline-block; border: 1px solid ${statusLabel.color}; color: ${statusLabel.color}; padding: 2px 10px; font-size: 13px; margin-top: 12px; }
  @media print { body { background: #fff; padding: 0; } .receipt { border: none; } }
</style>
</head>
<body>
<div class="receipt">
  <h1>ደረሰኝ · Receipt</h1>
  <div class="sub">${escapeHtml(businessName)} · Egebeya</div>
  <span class="status">${escapeHtml(statusLabel.am)} · ${escapeHtml(statusLabel.en)}</span>
  <table>
    <tr><td class="label">የደረሰኝ ቁጥር · Invoice no.</td><td>${escapeHtml(invoice.number)}</td></tr>
    <tr><td class="label">መጠን · Amount</td><td class="amount">${amountEtb} ${escapeHtml(invoice.currency)}</td></tr>
    <tr><td class="label">የክፍያ ጊዜ · Billing period</td><td>${fmtDate(invoice.periodStart)} – ${fmtDate(invoice.periodEnd)}</td></tr>
    <tr><td class="label">የተነሳበት ቀን · Issued</td><td>${fmtDate(invoice.issuedAt)}</td></tr>
    <tr><td class="label">የተከፈለበት ቀን · Paid on</td><td>${fmtDate(invoice.paidAt)}</td></tr>
    <tr><td class="label">የክፍያ ማጣቀሻ · Tx reference</td><td>${escapeHtml(invoice.chapaTxRef ?? '—')}</td></tr>
  </table>
  <p class="sub" style="margin-top:24px;">ይህ ደረሰኝ በ Chapa በኩል የተከፈለ የ Egebeya Pro ክፍያ ማረጋገጫ ነው። This receipt confirms a Pro subscription payment collected through Chapa.</p>
</div>
</body>
</html>`;
    res.type('html').send(html);
  } catch (error) {
    console.error('Receipt render error:', error);
    res.status(500).json({ error: 'Failed to render receipt' });
  }
});

// ---- Instant Empire provisioning pipeline (P2.3) ----

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Idempotency helper: a page row counts as "generated" only when it holds a
 * non-empty block document. Wizard-built pages count — provisioning never
 * overwrites real work.
 */
async function pageHasContent(tenantId: string): Promise<boolean> {
  const page = await db.select().from(pages).where(eq(pages.tenantId, tenantId)).get();
  if (!page?.content) return false;
  const check = validateBlockDoc(page.content);
  return check.ok && (check.doc?.content.length ?? 0) > 0;
}

/**
 * POST /api/tenant/provision — owner-only. The "generation" behind Instant
 * Empire: given business name + category, materialize a full draft site in
 * one call — block page from the category template pack, default services,
 * owner-as-first-staff with availability, and business hours.
 *
 * Every step is guarded by an existence check, so a crash mid-provision is
 * recoverable: re-running completes ONLY the missing pieces. The site stays
 * dark (unlisted + hours unconfirmed) until the owner confirms hours once
 * (see /provision/confirm-hours, P2.6).
 */
router.post('/provision', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const settings = { ...(tenant.settings as any || {}) };
    const onboarding = { ...(settings.onboarding || {}) };

    // Category: explicit body wins, else existing tenant.category, else Other.
    const requestedCategory = typeof req.body?.category === 'string' ? req.body.category.trim() : '';
    const packCategory = templateForCategory(requestedCategory || tenant.category).category;
    const businessName = typeof req.body?.businessName === 'string' && req.body.businessName.trim()
      ? req.body.businessName.trim().slice(0, 120)
      : tenant.name;

    const steps: Record<string, boolean> = {};

    // Step 1 — page content from the template pack (never overwrites work).
    if (!(await pageHasContent(tenantId))) {
      const doc = buildTemplatePage(businessName, packCategory);
      await db.insert(pages)
        .values({ tenantId, content: doc })
        .onConflictDoUpdate({ target: pages.tenantId, set: { content: doc } });
      steps.page = true;
    } else {
      steps.page = false; // already present
    }

    // Step 2 — default service(s) only when the tenant has none yet.
    const existingServices = await db.select({ id: servicesTable.id })
      .from(servicesTable).where(eq(servicesTable.tenantId, tenantId)).all();
    if (existingServices.length === 0) {
      // Single batched insert — no per-row queries inside a loop (N+1 law).
      const pack = templateForCategory(packCategory);
      await db.insert(servicesTable).values(
        pack.defaultServices.map((svc) => ({
          id: crypto.randomUUID(),
          tenantId,
          name: svc.name,
          durationMinutes: svc.durationMinutes,
          price: svc.price,
          active: true as const,
        })),
      );
      steps.services = true;
    } else {
      steps.services = false;
    }

    // Step 3 — owner-as-first-staff + default availability.
    const existingStaff = await db.select({ id: staff.id }).from(staff)
      .where(eq(staff.tenantId, tenantId)).all();
    if (existingStaff.length === 0) {
      const ownerUser = await db.select().from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.role, 'owner')))
        .get();
      const staffId = crypto.randomUUID();
      await db.insert(staff).values({
        id: staffId,
        tenantId,
        userId: ownerUser?.id ?? null,
        name: ownerUser?.name || businessName,
        title: 'Owner',
        active: true,
      });
      await db.insert(staffAvailability).values(
        [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
          id: crypto.randomUUID(),
          staffId,
          dayOfWeek,
          startTime: '09:00',
          endTime: '18:00',
        })),
      );
      steps.staff = true;
    } else {
      steps.staff = false;
    }

    // Step 4 — business hours rows (Mon–Sat 09:00–18:00, Sunday closed).
    const existingHours = await db.select({ id: tenantBusinessHours.id })
      .from(tenantBusinessHours).where(eq(tenantBusinessHours.tenantId, tenantId)).all();
    if (existingHours.length === 0) {
      await db.insert(tenantBusinessHours).values(
        TEMPLATE_BUSINESS_HOURS.map((h) => ({
          id: crypto.randomUUID(),
          tenantId,
          dayOfWeek: h.dayOfWeek,
          openTime: h.openTime,
          closeTime: h.closeTime,
          isClosed: h.isClosed,
        })),
      );
      steps.hours = true;
    } else {
      steps.hours = false;
    }

    // Stamp generation metadata (kept across re-runs).
    onboarding.generatedAt = onboarding.generatedAt ?? Date.now();
    settings.onboarding = onboarding;

    const updates: Record<string, any> = { settings };
    if (requestedCategory && requestedCategory !== tenant.category && templateForCategory(requestedCategory).category !== 'Other') {
      updates.category = requestedCategory;
    }
    if (businessName !== tenant.name && req.body?.businessName) {
      updates.name = businessName;
    }
    await db.update(tenants).set(updates).where(eq(tenants.id, tenantId));

    // P3.5: site_generated fires on the FIRST successful materialization
    // (idempotent re-runs that only backfill missing pieces still count as
    // generated once — the event is the funnel entry, not a usage counter).
    if (steps.page && !onboarding.siteGeneratedTracked) {
      trackEvent(tenantId, 'site_generated', { category: packCategory });
      onboarding.siteGeneratedTracked = true;
      settings.onboarding = onboarding;
      await db.update(tenants).set({ settings }).where(eq(tenants.id, tenantId));
    }

    res.json({
      success: true,
      provisioned: Object.values(steps).some(Boolean),
      steps,
      share: `/${tenant.slug}`,
    });
  } catch (error: any) {
    console.error('Provision error:', error?.message || error);
    res.status(500).json({ error: 'Failed to provision site' });
  }
});

/**
 * POST /api/tenant/provision/confirm-hours (P2.6 write side + P3.5 event)
 *
 * The one-time owner confirmation that the auto-generated hours are right.
 * Until this flips, provisioned sites stay dark (public.ts soft-landing).
 * Emits the `hours_confirmed` activation event exactly once.
 */
router.post('/provision/confirm-hours', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const settings = { ...(tenant.settings as any || {}) };
    const onboarding = { ...(settings.onboarding || {}) };
    const alreadyConfirmed = onboarding.confirmedHours === true;

    if (!alreadyConfirmed) {
      // Hours are "confirmed" in the sense of "I've seen and accepted them" —
      // edits after this point go through the normal business-hours routes.
      onboarding.confirmedHours = true;
      onboarding.confirmedHoursAt = Date.now();
      settings.onboarding = onboarding;
      await db.update(tenants).set({ settings }).where(eq(tenants.id, tenantId));
      trackEvent(tenantId, 'hours_confirmed');
    }

    res.json({ success: true, confirmedHours: true, already: alreadyConfirmed });
  } catch (error: any) {
    console.error('Confirm-hours error:', error?.message || error);
    res.status(500).json({ error: 'Failed to confirm hours' });
  }
});

// ---- Activation-event beacons (P3.5) ----

/**
 * POST /api/tenant/events/site-shared — owner beacon fired when the share
 * sheet is used (FirstShareHero / ShareSiteBar). Fire-and-forget from the
 * client; the server stamps it into activation_events.
 */
router.post('/events/site-shared', async (req, res) => {
  const { tenantId } = (req as any).user;
  trackEvent(tenantId, 'site_shared', { via: req.body?.via ?? null });
  res.json({ ok: true });
});

/**
 * POST /api/tenant/events/price-seen — owner beacon fired when the Billing
 * page renders the price ladder (elasticity input for the M9 hybrid arm).
 */
router.post('/events/price-seen', async (req, res) => {
  const { tenantId } = (req as any).user;
  trackEvent(tenantId, 'price_seen', {
    isFoundingRate: req.body?.isFoundingRate ?? null,
    amountEtb: typeof req.body?.amountEtb === 'number' ? req.body.amountEtb : null,
  });
  res.json({ ok: true });
});

/**
/**
 * GET /api/tenant/provision/status — honest staged progress for the signup
 * flow (no fake cinema): each step reports whether its artifacts exist.
 *
 * P2.4 reopen (A1): `generationComplete` separates "the GENERATION finished"
 * (all four provisioning artifacts exist) from "HOURS confirmed" (the P2.6
 * gate, which stays false until the owner acts). Signup Screen 3 advances to
 * the Share Hero on generationComplete alone — the hours item legitimately
 * remains pending and becomes the first item of the dashboard checklist.
 * Chosen over client-side filtering so every consumer of this endpoint shares
 * one definition of "generation done".
 */
router.get('/provision/status', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const settings = (tenant.settings as any) || {};
    const onboarding = settings.onboarding || {};
    const [servicesRows, staffRows, hoursRows] = await Promise.all([
      db.select({ n: sql<number>`count(*)` }).from(servicesTable).where(eq(servicesTable.tenantId, tenantId)).get(),
      db.select({ n: sql<number>`count(*)` }).from(staff).where(eq(staff.tenantId, tenantId)).get(),
      db.select({ n: sql<number>`count(*)` }).from(tenantBusinessHours).where(eq(tenantBusinessHours.tenantId, tenantId)).get(),
    ]);

    const pageDone = await pageHasContent(tenantId);
    const servicesDone = Number(servicesRows?.n ?? 0) > 0;
    const staffDone = Number(staffRows?.n ?? 0) > 0;
    const hoursDone = Number(hoursRows?.n ?? 0) > 0;

    res.json({
      generatedAt: onboarding.generatedAt ?? null,
      confirmedHours: onboarding.confirmedHours === true,
      sitePublic: tenant.isListed === true && onboarding.confirmedHours === true,
      // Generation = artifacts exist. Hours confirmation deliberately NOT
      // part of it (council ruling: mandatory human gate).
      generationComplete: pageDone && servicesDone && staffDone && hoursDone,
      steps: [
        { step: 'page', done: pageDone },
        { step: 'services', done: servicesDone },
        { step: 'staff', done: staffDone },
        { step: 'hours', done: hoursDone },
        { step: 'hoursConfirmed', done: onboarding.confirmedHours === true },
      ],
    });
  } catch (error) {
    console.error('Provision status error:', error);
    res.status(500).json({ error: 'Failed to fetch provision status' });
  }
});


// ── P5.6 Quiet-hours discount flag ───────────────────────────────────────

/**
 * PUT /api/tenant/quiet-hours — boolean + badge, NO pricing engine (council
 * ruling): one toggle with a day-part window and a percent. Stored in the
 * tenant settings JSON per the audit-P0.4 convention.
 */
router.put('/quiet-hours', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const { enabled, startMinute, endMinute, percent } = req.body ?? {};
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }
    const sm = Number(startMinute); const em = Number(endMinute); const pc = Number(percent);
    for (const [label, v] of [['startMinute', sm], ['endMinute', em]] as const) {
      if (!Number.isInteger(v) || v < 0 || v >= 1440) {
        return res.status(400).json({ error: `${label} must be an integer minute-of-day (0-1439)` });
      }
    }
    if (!Number.isInteger(pc) || pc < 1 || pc > 90) {
      return res.status(400).json({ error: 'percent must be an integer between 1 and 90' });
    }

    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const settings = { ...(tenant.settings as any || {}) };
    settings.quiet_hours_discount = enabled
      ? { enabled: true, start_minute: sm, end_minute: em, percent: pc }
      : { enabled: false };
    await db.update(tenants).set({ settings }).where(eq(tenants.id, tenantId));

    res.json({ success: true, quietHoursDiscount: settings.quiet_hours_discount });
  } catch (error: any) {
    console.error('Quiet-hours save error:', error?.message || error);
    res.status(500).json({ error: 'Failed to save quiet hours' });
  }
});

/**
 * GET /api/tenant/quiet-hours/stats (T4.7)
 *
 * Read-only payoff card for the quiet-hours toggle: over the trailing 30-day
 * window, what share of the tenant's bookings landed inside the discounted
 * window. Numerator from the quiet_hours_booking events the public booking
 * flow already records; denominator from confirmed/completed appointments.
 * Honest nulls when there are no bookings or the toggle is off.
 */
router.get('/quiet-hours/stats', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const cfg = quietHoursConfigOf((tenant.settings as any) ?? null);

    const now = Date.now();
    const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
    const since = now - WINDOW_MS;

    const [totalRow, eventRows] = await Promise.all([
      db.select({ n: sql<number>`count(*)`.as('n') })
        .from(appointments)
        .where(and(
          eq(appointments.tenantId, tenantId),
          gte(appointments.startTime, since),
          or(eq(appointments.status, 'confirmed'), eq(appointments.status, 'completed')),
        ))
        .get(),
      db.select({ meta: activationEvents.meta, createdAt: activationEvents.createdAt })
        .from(activationEvents)
        .where(and(
          eq(activationEvents.tenantId, tenantId),
          eq(activationEvents.event, 'quiet_hours_booking'),
          gte(activationEvents.createdAt, since),
        ))
        .all(),
    ]);

    const inWindowEvents = eventRows.filter((e) => (e.meta as any)?.inWindow === true);
    const totalBookings = Number(totalRow?.n ?? 0);
    const quietBookings = eventRows.length;
    const inWindowBookings = inWindowEvents.length;

    res.json({
      enabled: cfg?.enabled === true,
      windowDays: 30,
      totalBookings,
      quietBookings,
      inWindowBookings,
      rate: totalBookings === 0 ? null : inWindowBookings / totalBookings,
      firstQuietEventAt: eventRows.length > 0 ? Math.min(...eventRows.map((e) => e.createdAt)) : null,
    });
  } catch (error: any) {
    console.error('quiet-hours stats error:', error?.message || error);
    res.status(500).json({ error: 'Failed to load quiet-hours stats' });
  }
});

router.get('/settings', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    // Spread column-level fields alongside the JSON settings blob so the
    // dashboard can show subdomain / business name without a second fetch.
    res.json({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      domain: tenant.domain,
      // #48 — the deck needs the real category to ask marketing-snippet for
      // a post; a plain column, same whitelist spirit as name/slug.
      category: tenant.category ?? null,
      ...(tenant.settings as any || {}),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/settings', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // `name` (and only name at the top level) maps to the tenants column.
    // `slug` is intentionally NOT writable here — changing it has cascading
    // effects on public links, bookings, and DNS that are out of scope.
    const { name, slug: _ignoredSlug, ...rest } = req.body || {};
    const trimmedName = typeof name === 'string' && name.trim().length > 0
      ? name.trim()
      : undefined;

    const newSettings = { ...(tenant.settings as any || {}), ...rest };

    const updates: Record<string, any> = { settings: newSettings };
    if (trimmedName !== undefined) updates.name = trimmedName;

    await db.update(tenants).set(updates).where(eq(tenants.id, tenantId));

    res.json({
      success: true,
      settings: {
        id: tenant.id,
        name: trimmedName ?? tenant.name,
        slug: tenant.slug,
        ...newSettings,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

router.get('/page', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const page = await db.select().from(pages).where(eq(pages.tenantId, tenantId)).get();
    res.json(page || {});
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch page' });
  }
});

router.put('/page', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { content } = req.body;
  try {
    // P5.3: every saved page must be a VALID block document. Legacy shapes
    // are migrated first (PascalCase types, missing version); anything still
    // failing validation is rejected with field-level errors instead of
    // poisoning the single source of truth.
    if (content && typeof content === 'object') {
      const migrated = migrateBlockDoc(content);
      const check = validateBlockDoc(migrated);
      if (!check.ok) {
        return res.status(422).json({ error: 'Invalid page document', issues: check.issues });
      }
    }

    const existing = await db.select().from(pages).where(eq(pages.tenantId, tenantId)).get();
    if (existing) {
      await db.update(pages).set({ content }).where(eq(pages.tenantId, tenantId));
    } else {
      await db.insert(pages).values({
        tenantId,
        content,
      });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update page' });
  }
});

// Auto-generate a simple default Puck page for the tenant (used by the
// onboarding wizard "preview" step). Returns the created/updated content.
router.post('/page', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    const tenantServices = await db.select().from(servicesTable)
      .where(eq(servicesTable.tenantId, tenantId)).all();
    const staffList = await db.select().from(staff)
      .where(eq(staff.tenantId, tenantId)).all();

    const defaultContent = buildDefaultPuckPage(tenant?.name || 'Welcome');

    void tenantServices; void staffList; // available for richer templates later

    const existing = await db.select().from(pages).where(eq(pages.tenantId, tenantId)).get();
    if (existing) {
      await db.update(pages).set({ content: defaultContent }).where(eq(pages.tenantId, tenantId));
    } else {
      await db.insert(pages).values({ tenantId, content: defaultContent });
    }
    res.status(201).json({ success: true, content: defaultContent });
  } catch (error) {
    console.error('Default page error:', error);
    res.status(500).json({ error: 'Failed to generate default page' });
  }
});

/**
 * Build the standard seed Puck document for a tenant's public site. Shared by
 * the onboarding "publish" step and the dashboard "generate default page"
 * action so both produce identical structure. The About/About block carries
 * the tenant description so an AI-generated "About" survives into the live
 * page.
 */
function buildDefaultPuckPage(businessName: string, description?: string): any {
  const aboutText =
    typeof description === 'string' && description.trim()
      ? description.trim()
      : `Book an appointment with ${businessName || 'us'} online.`;
  return {
    content: [
      {
        type: 'Hero',
        props: {
          title: businessName || 'Welcome',
          subtitle: 'Book your next appointment online — fast and simple.',
        },
        data: {},
      },
      { type: 'About', props: { content: aboutText }, data: {} },
      { type: 'Services', props: {}, data: {} },
      { type: 'BookingForm', props: {}, data: {} },
      { type: 'Contact', props: {}, data: {} },
    ],
    root: {},
  };
}

/**
 * POST /api/tenant/onboarding/complete
 *
 * Final step of the self-serve onboarding wizard. Atomically:
 *   1. persists business info captured during the wizard (category, city,
 *      description) onto the tenant,
 *   2. seeds the tenant's Puck page so the public site is live,
 *   3. marks `settings.onboarding_completed = true`,
 *   4. opts the tenant into /discover when the owner toggled "list publicly".
 *
 * Body (all optional): { listPublicly?: boolean, category?, city?, description?, name? }
 */
router.post('/onboarding/complete', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const { listPublicly, category, city, description, name } = req.body || {};

    const settings = {
      ...(tenant.settings as any || {}),
      onboarding_completed: true,
    };
    if (typeof description === 'string' && description.trim()) {
      settings.description = description.trim();
    }
    if (typeof city === 'string' && city.trim()) {
      settings.city = city.trim();
    }

    const updates: Record<string, any> = { settings };
    const nextName = typeof name === 'string' && name.trim() ? name.trim() : tenant.name;
    if (typeof name === 'string' && name.trim()) updates.name = nextName;
    if (typeof category === 'string' && category.trim()) updates.category = category.trim().toLowerCase();
    // "List my business publicly" is an explicit opt-in. Never force-unlist a
    // tenant that has already published.
    if (listPublicly === true) updates.isListed = true;

    await db.update(tenants).set(updates).where(eq(tenants.id, tenantId));

    const seeded = buildDefaultPuckPage(nextName, settings.description);
    const existing = await db.select({ tenantId: pages.tenantId }).from(pages).where(eq(pages.tenantId, tenantId)).get();
    if (existing) {
      await db.update(pages).set({ content: seeded }).where(eq(pages.tenantId, tenantId));
    } else {
      await db.insert(pages).values({ tenantId, content: seeded });
    }

    const share = shareLinkFor(tenant);
    res.json({
      success: true,
      slug: tenant.slug,
      isListed: listPublicly === true || tenant.isListed === true,
      share,
    });
  } catch (error) {
    console.error('Onboarding complete error:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

router.post('/upload', uploadLimiter, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { tenantId } = (req as any).user;
  if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const dir = tenantDir(tenantId);
    const filename = `${crypto.randomUUID()}.jpg`;
    const filepath = path.join(dir, filename);

    await sharp(req.file.buffer)
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(filepath);

    const publicPath = `/uploads/${tenantId}/${filename}`;
    const id = crypto.randomUUID();
    await db.insert(media).values({
      id,
      tenantId,
      path: publicPath,
      originalName: '',
      mimeType: req.file.mimetype,
      size: req.file.size,
      createdAt: Date.now(),
    });

    res.json({
      id,
      path: publicPath,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

router.get('/media', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const list = await db.select().from(media)
      .where(eq(media.tenantId, tenantId))
      .orderBy(desc(media.createdAt))
      .all();
    // Rewrite relative stored paths to absolute CDN URLs at read time when
    // a CDN is configured. The DB keeps the relative path.
    res.json(list.map((m) => ({ ...m, path: resolveMediaUrl(m.path) })));
  } catch (error) {
    console.error('List media error:', error);
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

router.delete('/media/:id', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { id } = req.params;
  try {
    const row = await db.select().from(media)
      .where(and(eq(media.id, id), eq(media.tenantId, tenantId)))
      .get();
    if (!row) return res.status(404).json({ error: 'Media not found for this tenant' });

    // Remove the file from disk if it's under our managed uploads dir.
    try {
      const relative = row.path.replace(/^\/uploads\//, '');
      const safeRelative = path.normalize(relative);
      if (!safeRelative.startsWith('..')) {
        const absolute = path.join(uploadDir, safeRelative);
        if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
      }
    } catch (fsErr) {
      console.warn('Failed to unlink media file:', fsErr);
    }

    await db.delete(media).where(eq(media.id, id));
    res.json({ success: true, id });
  } catch (error) {
    console.error('Delete media error:', error);
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

router.get('/staff', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const list = await db.select().from(staff).where(eq(staff.tenantId, tenantId)).all();
    // Attach each staff member's assigned services (id + name) so the
    // dashboard can render a comma-separated list and pre-populate the
    // "Manage services" dialog without an extra round-trip.
    const allLinks = list.length
      ? await db.select().from(staffServices)
          .where(inArray(staffServices.staffId, list.map(s => s.id))).all()
      : [];
    const svcIds = Array.from(new Set(allLinks.map(l => l.serviceId)));
    const svcRows = svcIds.length
      ? await db.select().from(servicesTable)
          .where(and(eq(servicesTable.tenantId, tenantId), inArray(servicesTable.id, svcIds))).all()
      : [];
    const svcById = new Map(svcRows.map(s => [s.id, s]));
    const linksByStaff = new Map<string, { id: string; name: string }[]>();
    for (const l of allLinks) {
      const svc = svcById.get(l.serviceId);
      if (!svc) continue;
      const arr = linksByStaff.get(l.staffId) || [];
      arr.push({ id: svc.id, name: svc.name });
      linksByStaff.set(l.staffId, arr);
    }
    const withServices = list.map(s => ({
      ...s,
      services: linksByStaff.get(s.id) || [],
    }));
    res.json(withServices);
  } catch (error) {
    console.error('Fetch staff error:', error);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// ---- Services management (owner) ----

router.get('/services', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const list = await db.select().from(servicesTable)
      .where(eq(servicesTable.tenantId, tenantId))
      .all();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

router.post('/services', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { name, durationMinutes, price, imagePath } = req.body;

  if (!name || !durationMinutes || price === undefined || price === null) {
    return res.status(400).json({ error: 'name, durationMinutes and price are required' });
  }
  if (typeof durationMinutes !== 'number' || durationMinutes <= 0) {
    return res.status(400).json({ error: 'durationMinutes must be a positive number' });
  }
  if (typeof price !== 'number' || price < 0) {
    return res.status(400).json({ error: 'price must be a non-negative number (ETB cents)' });
  }

  try {
    const id = crypto.randomUUID();
    await db.insert(servicesTable).values({
      id,
      tenantId,
      name: String(name).trim(),
      durationMinutes,
      price,
      imagePath: imagePath ?? null,
      active: true,
    });
    const created = await db.select().from(servicesTable).where(eq(servicesTable.id, id)).get();
    res.status(201).json(created);
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

router.put('/services/:id', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { id } = req.params;
  const { name, durationMinutes, price, imagePath, active } = req.body;

  // Validate inputs when provided
  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ error: 'name cannot be empty' });
  }
  if (durationMinutes !== undefined && (typeof durationMinutes !== 'number' || durationMinutes <= 0)) {
    return res.status(400).json({ error: 'durationMinutes must be a positive number' });
  }
  if (price !== undefined && (typeof price !== 'number' || price < 0)) {
    return res.status(400).json({ error: 'price must be a non-negative number (ETB cents)' });
  }

  try {
    // Ensure the service belongs to this tenant
    const existing = await db.select().from(servicesTable)
      .where(and(eq(servicesTable.id, id), eq(servicesTable.tenantId, tenantId))).get();
    if (!existing) {
      return res.status(404).json({ error: 'Service not found for this tenant' });
    }

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (durationMinutes !== undefined) updates.durationMinutes = durationMinutes;
    if (price !== undefined) updates.price = price;
    if (imagePath !== undefined) updates.imagePath = imagePath;
    if (active !== undefined) updates.active = !!active;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    await db.update(servicesTable).set(updates).where(eq(servicesTable.id, id));
    const updated = await db.select().from(servicesTable).where(eq(servicesTable.id, id)).get();
    res.json(updated);
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

router.delete('/services/:id', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { id } = req.params;
  try {
    const existing = await db.select().from(servicesTable)
      .where(and(eq(servicesTable.id, id), eq(servicesTable.tenantId, tenantId))).get();
    if (!existing) {
      return res.status(404).json({ error: 'Service not found for this tenant' });
    }

    // Remove any staff-service links before deleting the service
    await db.delete(staffServices).where(eq(staffServices.serviceId, id));
    await db.delete(servicesTable).where(eq(servicesTable.id, id));
    res.json({ success: true, id });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

// ── Recurring Appointments ─────────────────────────────────────────

/**
 * Parse an Ethiopian date string ("YYYY-MM-DD" Ethiopian) into a Gregorian
 * UTC Date. Uses the ethiopian-date library's toGregorian reverse conversion.
 */
function ethiopianToGregorian(ethDateStr: string): Date {
  const [y, m, d] = ethDateStr.split('-').map(Number);
  const g = toGregorian(y, m, d) as [number, number, number];
  return new Date(Date.UTC(g[0], g[1] - 1, g[2], 0, 0, 0));
}

/**
 * Format a Gregorian Date as "YYYY-MM-DD" Gregorian string for parseAddisDate.
 */
function formatGregorian(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Compute the next occurrence date for a recurring series.
 * - weekly: +7 days
 * - biweekly: +14 days
 * - monthly: +1 month
 */
function nextOccurrenceDate(current: Date, interval: string): Date {
  const y = current.getUTCFullYear();
  const m = current.getUTCMonth();
  const d = current.getUTCDate();
  if (interval === 'weekly') {
    return new Date(Date.UTC(y, m, d + 7));
  }
  if (interval === 'biweekly') {
    return new Date(Date.UTC(y, m, d + 14));
  }
  if (interval === 'monthly') {
    return new Date(Date.UTC(y, m + 1, d));
  }
  return current;
}

const RecurringSeriesSchema = z.object({
  staff_id: z.string().uuid(),
  service_id: z.string().uuid(),
  customer_name: z.string().min(1).max(120),
  customer_phone: z.string().min(1).max(40),
  customer_email: z
    .union([z.string().email('Invalid email').max(254), z.literal(''), z.null()])
    .transform((v) => (v === '' || v === null ? undefined : v))
    .optional(),
  interval: z.enum(['weekly', 'biweekly', 'monthly']),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  timeslot_minutes: z.number().int().min(30).max(1200),
  marketing_opt_in: z.boolean().default(false),
});

/**
 * POST /api/tenant/recurring-series
 *
 * Creates a recurring appointment series and immediately expands future
 * occurrences into individual appointment rows (skipping conflicts).
 * Owner-only.
 */
router.post('/recurring-series', async (req, res) => {
  const { tenantId } = (req as any).user;

  try {
    const data = RecurringSeriesSchema.parse(req.body);

    // Cross-tenant guards: staff and service must belong to THIS tenant.
    const staffRow = await db.select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.id, data.staff_id), eq(staff.tenantId, tenantId)))
      .get();
    if (!staffRow) {
      logSecurityEvent({
        type: 'cross_tenant_attempt',
        tenantId,
        ip: ipFromRequest(req),
        details: { path: req.path, staffId: data.staff_id },
      });
      return res.status(404).json({ error: 'Staff not found for this tenant' });
    }

    const serviceRow = await db.select().from(servicesTable)
      .where(and(eq(servicesTable.id, data.service_id), eq(servicesTable.tenantId, tenantId)))
      .get();
    if (!serviceRow) {
      return res.status(404).json({ error: 'Service not found for this tenant' });
    }

    const customerPhone = normalizePhone(data.customer_phone);
    if (!customerPhone) {
      return res.status(422).json({ error: 'Enter a valid Ethiopian phone number' });
    }

    const startDate = ethiopianToGregorian(data.start_date);
    const endDate = ethiopianToGregorian(data.end_date);
    if (endDate.getTime() <= startDate.getTime()) {
      return res.status(400).json({ error: 'end_date must be after start_date' });
    }

    const now = Date.now();
    const seriesId = crypto.randomUUID();

    await db.insert(recurringSeries).values({
      id: seriesId,
      tenantId,
      staffId: data.staff_id,
      serviceId: data.service_id,
      customerName: data.customer_name,
      customerPhone,
      customerEmail: data.customer_email || null,
      interval: data.interval,
      startDate: data.start_date,
      endDate: data.end_date,
      timeslotMinutes: data.timeslot_minutes,
      isActive: true,
      createdAt: now,
    });

    // Upsert the customer_stats row with marketing_opt_in.
    const existing = await db.select()
      .from(customerStats)
      .where(and(eq(customerStats.tenantId, tenantId), eq(customerStats.customerPhone, customerPhone)))
      .get();
    if (existing) {
      await db.update(customerStats)
        .set({ marketingOptIn: data.marketing_opt_in, customerName: data.customer_name })
        .where(and(eq(customerStats.tenantId, tenantId), eq(customerStats.customerPhone, customerPhone)));
    } else {
      await db.insert(customerStats).values({
        tenantId,
        customerPhone,
        customerName: data.customer_name,
        marketingOptIn: data.marketing_opt_in,
        createdAt: now,
      });
    }

     // Expand the series into individual appointments.
    const expansion = await expandRecurringSeries(seriesId);

    res.status(201).json({
      success: true,
      seriesId,
      createdAppointments: expansion.created,
      skippedConflicts: expansion.skipped,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ error: error.issues });
    }
    console.error('Create recurring series error:', error);
    res.status(500).json({ error: 'Failed to create recurring series' });
  }
});

/**
 * Expand a recurring series into individual appointment rows.
 *
 * For each interval occurrence between start_date and end_date:
 *   - Skip past slots (startTime <= now)
 *   - Check for conflicts within a BEGIN IMMEDIATE transaction
 *   - Skip if conflict found
 *   - Create the appointment row with recurringSeriesId set
 *
 * Returns { created: count, skipped: count }.
 */
async function expandRecurringSeries(seriesId: string): Promise<{ created: number; skipped: number }> {
  const series = await db.select().from(recurringSeries).where(eq(recurringSeries.id, seriesId)).get();
  if (!series) return { created: 0, skipped: 0 };
  if (!series.isActive) return { created: 0, skipped: 0 };

  const svc = await db.select().from(servicesTable)
    .where(eq(servicesTable.id, series.serviceId))
    .get();
  if (!svc) return { created: 0, skipped: 0 };

  const durationMs = svc.durationMinutes * 60000;
  const startG = ethiopianToGregorian(series.startDate);
  const endG = ethiopianToGregorian(series.endDate);

  let created = 0;
  let skipped = 0;
  let cursor = new Date(startG);

  while (cursor.getTime() <= endG.getTime()) {
    // parseAddisDate expects "YYYY-MM-DD" (Gregorian) and returns the UTC
    // timestamp for midnight of that day in Addis local time (UTC+3).
    const gregStr = formatGregorian(
      cursor.getUTCFullYear(),
      cursor.getUTCMonth() + 1,
      cursor.getUTCDate(),
    );
    const addisMidnight = parseAddisDate(gregStr).getTime();
    const startTimeMs = addisMidnight + series.timeslotMinutes * 60000;
    const endTimeMs = startTimeMs + durationMs;

    // Skip past slots — never auto-create appointments in the past.
    if (startTimeMs <= Date.now()) {
      cursor = nextOccurrenceDate(cursor, series.interval);
      continue;
    }

    // Conflict check + insert inside a BEGIN IMMEDIATE transaction so the
    // re-read and insert are serialized (no double-booking race).
    try {
      await db.transaction(async (tx) => {
        const conflicting = await tx.select().from(appointments).where(
          and(
            eq(appointments.tenantId, series.tenantId),
            eq(appointments.staffId, series.staffId),
            or(eq(appointments.status, 'confirmed'), eq(appointments.status, 'pending')),
            lt(appointments.startTime, endTimeMs),
            gte(appointments.endTime, startTimeMs),
          )
        ).get();

        if (conflicting) {
          skipped += 1;
          return;
        }

        const opaqueId = crypto.randomBytes(16).toString('hex');
        await tx.insert(appointments).values({
          id: crypto.randomUUID(),
          tenantId: series.tenantId,
          staffId: series.staffId,
          serviceId: series.serviceId,
          customerName: series.customerName,
          customerPhone: series.customerPhone,
          customerEmail: series.customerEmail,
          startTime: startTimeMs,
          endTime: endTimeMs,
          status: 'confirmed',
          reminderSent: false,
          recurringSeriesId: seriesId,
          opaqueId,
        });
        created += 1;
      }, { behavior: 'immediate' });
    } catch (err: any) {
      console.error('Error expanding recurring occurrence:', err);
    }

    cursor = nextOccurrenceDate(cursor, series.interval);
  }

  return { created, skipped };
}

/**
 * GET /api/tenant/recurring-series
 *
 * Lists all recurring series for the tenant. Owner-only.
 */
router.get('/recurring-series', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const rows = await db.select()
      .from(recurringSeries)
      .where(eq(recurringSeries.tenantId, tenantId))
      .orderBy(desc(recurringSeries.createdAt))
      .all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recurring series' });
  }
});

/**
 * DELETE /api/tenant/recurring-series/:id
 *
 * Deactivate a recurring series (sets is_active=false). Does NOT delete
 * already-generated appointment rows.
 */
router.delete('/recurring-series/:id', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { id } = req.params;
  try {
    const owned = await db.select({ id: recurringSeries.id })
      .from(recurringSeries)
      .where(and(eq(recurringSeries.id, id), eq(recurringSeries.tenantId, tenantId)))
      .get();
    if (!owned) return res.status(404).json({ error: 'Recurring series not found for this tenant' });

    await db.update(recurringSeries)
      .set({ isActive: false })
      .where(eq(recurringSeries.id, id));
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deactivate recurring series' });
  }
});

// ── Inventory Management (Pharmacy) ─────────────────────────────────────────

/**
 * GET /api/tenant/inventory
 *
 * Lists all inventory items for the authenticated tenant. Owner-only.
 * Includes a `low_stock` boolean for the dashboard alert.
 */
router.get('/inventory', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const rows = await db.select()
      .from(inventoryItems)
      .where(eq(inventoryItems.tenantId, tenantId))
      .orderBy(inventoryItems.name)
      .all();

    const withAlert = rows.map((r) => ({
      ...r,
      lowStock: r.quantityOnHand <= r.reorderThreshold,
    }));

    res.json(withAlert);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

/**
 * PUT /api/tenant/inventory
 *
 * Upserts inventory items for the tenant. Owner-only.
 * Body: { items: [{ id?, service_id?, name, sku?, quantity_on_hand, reorder_threshold, unit }] }
 */
const InventoryItemSchema = z.object({
  id: z.string().uuid().optional(),
  service_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(120),
  sku: z.string().nullable().optional(),
  quantity_on_hand: z.number().int().min(0),
  reorder_threshold: z.number().int().min(0).default(5),
  unit: z.string().min(1).max(50).default('unit'),
});

router.put('/inventory', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { items } = req.body || {};

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items must be an array' });
  }

  try {
    // Validate every item up front so a bad payload fails fast (same 422
    // behavior as the previous per-item parse).
    const parsed = items.map((item) => InventoryItemSchema.parse(item));

    // Single read pass: the tenant's services and existing inventory items,
    // so the per-item ownership/validation checks below never hit the DB.
    const [serviceRows, existingRows] = await Promise.all([
      db.select({ id: servicesTable.id })
        .from(servicesTable)
        .where(eq(servicesTable.tenantId, tenantId))
        .all(),
      db.select().from(inventoryItems)
        .where(eq(inventoryItems.tenantId, tenantId))
        .all(),
    ]);
    const serviceIds = new Set(serviceRows.map((s) => s.id));
    const existingById = new Map(existingRows.map((e) => [e.id, e]));

    // Partition the payload into creates and updates — no DB calls here.
    const toInsert: Array<typeof inventoryItems.$inferInsert> = [];
    const toUpdate: Array<{
      id: string;
      serviceId: string | null;
      name: string;
      sku: string | null;
      quantityOnHand: number;
      reorderThreshold: number;
      unit: string;
    }> = [];
    for (const data of parsed) {
      if (data.service_id && !serviceIds.has(data.service_id)) {
        return res.status(404).json({ error: `Service not found for this tenant: ${data.service_id}` });
      }
      if (data.id) {
        const existing = existingById.get(data.id);
        if (!existing) {
          return res.status(404).json({ error: `Inventory item not found for this tenant: ${data.id}` });
        }
        toUpdate.push({
          id: data.id,
          serviceId: data.service_id ?? null,
          name: data.name.trim(),
          sku: data.sku ?? null,
          quantityOnHand: data.quantity_on_hand,
          reorderThreshold: data.reorder_threshold,
          unit: data.unit,
        });
      } else {
        toInsert.push({
          id: crypto.randomUUID(),
          tenantId,
          serviceId: data.service_id ?? null,
          name: data.name.trim(),
          sku: data.sku ?? null,
          quantityOnHand: data.quantity_on_hand,
          reorderThreshold: data.reorder_threshold,
          unit: data.unit,
          createdAt: Date.now(),
        });
      }
    }

    // Execute the writes. Inserts batch in a single statement; updates run in
    // a classic indexed loop (SQLite has no set-based multi-row UPDATE).
    if (toInsert.length) {
      await db.insert(inventoryItems).values(toInsert);
    }
    for (let i = 0; i < toUpdate.length; i++) {
      const u = toUpdate[i];
      await db.update(inventoryItems)
        .set({
          serviceId: u.serviceId,
          name: u.name,
          sku: u.sku,
          quantityOnHand: u.quantityOnHand,
          reorderThreshold: u.reorderThreshold,
          unit: u.unit,
        })
        .where(eq(inventoryItems.id, u.id));
    }

    // Return the affected rows in the same order as the request payload.
    const allIds = [...toInsert.map((r) => r.id), ...toUpdate.map((u) => u.id)];
    const affected = allIds.length
      ? await db.select().from(inventoryItems)
          .where(and(eq(inventoryItems.tenantId, tenantId), inArray(inventoryItems.id, allIds)))
          .all()
      : [];
    const byId = new Map(affected.map((r) => [r.id, r]));
    res.json({ success: true, items: allIds.map((id) => byId.get(id)) });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ error: error.issues });
    }
    console.error('Inventory upsert error:', error);
    res.status(500).json({ error: 'Failed to upsert inventory' });
  }
});

/**
 * POST /api/tenant/inventory/:id/adjust
 *
 * Adjust stock by a delta (positive to add, negative to subtract).
 * Owner-only.
 */
router.post('/inventory/:id/adjust', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { id } = req.params;
  const { delta } = req.body || {};

  if (typeof delta !== 'number' || !Number.isInteger(delta)) {
    return res.status(400).json({ error: 'delta must be an integer' });
  }

  try {
    const owned = await db.select()
      .from(inventoryItems)
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.tenantId, tenantId)))
      .get();
    if (!owned) return res.status(404).json({ error: 'Inventory item not found for this tenant' });

    const newQty = Math.max(0, owned.quantityOnHand + delta);
    await db.update(inventoryItems)
      .set({ quantityOnHand: newQty })
      .where(eq(inventoryItems.id, id));
    const updated = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id)).get();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to adjust inventory' });
  }
});



/**
 * GET /api/tenant/export/csv
 * Export tenant data as CSV (bookings, customers, services, staff, payments).
 * Owner-only. Streams CSV to avoid memory bloat on large datasets.
 */
router.get('/export/csv', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { type = 'bookings', startDate, endDate } = req.query;

  // #67 — reject unknown export types BEFORE any CSV header is written; a
  // 400 must arrive as clean JSON, not a half-streamed text/csv body.
  const VALID_EXPORT_TYPES = ['bookings', 'customers', 'services', 'staff', 'payments'];
  if (!VALID_EXPORT_TYPES.includes(String(type))) {
    return res.status(400).json({
      error: `Invalid export type. Supported: ${VALID_EXPORT_TYPES.join(', ')}`,
    });
  }

  try {
    // Set CSV headers
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${tenantId}-${type}-${Date.now()}.csv"`);

    // Helper to escape CSV fields. Besides quoting separators, a leading
    // = + - or @ is prefixed with a single quote so Excel/LibreOffice/Sheets
    // cannot interpret attacker-controlled text (customer_name comes from
    // the public booking form!) as a formula — the classic CSV injection
    // vector (=HYPERLINK(...), =cmd|'/c calc'!A0, @SUM(...), ...).
    const escapeCsv = (field: any): string => {
      if (field === null || field === undefined) return '';
      let str = String(field);
      if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
      }
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    // Write CSV header and stream data
    const writeHeader = (headers: string[]) => {
      res.write(headers.map(escapeCsv).join(',') + '\n');
    };

    const writeRow = (row: any[]) => {
      res.write(row.map(escapeCsv).join(',') + '\n');
    };

    switch (type) {
      case 'bookings': {
        writeHeader(['ID', 'Customer Name', 'Customer Phone', 'Customer Email', 'Service', 'Staff', 'Start Time', 'End Time', 'Status', 'Payment Status', 'Amount (ETB)']);

        const { startTime, endTime, status } = req.query;
        const whereConditions = [eq(appointments.tenantId, tenantId)];
        if (startTime) whereConditions.push(gte(appointments.startTime, parseInt(startTime as string)));
        if (endTime) whereConditions.push(lte(appointments.startTime, parseInt(endTime as string)));
        if (status) whereConditions.push(eq(appointments.status, status as string));

        const bookingsData = await db.select({
           opaqueId: appointments.opaqueId,
          customerName: appointments.customerName,
          customerPhone: appointments.customerPhone,
          customerEmail: appointments.customerEmail,
          serviceName: servicesTable.name,
          staffName: staff.name,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          status: appointments.status,
          paymentStatus: payments.status,
          amount: payments.amount,
        })
        .from(appointments)
        .leftJoin(servicesTable, eq(appointments.serviceId, servicesTable.id))
        .leftJoin(staff, eq(appointments.staffId, staff.id))
        .leftJoin(payments, eq(payments.appointmentId, appointments.id))
        .where(and(...whereConditions))
        .orderBy(desc(appointments.startTime))
        .all();

        for (const booking of bookingsData) {
          writeRow([
            booking.opaqueId,
            booking.customerName,
            booking.customerPhone,
            booking.customerEmail || '',
            booking.serviceName || '',
            booking.staffName || '',
            new Date(booking.startTime).toISOString(),
            new Date(booking.endTime).toISOString(),
            booking.status,
            booking.paymentStatus || '',
            booking.amount ? (booking.amount / 100).toFixed(2) : '',
          ]);
        }
        break;
      }

      case 'customers': {
        writeHeader(['Phone', 'Name', 'First Visit', 'Last Visit', 'Visit Count', 'Total Spend (ETB)', 'Marketing Opt-in', 'No-show Count']);

        const customersData = await db.select()
          .from(customerStats)
          .where(eq(customerStats.tenantId, tenantId))
          .orderBy(desc(customerStats.lastVisitAt))
          .all();

        for (const customer of customersData) {
          writeRow([
            customer.customerPhone,
            customer.customerName,
            customer.firstVisitAt ? new Date(customer.firstVisitAt).toISOString() : '',
            customer.lastVisitAt ? new Date(customer.lastVisitAt).toISOString() : '',
            customer.visitCount,
            (customer.totalSpendEtbCents / 100).toFixed(2),
            customer.marketingOptIn ? 'Yes' : 'No',
            customer.noShowCount,
          ]);
        }
        break;
      }

      case 'services': {
        writeHeader(['ID', 'Name', 'Duration (min)', 'Price (ETB)', 'Active']);

        const servicesData = await db.select()
          .from(servicesTable)
          .where(eq(servicesTable.tenantId, tenantId))
          .orderBy(servicesTable.name)
          .all();

        for (const service of servicesData) {
          writeRow([
            service.id,
            service.name,
            service.durationMinutes,
            (service.price / 100).toFixed(2),
            service.active ? 'Yes' : 'No',
          ]);
        }
        break;
      }

      case 'staff': {
        writeHeader(['ID', 'Name', 'Title', 'Active', 'Assigned Services']);

        // Batch fetch all staff and their service links in one go
        const staffData = await db.select()
          .from(staff)
          .where(eq(staff.tenantId, tenantId))
          .orderBy(staff.name)
          .all();

        // Get all service links for these staff members in one query
        const staffIds = staffData.map(s => s.id);
        const allServiceLinks = staffIds.length > 0
          ? await db.select()
              .from(staffServices)
              .where(inArray(staffServices.staffId, staffIds))
              .all()
            : [];

        // Get all service IDs from the links
        const allServiceIds = [...new Set(allServiceLinks.map(l => l.serviceId))];
        const serviceData = allServiceIds.length > 0
          ? await db.select({ id: servicesTable.id, name: servicesTable.name })
              .from(servicesTable)
              .where(and(eq(servicesTable.tenantId, tenantId), inArray(servicesTable.id, allServiceIds)))
              .all()
            : [];

        // Build a map of serviceId -> serviceName
        const serviceNameMap = new Map(serviceData.map(s => [s.id, s.name]));

        // Build a map of staffId -> serviceNames
        const staffServiceMap = new Map<string, string>();
        for (const link of allServiceLinks) {
          const serviceName = serviceNameMap.get(link.serviceId);
          if (serviceName) {
            const existing = staffServiceMap.get(link.staffId) || '';
            staffServiceMap.set(link.staffId, existing ? existing + '; ' + serviceName : serviceName);
          }
        }

        for (const staffMember of staffData) {
          const serviceNames = staffServiceMap.get(staffMember.id) || '';

          writeRow([
            staffMember.id,
            staffMember.name,
            staffMember.title || '',
            staffMember.active ? 'Yes' : 'No',
            serviceNames,
          ]);
        }
        break;
      }

      case 'payments': {
        writeHeader(['ID', 'Appointment ID', 'Amount (ETB)', 'Gateway', 'Method', 'Gateway Ref', 'Status', 'Created']);

        const { startDate, endDate, status } = req.query;
        const whereConditions = [eq(payments.tenantId, tenantId)];
        // #67 — payments.id is a UUID: comparing it to 'YYYY-MM-DD' filtered
        // on the primary key as if it were a date. Window on createdAt
        // (epoch ms UTC) with full Addis days, inclusive of endDate.
        if (startDate) {
          whereConditions.push(gte(payments.createdAt, parseAddisDate(String(startDate)).getTime()));
        }
        if (endDate) {
          const endExclusive = parseAddisDate(String(endDate)).getTime() + 24 * 60 * 60 * 1000;
          whereConditions.push(lt(payments.createdAt, endExclusive));
        }
        if (status) whereConditions.push(eq(payments.status, status as string));

        const paymentsData = await db.select()
          .from(payments)
          .where(and(...whereConditions))
          .orderBy(desc(payments.createdAt))
          .all();

        for (const payment of paymentsData) {
          writeRow([
            payment.id,
            payment.appointmentId || '',
            (payment.amount / 100).toFixed(2),
            payment.gateway || '',
            payment.method || '',
            payment.gatewayReference || '',
            payment.status,
            payment.createdAt ? getAddisDateString(new Date(payment.createdAt)) : '',
          ]);
        }
        break;
      }

      default:
        res.status(400).write('Invalid export type. Supported: bookings, customers, services, staff, payments');
    }

    res.end();
  } catch (error) {
    console.error('CSV export error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to export CSV' });
    }
  }
});

/**
 * POST /api/tenant/account/deletion — owner-only self-serve account deletion
 * (Apple 5.1.1(v) / GDPR Art. 17 / Wayfinder #12 decision matrix).
 *
 * Owner types the business name to confirm. Everything runs in ONE
 * transaction (server/lib/accountDeletion.ts): subscription closed with no
 * refund of prepaid days, site unpublished + custom-domain record cleared
 * (tenant row reduced to an anonymous shell that anchors the retained money
 * records), staff deleted with the tenant, bookings anonymized, money records
 * (payments/invoices) retained for PLC bookkeeping with identity stripped.
 * Site-generation artifacts on disk are removed best-effort outside the
 * transaction (file I/O in a txn would hold it open).
 */
router.post('/account/deletion', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const confirmName = String(req.body?.confirmName ?? '').trim();
    if (!confirmName) {
      return res.status(400).json({ error: 'Type your business name to confirm deletion.' });
    }
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (confirmName !== tenant.name.trim()) {
      logSecurityEvent({
        type: 'tenant_account_deleted',
        tenantId,
        ip: ipFromRequest(req),
        result: 'failure',
        details: { reason: 'confirm_name_mismatch' },
      });
      return res.status(400).json({ error: 'Business name does not match. Type it exactly as shown on this page to confirm.' });
    }

    const counts = await db.transaction(async (tx) => deleteTenantAccount(tx, tenantId));

    // Best-effort artifact cleanup, never throws into the response path.
    try {
      fs.rmSync(path.join(process.cwd(), 'storage', 'pro-builds', tenantId), { recursive: true, force: true });
    } catch (cleanupErr: any) {
      console.error('[account-deletion] pro-build cleanup:', cleanupErr?.message);
    }

    logSecurityEvent({
      type: 'tenant_account_deleted',
      tenantId,
      ip: ipFromRequest(req),
      result: 'success',
      details: { counts },
    });

    res.json({
      ok: true,
      ackEn: 'Your account has been deleted. Payment records were retained where accounting law requires; all identity data was removed.',
      ackAm: 'መለያዎ ተሰርዟል። በሂሳብ ሕግ መሠረት የሚቆዩ የክፍያ መዝገቦች እንደ ማንነት ያለ መረጃ ቀርተዋል፤ ሌላው መረጃዎ ሁሉ ተሰርዟል።',
      counts,
    });
  } catch (error: any) {
    console.error('[account-deletion] error:', error?.message || error);
    res.status(500).json({ error: 'Account deletion failed. Nothing was changed — please try again or contact support@egebeya.et.' });
  }
});
export default router;
