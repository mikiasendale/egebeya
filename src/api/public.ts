import { Router } from 'express';
import { db } from '../db';
import { tenants, services, staff, staffServices, staffAvailability, appointments, tenantBusinessHours, tenantClosures, pages, payments, users } from '../db/schema';
import { eq, and, inArray, gte, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import crypto from 'crypto';
import { sendMail } from '../../server/lib/mailer';
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
  toAddis,
} from '../../server/lib/timezone';

const router = Router();

// Public, tenant-agnostic directory used by /discover. Must be registered
// BEFORE the tenant-resolution middleware below so it does not require a
// tenant slug.
//
// The directory surfaces ONLY real data the tenant has supplied: their name,
// category, chosen city (if they've filled one in Settings General), and the
// hero image they uploaded in the Puck editor. Until a tenant has at least
// one past/active booking we surface "isNew": true so the frontend can show
// a "New" pill instead of fabricating a 4.8/5 average rating (there is no
// review system, so any rating would be a lie).
router.get('/discover', async (_req, res) => {
  try {
    const rows = await db.select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      category: tenants.category,
      settings: tenants.settings,
      createdAt: tenants.createdAt,
    })
      .from(tenants)
      .where(eq(tenants.isListed, true))
      .orderBy(tenants.name)
      .all();

    if (rows.length === 0) {
      return res.json([]);
    }

    // One round-trip: pages for hero images + a per-tenant booking count.
    // "real" bookings = anything that is confirmed or completed (not pending,
    // not cancelled, not no_show — those tell us nothing about whether the
    // business has actually served anyone).
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
        // Only return a hero image that's actually the tenant's uploaded media
        // (path under /uploads). Reject default Unsplash URLs that ship with
        // the Puck template — those tell /discover nothing about the tenant
        // and would re-introduce fabricated-looking stock photos.
        heroImage: pickTenantMedia(heroByTenant.get(r.id) || null),
        // True only when this tenant has never had a confirmed/completed
        // booking — the frontend shows "New" instead of a rating.
        isNew: realBookings === 0,
        createdAt: r.createdAt,
      };
    });

    res.json(out);
  } catch (error) {
    console.error('Discover error:', error);
    res.status(500).json({ error: 'Failed to fetch discover listing' });
  }
});

// Walk a Puck page JSON document and pull the `backgroundImage` off the first
// Hero block. Puck stores blocks under `content: [{type, props, data}]` after
// our editor publishes, or after the onboarding wizard's auto-generated layout.
// Returns null when there's no Hero block, no `backgroundImage` prop, or the
// document shape is unexpected.
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

// Accept only media the tenant uploaded themselves (served from our
// /uploads/<tenantId>/... path). Anything else (Unsplash defaults shipped with
// the Puck template, ui-avatars placeholders, etc.) is treated as "no image"
// so /discover falls back to a plain branded placeholder, never a stock photo.
function pickTenantMedia(url: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/api/uploads/')) {
    return trimmed;
  }
  return null;
}

