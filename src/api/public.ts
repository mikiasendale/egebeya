import { Router } from 'express';
import { db } from '../db';
import { tenants, services, staff, staffServices, staffAvailability, appointments, tenantBusinessHours, tenantClosures, pages, payments, users, siteConfig, customerStats, promoCodes, appointmentServices, recurringSeries } from '../db/schema';
import { eq, and, inArray, gte, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import { searchIntent } from '../db/schema';
import fs from 'fs';
import path from 'path';
import { sendMail } from '../../server/lib/mailer';
import { applyTemplate } from '../../server/lib/mailTemplates';
import { logSecurityEvent, ipFromRequest } from '../../server/lib/securityLog';
import {
  initiateDirectCharge,
  authorizeDirectCharge,
  verifyPayment,
  generateTxRef,
} from '../../server/lib/chapa';
import {
  getAddisDayOfWeek,
  parseAddisDate,
  formatAddisSlotTime,
  getAddisDateString,
  formatEthiopianDateTime,
  formatEthiopianDateCompact,
} from '../../server/lib/timezone';
import { rewriteUploadUrls } from '../../server/lib/mediaUrls';
import {
  isTurnstileConfigured,
  verifyTurnstileToken,
} from '../../server/lib/turnstile';
import {
  bookingWriteLimiter,
  publicReadLimiter,
  discoverLimiter,
} from '../../server/middleware/rateLimiter';
import { normalizePhone } from '../lib/phone';
import { strictCsp } from '../../server/middleware/csp';

const router = Router();

// Strict CSP for all public tenant-facing responses (JSON here, but the
// header is what matters when these become HTML surfaces).
router.use(strictCsp);

// Public, tenant-agnostic directory used by /discover. Must be registered
// BEFORE the tenant-resolution middleware below.
router.get('/discover', discoverLimiter, async (req, res) => {
  try {
    // Pagination: ?limit=N&offset=0 (default limit=20, max 100)
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 1), 100);
    const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0);

    // Filters: ?category=salon&city=Addis+Ababa&q=hair
    const category = req.query.category as string | undefined;
    const city = req.query.city as string | undefined;
    const q = req.query.q as string | undefined;

    // Build the WHERE clause dynamically
    const conditions: any[] = [eq(tenants.isListed, true)];

    if (category && typeof category === 'string' && category.trim()) {
      conditions.push(eq(tenants.category, category.trim().toLowerCase()));
    }

    if (city && typeof city === 'string' && city.trim()) {
      // Use json_extract to filter on settings.city (case-insensitive via LIKE)
      conditions.push(
        sql`json_extract(tenants.settings, '$.city') LIKE ${'%' + city.trim() + '%'}`,
      );
    }

    if (q && typeof q === 'string' && q.trim()) {
      conditions.push(
        sql`tenants.name LIKE ${'%' + q.trim() + '%'}`,
      );
    }

    // Get total count for x-total-count header
    const countResult = await db.select({
      n: sql<number>`count(*)`.as('n'),
    }).from(tenants).where(and(...conditions)).get();
    const totalCount = Number(countResult?.n || 0);

    const rows = await db.select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      category: tenants.category,
      settings: tenants.settings,
      createdAt: tenants.createdAt,
    })
      .from(tenants)
      .where(and(...conditions))
      .orderBy(tenants.name)
      .limit(limit)
      .offset(offset)
      .all();

    if (rows.length === 0) {
      res.set('x-total-count', String(totalCount));
      return res.json([]);
    }

    const tenantIds = rows.map((r) => r.id);

    const [pageRows, bookingRows] = await Promise.all([
      db.select({ tenantId: pages.tenantId, content: pages.content })
        .from(pages)
        .where(inArray(pages.tenantId, tenantIds))
        .all(),
      db.select({
        tenantId: appointments.tenantId,
        n: sql<number>`count(*)`.as('n'),
      })
        .from(appointments)
        .where(
          and(
            inArray(appointments.tenantId, tenantIds),
            inArray(appointments.status, ['confirmed', 'completed']),
          ),
        )
        .groupBy(appointments.tenantId)
        .all(),
    ]);

    const heroByTenant = new Map<string, string | null>();
    for (const p of pageRows) {
      heroByTenant.set(p.tenantId, extractHeroImage(p.content));
    }

    const countByTenant = new Map<string, number>();
    for (const b of bookingRows) countByTenant.set(b.tenantId, Number(b.n));

    const out = rows.map((r) => {
      const settings = (r.settings as any) || {};
      const city: string | null = settings.city ? String(settings.city).trim() || null : null;
      const realBookings = countByTenant.get(r.id) || 0;
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        category: r.category,
        city,
        heroImage: pickTenantMedia(heroByTenant.get(r.id) || null),
        isNew: realBookings === 0,
        createdAt: r.createdAt,
      };
    });

    res.set('x-total-count', String(totalCount));
    res.json(out);

    // Fire-and-forget buying-intent signal. A search/filter or card click is
    // a demand signal — record it without blocking the listing response.
    // 'search' when the visitor narrowed by category/city/query, else 'view'.
    const isSearch = Boolean(
      (category && category.trim()) || (city && city.trim()) || (q && q.trim()),
    );
    void recordDiscoverIntent({
      category: category?.trim() || null,
      city: city?.trim() || null,
      action: isSearch ? 'search' : 'view',
    });
  } catch (error) {
    console.error('Discover error:', error);
    res.status(500).json({ error: 'Failed to fetch discover listing' });
  }
});

// Turnstile widget configuration for the public booking flow. Public (the
// site key is client-safe); the server enforces the token on submit when a
// secret key is configured.
router.get('/turnstile-config', (_req, res) => {
  res.json({ siteKey: process.env.TURNSTILE_SITE_KEY?.trim() || null });
});

/**
 * Record an anonymized buying-intent signal from /discover. Fire-and-forget:
 * failures are logged but never thrown, so a DB hiccup never degrades the
 * public listing response. Also reused by POST /api/public/intent.
 */
export async function recordDiscoverIntent(intent: {
  category: string | null;
  city: string | null;
  action: 'view' | 'search';
}): Promise<void> {
  try {
    await db.insert(searchIntent).values({
      id: crypto.randomUUID(),
      category: intent.category,
      city: intent.city,
      action: intent.action,
      createdAt: Date.now(),
    });
  } catch (err) {
    console.error('Intent record error:', err);
  }
}

function extractHeroImage(pageContent: any): string | null {
  if (!pageContent || typeof pageContent !== 'object') return null;
  const blocks = Array.isArray(pageContent.content)
    ? pageContent.content
    : Array.isArray(pageContent.blocks)
      ? pageContent.blocks
      : [];
  for (const b of blocks) {
    if (b && b.type === 'Hero' && b.props) {
      const img = b.props.backgroundImage;
      if (typeof img === 'string' && img.trim()) return img.trim();
    }
  }
  return null;
}

function pickTenantMedia(url: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/api/uploads/')) {
    return trimmed;
  }
  return null;
}

// Public tenant view — a whitelist of fields, never the raw DB row. Internal
// fields (id, createdAt, notification_email, onboarding_completed, …) must
// not reach public consumers. The keys the public booking flow genuinely
// needs (calendar_display, require_payment_upfront, social links) are
// flattened onto the tenant object.
function publicTenantView(tenant: any): any {
  const settings = (tenant.settings as any) || {};
  const view: Record<string, unknown> = {
    name: tenant.name,
    slug: tenant.slug,
    category: tenant.category ?? null,
    description: typeof settings.description === 'string' && settings.description.trim()
      ? settings.description.trim()
      : null,
    calendar_display: settings.calendar_display === 'gregorian' ? 'gregorian' : 'ethiopian',
    require_payment_upfront: settings.require_payment_upfront === true,
  };
  for (const key of ['social_telegram', 'social_facebook', 'social_instagram', 'social_tiktok']) {
    if (typeof settings[key] === 'string' && settings[key].trim()) {
      view[key] = settings[key].trim();
    }
  }
  return view;
}

// Middleware to resolve tenant from X-Tenant-Slug header or Host. Slugs are
// resolved case-insensitively; suspended tenants are rejected with 403
// TENANT_SUSPENDED.
router.use(async (req, res, next) => {
  let slug = req.headers['x-tenant-slug'] as string;

  if (!slug) {
    const host = (req.headers.host || '').split(':')[0];
    slug = host.split('.')[0];
  }

  if (!slug) {
    return res.status(400).json({ error: 'Tenant slug not found' });
  }

  const rawSlug = String(slug).trim();
  let tenant = await db.select().from(tenants)
    .where(or(eq(tenants.slug, rawSlug), eq(tenants.slug, rawSlug.toLowerCase())))
    .get();

  if (!tenant && !req.headers['x-tenant-slug']) {
    const host = (req.headers.host || '').split(':')[0];
    const byDomain = await db.select().from(tenants)
      .where(eq(tenants.domain, host.toLowerCase()))
      .get();
    tenant = byDomain ?? undefined;
  }

  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  if (tenant.isSuspended) {
    logSecurityEvent({
      type: 'suspended_tenant_request',
      tenantId: tenant.id,
      ip: ipFromRequest(req),
      details: { path: req.path },
    });
    return res.status(403).json({ error: 'This business has been suspended', code: 'TENANT_SUSPENDED' });
  }

  (req as any).tenant = tenant;
  next();
});

router.use(publicReadLimiter);

router.get('/business-hours', async (req, res) => {
  const tenant = (req as any).tenant;
  try {
    const hours = await db.select()
      .from(tenantBusinessHours)
      .where(eq(tenantBusinessHours.tenantId, tenant.id))
      .all();
    res.json(hours);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch business hours' });
  }
});

router.get('/page', async (req, res) => {
  const tenant = (req as any).tenant;
  try {
    const page = await db.select().from(pages).where(eq(pages.tenantId, tenant.id)).get();
    // Rewrite any /uploads/... asset paths inside the Puck document to
    // absolute CDN URLs at render time when UPLOADS_CDN_BASE_URL is set.
    res.json({ tenant: publicTenantView(tenant), page: page ? rewriteUploadUrls(page) : page });
  } catch (error) {
    console.error('Failed to fetch page data:', error);
    res.status(500).json({ error: 'Failed to fetch page data' });
  }
});