// Middleware to resolve tenant from X-Tenant-Slug header or Host
router.use(async (req, res, next) => {
  let slug = req.headers['x-tenant-slug'] as string;
  
  if (!slug) {
    const host = req.headers.host || '';
    slug = host.split('.')[0];
  }
  
  if (!slug) {
    return res.status(400).json({ error: 'Tenant slug not found' });
  }

  const tenant = await db.select().from(tenants).where(eq(tenants.slug, slug)).get();
  
  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }
  
  (req as any).tenant = tenant;
  next();
});

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
    res.json({ tenant, page });
  } catch (error) {
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
    let query = db.select({
      id: staff.id,
      name: staff.name,
      title: staff.title,
      bio: staff.bio,
      imagePath: staff.imagePath,
    }).from(staff).where(and(eq(staff.tenantId, tenant.id), eq(staff.active, true)));

    const staffMembers = await query.all();
    
    if (serviceId) {
      // Filter by staff that provide this service
      const mappings = await db.select().from(staffServices).where(eq(staffServices.serviceId, serviceId)).all();
      const staffIds = mappings.map(m => m.staffId);
      const filtered = staffMembers.filter(s => staffIds.includes(s.id));
      return res.json(filtered);
    }
    
    res.json(staffMembers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

router.get('/availability', async (req, res) => {
  const tenant = (req as any).tenant;
  const { staff_id, date } = req.query;

  if (!staff_id || !date) {
    return res.status(400).json({ error: 'staff_id and date are required' });
  }

  try {
    // The date param is interpreted as a calendar date in Addis Ababa timezone.
    const addisMidnight = parseAddisDate(date as string);
    const addisDayEnd = new Date(addisMidnight.getTime() + 24 * 3600 * 1000);
    const dayOfWeek = getAddisDayOfWeek(addisMidnight);
    const dateString = getAddisDateString(addisMidnight);

    // 0. Reject past dates explicitly — the frontend disables them, but the
    //    backend must never return slots for a day that has already begun.
    if (addisDayEnd.getTime() <= Date.now()) {
      return res.status(422).json({
        error: 'Cannot fetch availability for a past date.',
        code: 'PAST_DATE',
      });
    }

    // 1. Check tenant closures
    const closures = await db.select().from(tenantClosures).where(
      and(eq(tenantClosures.tenantId, tenant.id), eq(tenantClosures.date, dateString))
    ).all();

    if (closures.length > 0) {
      return res.status(422).json({
        error: 'The business is closed on this date.',
        code: 'CLOSED_DATE',
      });
    }

    // 2. Check tenant business hours for that Addis day-of-week
    const businessHours = await db.select().from(tenantBusinessHours).where(
      and(eq(tenantBusinessHours.tenantId, tenant.id), eq(tenantBusinessHours.dayOfWeek, dayOfWeek))
    ).get();

    if (businessHours?.isClosed) {
      return res.status(422).json({
        error: 'The business is closed on this day of the week.',
        code: 'CLOSED_DAY',
      });
    }

    const tOpen = businessHours?.openTime || '00:00';
    const tClose = businessHours?.closeTime || '23:59';

    // 3. Check staff availability for that day-of-week
    const availabilities = await db.select().from(staffAvailability).where(
      and(eq(staffAvailability.staffId, staff_id as string), eq(staffAvailability.dayOfWeek, dayOfWeek))
    ).all();

    if (availabilities.length === 0) {
      return res.json([]);
    }

    // Fetch appointments overlapping this Addis day (with ~1h margin)
    const staffAppointments = await db.select().from(appointments).where(
      and(
        eq(appointments.staffId, staff_id as string),
        or(eq(appointments.status, 'confirmed'), eq(appointments.status, 'pending')),
        gte(appointments.startTime, addisMidnight.getTime() - 3600_000),
        lt(appointments.startTime, addisDayEnd.getTime() + 3600_000)
      )
    ).all();

    // Helper: parse "HH:MM" as minutes since midnight
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
      if (startMin >= endMin) continue;

      for (let min = startMin; min < endMin - 29; min += 30) {
        // Build UTC Date for this slot: addisMidnight + min*60*1000
        const slotUtcMs = addisMidnight.getTime() + min * 60 * 1000;
        const slotEndUtcMs = slotUtcMs + 30 * 60 * 1000;

        const conflict = staffAppointments.some((app) => {
          return slotUtcMs < app.endTime && slotEndUtcMs > app.startTime;
        });

        if (!conflict) {
          slots.push(formatAddisSlotTime(slotUtcMs));
        }
      }
    }

    const uniqueSlots = Array.from(new Set(slots)).sort();
    res.json(uniqueSlots);
  } catch (error) {
    console.error('Availability error:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// Ethiopian phone format: +251 followed by 9 digits.
const PHONE_RE = /^\+251\d{9}$/;

const BookingSchema = z.object({
  staff_id: z.string().uuid(),
  service_id: z.string().uuid(),
  // Accept both UTC "...Z" and timezone-offset "...+03:00" ISO timestamps
  start_time: z.string().datetime({ offset: true }),
  customer_name: z.string().min(1),
  customer_phone: z
    .string()
    .regex(PHONE_RE, 'Enter a valid Ethiopian phone number (+251XXXXXXXXX)'),
  customer_email: z.string().email().optional().or(z.literal('')),
});

router.post('/bookings', async (req, res) => {
  const tenant = (req as any).tenant;
  
  try {
    const data = BookingSchema.parse(req.body);
    
    const service = await db.select().from(services).where(eq(services.id, data.service_id)).get();
    if (!service) return res.status(404).json({ error: 'Service not found' });
    
    const startTimeMs = new Date(data.start_time).getTime();
    const endTimeMs = startTimeMs + service.durationMinutes * 60000;

    // ---- Server-side past-date / closed-day / closure validation ----
    // The PHP-style rule of "never trust the client" means we always re-check
    // these on the backend, regardless of what the UI disables.
    if (!Number.isFinite(startTimeMs)) {
      return res.status(422).json({
        error: 'Invalid start_time. Expected an ISO 8601 timestamp.',
        code: 'INVALID_TIME',
      });
    }
    if (startTimeMs <= Date.now()) {
      return res.status(422).json({
        error: 'Cannot book a time in the past.',
        code: 'PAST_DATE',
      });
    }

    const slotStartDate = new Date(startTimeMs);
    const slotDayOfWeek = getAddisDayOfWeek(slotStartDate);
    const slotDateString = getAddisDateString(slotStartDate);

    // Closure check (an explicit one-off closed date).
    const closures = await db.select().from(tenantClosures).where(
      and(eq(tenantClosures.tenantId, tenant.id), eq(tenantClosures.date, slotDateString))
    ).all();
    if (closures.length > 0) {
      return res.status(422).json({
        error: 'The business is closed on this date.',
        code: 'CLOSED_DATE',
        date: slotDateString,
      });
    }

    // Business hours / isClosed day-of-week check.
    const businessHours = await db.select().from(tenantBusinessHours).where(
      and(eq(tenantBusinessHours.tenantId, tenant.id), eq(tenantBusinessHours.dayOfWeek, slotDayOfWeek))
    ).get();
    if (businessHours?.isClosed) {
      return res.status(422).json({
        error: 'The business is closed on this day of the week.',
        code: 'CLOSED_DAY',
      });
    }

    const requiresPayment = (tenant.settings?.require_payment_upfront === true);
    const initialStatus = requiresPayment ? 'pending' : 'confirmed';

    // ---- Phase 1: insert the appointment (+ pending payment row if needed) ----
    const appId = crypto.randomUUID();
    let paymentId: string | null = null;
    let txRef: string | null = null;

    try {
      // Use BEGIN IMMEDIATE so a write lock is acquired up front. With the
      // default deferred transaction, two concurrent bookings could both pass
      // the conflict-check read and then race to insert — producing a double
      // write. With 'immediate', the second transaction blocks until the
      // first commits, then re-evaluates the conflict and bails out with 409.
      await db.transaction(async (tx) => {
        // Schema note: appointments.staffId is the row we want to lock,
        // and SQLite (libsql) has no SELECT ... FOR UPDATE — it acquires
        // a file-wide write lock on BEGIN IMMEDIATE, so any concurrent
        // booking for the same staff_id serializes through this lock.
        // The conflict re-read below sees the freshly-inserted row.

        const conflicting = await tx.select().from(appointments).where(
          and(
            eq(appointments.staffId, data.staff_id),
            or(eq(appointments.status, 'confirmed'), eq(appointments.status, 'pending')),
            lt(appointments.startTime, endTimeMs),
            gte(appointments.endTime, startTimeMs)
          )
        ).get();

        if (conflicting) {
          throw new Error('CONFLICT');
        }

        await tx.insert(appointments).values({
          id: appId,
          tenantId: tenant.id,
          staffId: data.staff_id,
          serviceId: data.service_id,
          customerName: data.customer_name,
          customerPhone: data.customer_phone,
          customerEmail: data.customer_email || null,
          startTime: startTimeMs,
          endTime: endTimeMs,
          status: initialStatus,
          reminderSent: false,
        });

        if (requiresPayment) {
          txRef = generateTxRef('egebeya-');
          paymentId = crypto.randomUUID();
          await tx.insert(payments).values({
            id: paymentId,
            tenantId: tenant.id,
            appointmentId: appId,
            amount: service.price,
            gateway: 'chapa',
            method: 'telebirr',
            gatewayReference: txRef,
            status: 'pending',
          });
        }
      }, { behavior: 'immediate' });
    } catch (err: any) {
      if (err.message === 'CONFLICT') {
        return res.status(409).json({ error: 'Time slot is no longer available' });
      }
      throw err;
    }

    // ---- Phase 2: Chapa direct charge (only when upfront payment is required) ----
    let finalStatus = initialStatus;
    let paymentStatus: string | null = null;

    if (requiresPayment && txRef && paymentId) {
      const amountBirr = (service.price / 100).toFixed(2); // cents -> birr
      // Reuse customer_name as the first name for the charge
      const firstName = data.customer_name.split(' ')[0] || data.customer_name;
      const lastName = data.customer_name.split(' ').slice(1).join(' ') || undefined;

      try {
        // Step (c) initiate
        const init = await initiateDirectCharge(
          data.customer_phone,
          amountBirr,
          txRef,
          firstName,
          lastName,
          data.customer_email || undefined,
        );

        // Step (e) authorize (test mode succeeds instantly)
        await authorizeDirectCharge(init.ref_id);

        // Step (f) verify
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
        // Step (d) rollback: delete the appointment and the pending payment row
        console.error('Chapa initiation failed — rolling back payment+appointment:', chapaErr?.message || chapaErr);
        try {
          await db.delete(payments).where(eq(payments.id, paymentId));
        } catch {}
        try {
          await db.delete(appointments).where(eq(appointments.id, appId));
        } catch {}
        return res.status(402).json({
          error: 'Payment initiation failed. Booking was not created.',
          detail: chapaErr?.message || 'Chapa error',
        });
      }
    }

    const result = {
      id: appId,
      status: finalStatus,
      paymentStatus,
      data,
    };

    // Send confirmation emails asynchronously (only when actually booked)
    const appointmentDateStr = new Date(startTimeMs).toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' });
    if (result.data.customer_email) {
      sendMail({
        to: result.data.customer_email,
        subject: `Booking ${result.status}: ${service.name} at ${tenant.name}`,
        text: `Hello ${result.data.customer_name},\n\nYour appointment for ${service.name} is ${result.status}.\nDate: ${appointmentDateStr}\n\nThank you for choosing ${tenant.name}!`,
      }).catch(console.error);
    }
    
    const owner = await db.select().from(users).where(eq(users.tenantId, tenant.id)).get();
    if (owner && owner.email) {
      sendMail({
        to: owner.email,
        subject: `New Booking: ${service.name}`,
        text: `A new booking has been made by ${result.data.customer_name} for ${service.name}.\nDate: ${appointmentDateStr}`,
      }).catch(console.error);
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

// Public "today's queue" endpoint — returns upcoming appointments for a given
// date in the tenant's timezone. Does not expose customer names.
router.get('/appointments', async (req, res) => {
  const tenant = (req as any).tenant;
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'date query parameter (YYYY-MM-DD) is required' });
  }

  try {
    const addisMidnight = parseAddisDate(date as string);
    const addisDayEnd = new Date(addisMidnight.getTime() + 24 * 3600 * 1000);

    const rows = await db.select({
      id: appointments.id,
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
          gte(appointments.startTime, addisMidnight.getTime()),
          lt(appointments.startTime, addisDayEnd.getTime())
        )
      )
      .all();

    const publicRows = rows
      .map((r) => ({
        id: r.id,
        startTime: formatAddisSlotTime(r.startTime),
        status: r.status,
        serviceName: r.serviceName,
      }))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    res.json(publicRows);
  } catch (error) {
    console.error('Public appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

export default router;