router.get('/services', async (req, res) => {
  const tenant = (req as any).tenant;
  try {
    const tenantServices = await db.select()
      .from(services)
      .where(and(eq(services.tenantId, tenant.id), eq(services.active, true)))
      .all();
    res.json(tenantServices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

router.get('/staff', async (req, res) => {
  const tenant = (req as any).tenant;
  const serviceId = req.query.service_id as string;

  try {
    const staffMembers = await db.select({
      id: staff.id,
      name: staff.name,
      title: staff.title,
      bio: staff.bio,
      imagePath: staff.imagePath,
    }).from(staff).where(and(eq(staff.tenantId, tenant.id), eq(staff.active, true))).all();

    if (serviceId) {
      const mappings = await getStaffServicesForServiceInTenant(tenant.id, serviceId);
      const staffIds = new Set(mappings.map((m: any) => m.staffId));
      return res.json(staffMembers.filter((s: any) => staffIds.has(s.id)));
    }

    res.json(staffMembers);
  } catch (error) {
    console.error('Failed to fetch staff:', error);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

async function getStaffServicesForServiceInTenant(tenantId: string, serviceId: string) {
  const tenantStaff = await db.select({ id: staff.id }).from(staff)
    .where(eq(staff.tenantId, tenantId)).all();
  if (!tenantStaff.length) return [];
  const staffIds = tenantStaff.map((s) => s.id);
  return db.select().from(staffServices)
    .where(and(eq(staffServices.serviceId, serviceId), inArray(staffServices.staffId, staffIds)))
    .all();
}

router.get('/availability', async (req, res) => {
  const tenant = (req as any).tenant;
  const { staff_id, date } = req.query;

  if (!staff_id || !date) {
    return res.status(400).json({ error: 'staff_id and date are required' });
  }

  try {
    // Cross-tenant guard: staff_id must belong to THIS tenant.
    const ownedStaff = await db.select({ id: staff.id }).from(staff)
      .where(and(eq(staff.id, staff_id as string), eq(staff.tenantId, tenant.id))).get();
    if (!ownedStaff) {
      logSecurityEvent({
        type: 'cross_tenant_attempt',
        tenantId: tenant.id,
        ip: ipFromRequest(req),
        details: { path: req.path, staffId: staff_id },
      });
      return res.json([]);
    }

    const addisMidnight = parseAddisDate(date as string);
    const addisDayEnd = new Date(addisMidnight.getTime() + 24 * 3600 * 1000);
    const dayOfWeek = getAddisDayOfWeek(addisMidnight);
    const dateString = getAddisDateString(addisMidnight);

    if (addisDayEnd.getTime() <= Date.now()) {
      return res.status(422).json({ error: 'Cannot fetch availability for a past date.', code: 'PAST_DATE' });
    }

    const closures = await db.select().from(tenantClosures).where(
      and(eq(tenantClosures.tenantId, tenant.id), eq(tenantClosures.date, dateString))
    ).all();

    if (closures.length > 0) {
      return res.status(422).json({ error: 'The business is closed on this date.', code: 'CLOSED_DATE' });
    }

    const businessHours = await db.select().from(tenantBusinessHours).where(
      and(eq(tenantBusinessHours.tenantId, tenant.id), eq(tenantBusinessHours.dayOfWeek, dayOfWeek))
    ).get();

    if (businessHours?.isClosed) {
      return res.status(422).json({ error: 'The business is closed on this day of the week.', code: 'CLOSED_DAY' });
    }

    const tOpen = businessHours?.openTime || '00:00';
    const tClose = businessHours?.closeTime || '23:59';

    const availabilities = await db.select().from(staffAvailability).where(
      and(eq(staffAvailability.staffId, staff_id as string), eq(staffAvailability.dayOfWeek, dayOfWeek))
    ).all();

    if (availabilities.length === 0) {
      return res.json([]);
    }

    const staffAppointments = await db.select().from(appointments).where(
      and(
        eq(appointments.staffId, staff_id as string),
        eq(appointments.tenantId, tenant.id),
        or(eq(appointments.status, 'confirmed'), eq(appointments.status, 'pending')),
        gte(appointments.startTime, addisMidnight.getTime() - 3600_000),
        lt(appointments.startTime, addisDayEnd.getTime() + 3600_000)
      )
    ).all();

    const parseTime = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const slots: string[] = [];
    for (const avail of availabilities) {
      const effStart = avail.startTime > tOpen ? avail.startTime : tOpen;
      const effEnd = avail.endTime < tClose ? avail.endTime : tClose;

      const startMin = parseTime(effStart);
      const endMin = parseTime(effEnd);

      // Handle overnight shifts: when start >= end, the shift crosses midnight.
      // Split into two segments: [start, 24:00) today and [00:00, end) tomorrow.
      const windows: Array<{ startMin: number; endMin: number; dayOffsetMs: number }> = [];
      if (startMin >= endMin) {
        windows.push({ startMin, endMin: 24 * 60, dayOffsetMs: 0 });
        if (endMin > 0) {
          windows.push({ startMin: 0, endMin, dayOffsetMs: 24 * 60 * 1000 });
        }
      } else {
        windows.push({ startMin, endMin, dayOffsetMs: 0 });
      }

      for (const win of windows) {
        for (let min = win.startMin; min < win.endMin - 29; min += 30) {
          const slotUtcMs = addisMidnight.getTime() + win.dayOffsetMs + min * 60 * 1000;
          const slotEndUtcMs = slotUtcMs + 30 * 60 * 1000;

          const conflict = staffAppointments.some((app) => {
            return slotUtcMs < app.endTime && slotEndUtcMs > app.startTime;
          });

          if (!conflict) {
            slots.push(formatAddisSlotTime(slotUtcMs));
          }
        }
      }
    }

    res.json(Array.from(new Set(slots)).sort());
  } catch (error) {
    console.error('Availability error:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// Reasonable length caps so a 2MB customer_name / phones / emails payload
// cannot consume memory or trigger a generic 500 in the storage layer. Phone
// and email are additionally normalised/validated downstream.
const BookingSchema = z.object({
  staff_id: z.string().uuid(),
  // service_id (scalar) is DEPRECATED — use service_ids instead. When both are
  // provided, service_ids wins. When neither is provided, validation fails.
  service_id: z.string().uuid().optional(),
  service_ids: z.array(z.string().uuid()).min(1).max(10).optional(),
  start_time: z.string().datetime({ offset: true }),
  customer_name: z.string().min(1).max(120),
  customer_phone: z.string().min(1).max(40),
  // Empty string is normalised to undefined so it is stored as NULL (never
  // '' ) and never sent to Chapa as a blank email.
  customer_email: z
    .union([z.string().email('Invalid email').max(254), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
  promo_code: z.string().optional(),
}).refine((data) => data.service_ids || data.service_id, {
  message: 'Either service_id (deprecated) or service_ids is required',
  path: ['service_ids'],
});

async function assertSlotAllowed(
  tenant: any,
  startTimeMs: number,
  staffId?: string,
): Promise<{ code: string; error: string } | null> {
  if (!Number.isFinite(startTimeMs)) {
    return { code: 'INVALID_TIME', error: 'Invalid start_time. Expected an ISO 8601 timestamp.' };
  }
  if (startTimeMs <= Date.now()) {
    return { code: 'PAST_DATE', error: 'Cannot book a time in the past.' };
  }

  // Enforce 30-minute slot alignment so an attacker cannot craft a
  // start_time at ":07" the published availability grid does not expose —
  // it lets them bypass the grid without changing price (no arbitrage) but
  // does let them book off-grid slots the staff member never published, and
  // their start would land mid-appointment. The grid is generated at :00 and
  // :30 offsets in GET /availability, so require the same minute alignment.
  const SLOT_MINUTES = 30;
  const minuteOfDay = new Date(startTimeMs).getUTCMinutes();
  if (minuteOfDay % SLOT_MINUTES !== 0) {
    return { code: 'INVALID_SLOT', error: 'Start time must align to a 30-minute slot boundary.' };
  }

  const slotStartDate = new Date(startTimeMs);
  const slotDayOfWeek = getAddisDayOfWeek(slotStartDate);
  const slotDateString = getAddisDateString(slotStartDate);

  const closures = await db.select().from(tenantClosures).where(
    and(eq(tenantClosures.tenantId, tenant.id), eq(tenantClosures.date, slotDateString))
  ).all();
  if (closures.length > 0) {
    return { code: 'CLOSED_DATE', error: 'The business is closed on this date.' };
  }

  const businessHours = await db.select().from(tenantBusinessHours).where(
    and(eq(tenantBusinessHours.tenantId, tenant.id), eq(tenantBusinessHours.dayOfWeek, slotDayOfWeek))
  ).get();
  if (businessHours?.isClosed) {
    return { code: 'CLOSED_DAY', error: 'The business is closed on this day of the week.' };
  }

  // When a staff id is supplied, additionally verify the staff has
  // published availability for that day-of-week (if any windows exist for
  // the day) AND that the requested slot falls inside one of them. The
  // staffAvailability table holds HH:MM strings in Addis local time, which
  // is what we render against the day grid; comparing in the same frame
  // keeps the alignment honest. When the staff has no published windows
  // for the day (the inherits-tenant-hours case many tenants rely on)
  // we deliberately fall back to the business-hours-only check above so we
  // don't silently revoke availability from staff members a tenant has
  // never explicitly configured. Without the inside-check a crafted ISO
  // timestamp could book a slot outside the staff member's published
  // hours while remaining inside the tenant's looser business-hours
  // window.
  if (staffId) {
    const availabilities = await db.select().from(staffAvailability).where(
      and(eq(staffAvailability.staffId, staffId), eq(staffAvailability.dayOfWeek, slotDayOfWeek))
    ).all();

    if (availabilities.length > 0) {
      const addisMidnight = parseAddisDate(slotDateString);
      const slotMinuteOfDay = Math.round((startTimeMs - addisMidnight.getTime()) / 60000);
      const parseTime = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };

      const insideAnyWindow = availabilities.some((a) => {
        const start = parseTime(a.startTime);
        const end = parseTime(a.endTime);

        // Normal shift (same-day): slot must be within [start, end)
        if (start < end) {
          return slotMinuteOfDay >= start && slotMinuteOfDay < end;
        }

        // Overnight shift (crosses midnight): start >= end.
        // Two segments: [start, 24*60) today and [0, end) tomorrow.
        // If the slot is before Addis midnight (slotMinuteOfDay >= start),
        // it's in the "today" segment. If it's after midnight
        // (slotMinuteOfDay < end), it's in the "tomorrow" segment.
        return slotMinuteOfDay >= start || slotMinuteOfDay < end;
      });
      if (!insideAnyWindow) {
        return { code: 'OUTSIDE_AVAILABILITY', error: 'The selected staff member is not available at this time.' };
      }
    }
  }

  return null;
}

async function findSlotConflict(tenantId: string, staffId: string, startMs: number, endMs: number, excludeAppointmentId?: string) {
  const filter = and(
    eq(appointments.tenantId, tenantId),
    eq(appointments.staffId, staffId),
    or(eq(appointments.status, 'confirmed'), eq(appointments.status, 'pending')),
    lt(appointments.startTime, endMs),
    gte(appointments.endTime, startMs),
  );
  const where = excludeAppointmentId
    ? and(filter, sql`${appointments.id} != ${excludeAppointmentId}`)
    : filter;
  return db.select({ id: appointments.id }).from(appointments).where(where).get();
}

router.post('/bookings', bookingWriteLimiter, async (req, res) => {
  const tenant = (req as any).tenant;

  try {
    const data = BookingSchema.parse(req.body);

    // Bot check: server-side Turnstile (enforced when a secret is configured).
    if (isTurnstileConfigured()) {
      const token = (req.body as any)?.turnstile_token;
      if (!token) {
        return res.status(422).json({ error: 'Bot check required. Please verify you are human.', code: 'TURNSTILE_MISSING' });
      }
      const verify = await verifyTurnstileToken(token);
      if (!verify.success) {
        return res.status(422).json({ error: 'Bot check failed. Please retry the verification.', code: 'TURNSTILE_INVALID' });
      }
    }

    // Resolve the list of services for booking.
    // - service_ids takes precedence (multi-service bookings).
    // - service_id (scalar) is deprecated but kept for backward compatibility.
    const serviceIds: string[] = data.service_ids && data.service_ids.length > 0
      ? data.service_ids
      : [data.service_id!];

    const bookedServices = await db.select()
      .from(services)
      .where(
        and(
          eq(services.tenantId, tenant.id),
          inArray(services.id, serviceIds),
        ),
      )
      .all();

    // Every requested service must exist and belong to this tenant.
    if (bookedServices.length !== serviceIds.length) {
      return res.status(404).json({ error: 'One or more services not found' });
    }

    // Sum durations from the DB (never trust the client).
    const totalDurationMinutes = bookedServices.reduce((sum, s) => sum + s.durationMinutes, 0);
    // Sum prices from the DB.
    const totalPriceCents = bookedServices.reduce((sum, s) => sum + s.price, 0);

    const staffRow = await db.select({ id: staff.id }).from(staff)
      .where(and(eq(staff.id, data.staff_id), eq(staff.tenantId, tenant.id))).get();
    if (!staffRow) {
      logSecurityEvent({
        type: 'cross_tenant_attempt',
        tenantId: tenant.id,
        ip: ipFromRequest(req),
        details: { path: req.path, staffId: data.staff_id },
      });
      return res.status(404).json({ error: 'Staff not found' });
    }

    const customerPhone = normalizePhone(data.customer_phone);
    if (!customerPhone) {
      return res.status(422).json({ error: 'Enter a valid Ethiopian phone number' });
    }

    const startTimeMs = new Date(data.start_time).getTime();
    // Use the composite duration (sum of all selected services from the DB).
    const endTimeMs = startTimeMs + totalDurationMinutes * 60000;

    const slotError = await assertSlotAllowed(tenant, startTimeMs, data.staff_id);
    if (slotError) {
      return res.status(422).json(slotError);
    }

    // A customer pays upfront when the tenant requires it globally OR when
    // this specific phone is flagged (high-no-show-risk) in settings.
    const upfrontPhones: string[] = Array.isArray((tenant.settings as any)?.require_upfront_phones)
      ? (tenant.settings as any).require_upfront_phones
      : [];
    const phoneRequiresUpfront = upfrontPhones.includes(customerPhone);
    const requiresPayment = (tenant.settings?.require_payment_upfront === true) || phoneRequiresUpfront;
    let initialStatus = requiresPayment ? 'pending' : 'confirmed';

    // --- Promo code validation ---
    let promoDiscount = 0;
    let promoCodeId: string | null = null;
    if (data.promo_code) {
      const codeRow = await db.select().from(promoCodes)
        .where(and(eq(promoCodes.tenantId, tenant.id), eq(promoCodes.code, data.promo_code.trim())))
        .get();
      if (!codeRow) {
        return res.status(422).json({ error: 'Invalid promo code', code: 'PROMO_INVALID' });
      }
      if (!codeRow.isActive) {
        return res.status(422).json({ error: 'Promo code is no longer active', code: 'PROMO_INACTIVE' });
      }
      const now = Date.now();
      if (codeRow.validFrom && now < codeRow.validFrom) {
        return res.status(422).json({ error: 'Promo code is not yet valid', code: 'PROMO_NOT_YET_VALID' });
      }
      if (codeRow.validUntil && now > codeRow.validUntil) {
        return res.status(422).json({ error: 'Promo code has expired', code: 'PROMO_EXPIRED' });
      }
      if (codeRow.usedCount >= codeRow.maxUses) {
        return res.status(422).json({ error: 'Promo code has reached its maximum uses', code: 'PROMO_EXHAUSTED' });
      }
      promoCodeId = codeRow.id;
      if (codeRow.discountType === 'percent') {
        promoDiscount = Math.floor(totalPriceCents * codeRow.discountValue / 100);
      } else {
        promoDiscount = codeRow.discountValue;
      }
    }

    const effectiveAmount = Math.max(0, totalPriceCents - promoDiscount);

    const appId = crypto.randomUUID();
    let paymentId: string | null = null;
    let txRef: string | null = null;

    try {
      await db.transaction(async (tx) => {
        const conflicting = await tx.select().from(appointments).where(
          and(
            eq(appointments.tenantId, tenant.id),
            eq(appointments.staffId, data.staff_id),
            or(eq(appointments.status, 'confirmed'), eq(appointments.status, 'pending')),
            lt(appointments.startTime, endTimeMs),
            gte(appointments.endTime, startTimeMs)
          )
        ).get();

        if (conflicting) {
          throw new Error('CONFLICT');
        }

         const opaqueId = crypto.randomBytes(16).toString('hex');
         await tx.insert(appointments).values({
          id: appId,
          tenantId: tenant.id,
          staffId: data.staff_id,
          serviceId: bookedServices[0].id,
          customerName: data.customer_name,
          customerPhone,
          customerEmail: data.customer_email || null,
          startTime: startTimeMs,
          endTime: endTimeMs,
          status: initialStatus,
          reminderSent: false,
          cancelsAt: requiresPayment ? startTimeMs - 15 * 60 * 1000 : null,
          opaqueId,
        });

        // Persist the multi-service breakdown into appointment_services
        // (one row per selected service, priced/timed as of booking moment).
        await tx.insert(appointmentServices).values(
          bookedServices.map((s) => ({
            appointmentId: appId,
            serviceId: s.id,
            priceAtBooking: s.price,
            durationMinutes: s.durationMinutes,
          })),
        );

        if (requiresPayment) {
          txRef = generateTxRef('egebeya-');
          paymentId = crypto.randomUUID();
          await tx.insert(payments).values({
            id: paymentId,
            tenantId: tenant.id,
            appointmentId: appId,
            amount: effectiveAmount,
            gateway: 'chapa',
            method: 'telebirr',
            gatewayReference: txRef,
            status: 'pending',
          });
        }

        // Increment promo code usage count if a code was applied.
        if (promoCodeId) {
          await tx.update(promoCodes)
            .set({ usedCount: sql`used_count + 1` })
            .where(eq(promoCodes.id, promoCodeId));
        }
      }, { behavior: 'immediate' });
    } catch (err: any) {
      if (err.message === 'CONFLICT') {
        return res.status(409).json({ error: 'Time slot is no longer available' });
      }
      throw err;
    }

    let finalStatus = initialStatus;
    let paymentStatus: string | null = null;

    if (requiresPayment && txRef && paymentId) {
      const amountBirr = (effectiveAmount / 100).toFixed(2);
      const firstName = data.customer_name.split(' ')[0] || data.customer_name;
      const lastName = data.customer_name.split(' ').slice(1).join(' ') || undefined;

      try {
        const init = await initiateDirectCharge(
          customerPhone,
          amountBirr,
          txRef,
          firstName,
          lastName,
          data.customer_email || undefined,
        );

        await authorizeDirectCharge(init.ref_id);

        let verifiedStatus: string = 'pending';
        try {
          const verification = await verifyPayment(txRef);
          verifiedStatus = verification.status;
        } catch (verifyErr) {
          console.error('Chapa verify failed (leaving as pending):', verifyErr);
        }

        if (verifiedStatus === 'success') {
          finalStatus = 'confirmed';
          paymentStatus = 'completed';
          await db.update(payments).set({ status: 'completed' }).where(eq(payments.id, paymentId));
          await db.update(appointments).set({ status: 'confirmed' }).where(eq(appointments.id, appId));
        } else {
          finalStatus = 'pending';
          paymentStatus = 'pending';
        }
      } catch (chapaErr: any) {
        console.error('Chapa initiation failed — rolling back payment+appointment:', chapaErr?.message || chapaErr);
        try {
          await db.delete(payments).where(eq(payments.id, paymentId));
        } catch {}
        try {
          await db.delete(appointments).where(eq(appointments.id, appId));
        } catch {}
        return res.status(402).json({ error: 'Payment initiation failed. Booking was not created.' });
      }
    }

    // Populate customer_stats after a confirmed booking.
    if (finalStatus === 'confirmed') {
      const now = Date.now();
      const existing = await db.select()
        .from(customerStats)
        .where(and(eq(customerStats.tenantId, tenant.id), eq(customerStats.customerPhone, customerPhone)))
        .get();
      if (existing) {
        await db.update(customerStats)
          .set({
            visitCount: existing.visitCount + 1,
            totalSpendEtbCents: existing.totalSpendEtbCents + effectiveAmount,
            lastVisitAt: endTimeMs,
            customerName: data.customer_name,
          })
          .where(and(eq(customerStats.tenantId, tenant.id), eq(customerStats.customerPhone, customerPhone)));
      } else {
        await db.insert(customerStats).values({
          tenantId: tenant.id,
          customerPhone,
          customerName: data.customer_name,
          firstVisitAt: startTimeMs,
          lastVisitAt: endTimeMs,
          visitCount: 1,
          totalSpendEtbCents: effectiveAmount,
          lastCancelledAt: null,
          createdAt: Date.now(),
        });
      }
    }

    const result = { id: appId, status: finalStatus, paymentStatus, data };
    const serviceNames = bookedServices.map((s) => s.name).join(', ');
    const ethiopianDateStr = formatEthiopianDateTime(startTimeMs);
    if (result.data.customer_email) {
      const customerLocale: 'en' | 'am' = String((tenant.settings as any)?.defaultLocale || 'en').startsWith('am') ? 'am' : 'en';
      const customerMail = applyTemplate('bookingCustomer', customerLocale, {
        name: result.data.customer_name,
        service: serviceNames,
        status: result.status,
        business: tenant.name,
        date: ethiopianDateStr,
      });

      sendMail({
        to: result.data.customer_email,
        subject: customerMail.subject,
        text: customerMail.text,
      }).catch((err) => console.error('Failed to send customer booking email:', err));
    }

    // Notify the tenant owner (filtered by role='owner' rather than the
    // naive "first user for tenant" the previous code used — staff invites
    // create rows with role='staff', and an insert-order drift would have
    // sent the booking alert to a staff member instead of the owner).
    const owner = await db.select().from(users)
      .where(and(eq(users.tenantId, tenant.id), eq(users.role, 'owner')))
      .get();
    if (owner && owner.email) {
      const ownerLocale: 'en' | 'am' = String((owner as any)?.locale || (tenant.settings as any)?.defaultLocale || 'en').startsWith('am') ? 'am' : 'en';
      const ownerMail = applyTemplate('bookingOwner', ownerLocale, {
        name: result.data.customer_name,
        service: serviceNames,
        date: ethiopianDateStr,
      });

      sendMail({
        to: owner.email,
        subject: ownerMail.subject,
        text: ownerMail.text,
      }).catch((err) => console.error('Failed to send owner booking email:', err));
    }
    res.status(201).json({ success: true, appointment: result });
  } catch (error: any) {
    if (error.message === 'CONFLICT') {
      return res.status(409).json({ error: 'Time slot is no longer available' });
    }
    if (error instanceof z.ZodError) {
      return res.status(422).json({ error: error.issues });
    }
    console.error('Booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Public booking ownership lookup: id + customer phone are both required.
async function resolveOwnedBooking(req: any, res: any): Promise<any | null> {
  const tenant = (req as any).tenant;
  const { id } = req.params;
  const phone = normalizePhone((req.body as any)?.customer_phone);
  if (!phone) {
    res.status(400).json({ error: 'A valid Ethiopian phone number is required' });
    return null;
  }
  const appt = await db.select().from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.tenantId, tenant.id))).get();
  if (!appt) {
    res.status(404).json({ error: 'Booking not found' });
    return null;
  }
  if (appt.customerPhone !== phone) {
    res.status(403).json({ error: 'Phone number does not match this booking' });
    return null;
  }
  return appt;
}

router.post('/bookings/:id/cancel', bookingWriteLimiter, async (req, res) => {
  const tenant = (req as any).tenant;
  try {
    const appt = await resolveOwnedBooking(req, res);
    if (!appt) return;

    if (!['pending', 'confirmed'].includes(appt.status)) {
      return res.status(400).json({ error: 'Only pending or confirmed bookings can be cancelled.' });
    }

    await db.update(appointments).set({ status: 'cancelled' }).where(eq(appointments.id, appt.id));

    const payment = await db.select().from(payments).where(eq(payments.appointmentId, appt.id)).get();
    res.json({
      success: true,
      status: 'cancelled',
      refundNote: payment && payment.status === 'completed'
        ? 'A refund must be issued manually by the business.'
        : undefined,
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

router.post('/bookings/:id/reschedule', bookingWriteLimiter, async (req, res) => {
  const tenant = (req as any).tenant;
  try {
    const appt = await resolveOwnedBooking(req, res);
    if (!appt) return;

    if (appt.status === 'cancelled') {
      return res.status(400).json({ error: 'Cancelled bookings cannot be rescheduled.' });
    }

    const { start_time } = req.body as { start_time?: string };
    if (!start_time) {
      return res.status(400).json({ error: 'start_time is required' });
    }
    const startTimeMs = new Date(start_time).getTime();
    if (!Number.isFinite(startTimeMs)) {
      return res.status(422).json({ error: 'Invalid start_time. Expected an ISO 8601 timestamp.' });
    }

    const service = await db.select().from(services)
      .where(and(eq(services.id, appt.serviceId), eq(services.tenantId, tenant.id))).get();
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    const endTimeMs = startTimeMs + service.durationMinutes * 60000;

    const slotError = await assertSlotAllowed(tenant, startTimeMs, appt.staffId);
    if (slotError) return res.status(422).json(slotError);

    const conflict = await findSlotConflict(tenant.id, appt.staffId, startTimeMs, endTimeMs, appt.id);
    if (conflict) {
      return res.status(409).json({ error: 'That time is no longer available' });
    }

    const rescheduleUpfrontPhones: string[] = Array.isArray((tenant.settings as any)?.require_upfront_phones)
      ? (tenant.settings as any).require_upfront_phones
      : [];
    const reschedulePhoneUpfront = rescheduleUpfrontPhones.includes(appt.customerPhone);
    const requiresPayment = (tenant.settings?.require_payment_upfront === true) || reschedulePhoneUpfront;
    const newStatus = requiresPayment ? 'pending' : 'confirmed';

    await db.update(appointments).set({
      startTime: startTimeMs,
      endTime: endTimeMs,
      status: newStatus,
      cancelsAt: requiresPayment ? startTimeMs - 15 * 60 * 1000 : null,
    }).where(eq(appointments.id, appt.id));

    res.json({ success: true, appointment: { id: appt.id, startTime: startTimeMs, endTime: endTimeMs, status: newStatus } });
  } catch (error) {
    console.error('Reschedule booking error:', error);
    res.status(500).json({ error: 'Failed to reschedule booking' });
  }
});

/**
 * GET /api/public/appointments/:id/status?customer_phone=...
 *
 * Returns the appointment status + payment status for display on the
 * customer-facing booking-confirmation page (/book/:slug/confirmation/:id).
 *
 * Enforces the same phone-number ownership check as the cancel/reschedule
 * endpoints. The phone is passed as a query parameter so the browser can
 * poll this endpoint with a GET. Never exposes internal IDs, password hashes,
 * or raw Chapa metadata — only payment status and amount in ETB cents.
 */
router.get('/appointments/:id/status', async (req, res) => {
  const tenant = (req as any).tenant;
  const { id } = req.params; // This is now opaqueId
  const phone = normalizePhone(req.query.customer_phone as string | undefined);

  if (!phone) {
    return res.status(400).json({ error: 'A valid Ethiopian phone number is required (customer_phone query parameter)' });
  }

  try {
    const appt = await db.select().from(appointments)
      .where(and(eq(appointments.opaqueId, id), eq(appointments.tenantId, tenant.id))).get();

    if (!appt) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    if (appt.customerPhone !== phone) {
      return res.status(403).json({ error: 'Phone number does not match this booking' });
    }

    // Fetch the service name (for the confirmation screen) and payment row.
    const [svc, payment] = await Promise.all([
      db.select({ name: services.name, price: services.price })
        .from(services)
        .where(and(eq(services.id, appt.serviceId), eq(services.tenantId, tenant.id)))
        .get(),
      db.select({ status: payments.status, amount: payments.amount })
        .from(payments)
        .where(eq(payments.appointmentId, appt.id))
        .get(),
    ]);

    // Projection: no internal IDs, no raw Chapa meta, no password hashes.
    res.json({
      status: appt.status,
      paymentStatus: payment?.status ?? null,
      amountEtbCents: payment?.amount ?? null,
      serviceName: svc?.name ?? null,
      customerName: appt.customerName,
      staffId: appt.staffId,
      startTime: appt.startTime,
      // Ethiopian date string for the confirmation screen.
      startDateDisplay: formatEthiopianDateTime(appt.startTime),
    });
  } catch (error) {
    console.error('Appointment status error:', error);
    res.status(500).json({ error: 'Failed to fetch appointment status' });
  }
});

router.get('/appointments', async (req, res) => {
  const tenant = (req as any).tenant;

  try {
    const rows = await db.select({
      id: appointments.opaqueId, // Return opaqueId instead of internal UUID
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
      serviceName: services.name,
    })
      .from(appointments)
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .where(
        and(
          eq(appointments.tenantId, tenant.id),
          or(eq(appointments.status, 'confirmed'), eq(appointments.status, 'pending')),
        )
      )
      .all();

    // Default Ethiopian, but if tenant explicitly asks for gregorian, use
    // formatAddisSlotTime (HH:MM string) — same old default for the widget.
    const calendarDisplay = (tenant.settings as any)?.calendar_display;
    const useEthiopian = calendarDisplay !== 'gregorian';

    const publicRows = rows
      .map((r) => ({
        startTime: useEthiopian
          ? formatEthiopianDateCompact(r.startTime)
          : formatAddisSlotTime(r.startTime),
        status: r.status,
        serviceName: r.serviceName,
      }))
      .sort((a, b) => {
        // Sorting by the rendered string approximates chronological for
        // Ethiopian compact dates (year/month/day); for Gregorian HH:MM
        // sorting it's lexicographic.
        return a.startTime.localeCompare(b.startTime);
      });

    res.json(publicRows);
  } catch (error) {
    console.error('Public appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

/**
 * GET /api/public/pro-build — serve the published Code Mode build for the
 * resolved tenant.
 *
 * When a Pro tenant has builder_mode='code' and an active_build_id set, this
 * route returns the static index.html that was written to
 * storage/pro-builds/{tenantId}/{buildId}/ during the last publish.
 *
 * The response includes a Strict CSP header that only allows the platform's
 * own domain for frames (Egebeya widget iframes) and blocks inline scripts
 * that were not already stripped by the publish-time sanitizer.
 *
 * This endpoint is mounted AFTER the tenant-resolution middleware (slug →
 * tenant) so `req.tenant` is populated.
 */
router.get('/pro-build', async (req, res) => {
  const tenant = (req as any).tenant;
  if (!tenant) return res.status(400).json({ error: 'Tenant not resolved' });

  try {
    const config = await db.select({
      builderMode: siteConfig.builderMode,
      activeBuildId: siteConfig.activeBuildId,
    }).from(siteConfig)
      .where(eq(siteConfig.tenantId, tenant.id))
      .get();

    if (!config || config.builderMode !== 'code' || !config.activeBuildId) {
      return res.status(404).json({ error: 'No published build for this tenant' });
    }

    const buildPath = path.join(
      process.cwd(), 'storage', 'pro-builds',
      tenant.id, config.activeBuildId, 'index.html',
    );

    if (!fs.existsSync(buildPath)) {
      console.error(`[pro-build] Build file missing for tenant ${tenant.id}, build ${config.activeBuildId}`);
      return res.status(404).json({ error: 'Build file not found' });
    }

    const html = fs.readFileSync(buildPath, 'utf8');

    // Strict CSP for published sites — only the platform's own origin can
    // be used for frames (Egebeya widgets), no inline scripts (already
    // sanitised), no eval.
    const embedDomain = process.env.PUBLIC_EMBED_DOMAIN || process.env.APP_URL || 'https://egebeya.et';
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      `frame-src 'self' ${embedDomain}`,
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; ');

    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': csp,
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(html);
  } catch (error) {
    console.error('[pro-build] Serve error:', error);
    res.status(500).json({ error: 'Failed to serve published build' });
  }
});

export default router;
