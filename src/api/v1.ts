import { Router } from 'express';
import { db } from '../db';
import { tenants, services, staff, appointments, appointmentServices } from '../db/schema';
import { eq, and, or, gte, lt, inArray } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import { requireApiKey } from './middleware/apiKey';
import { formatEthiopianDate, formatEthiopianDateTime, formatAddisSlotTime } from '../../server/lib/timezone';
import { normalizePhone } from '../lib/phone';
import { logSecurityEvent, ipFromRequest } from '../../server/lib/securityLog';
import {
  initiateDirectCharge,
  authorizeDirectCharge,
  verifyPayment,
  generateTxRef,
} from '../../server/lib/chapa';
import { sendMail } from '../../server/lib/mailer';
import { applyTemplate } from '../../server/lib/mailTemplates';

const router = Router();

// ─── Tenant resolution from query param ─────────────────────────────
// The v1 API resolves the target tenant via ?tenant_slug=... instead of
// X-Tenant-Slug headers — a more natural RESTful pattern for third-party
// integrators.
async function resolveTenant(slug: string): Promise<any | null> {
  const raw = String(slug).trim();
  return db.select().from(tenants)
    .where(or(eq(tenants.slug, raw), eq(tenants.slug, raw.toLowerCase())))
    .get();
}

// ─── GET /api/v1/services ──────────────────────────────────────────
// Requires `read:services` scope. Returns public-safe projection:
// name, duration, price. No internal IDs beyond what's needed.
router.get('/services', requireApiKey('read:services'), async (req, res) => {
  try {
    const slug = req.query.tenant_slug as string | undefined;
    if (!slug) {
      return res.status(400).json({ error: 'tenant_slug is required' });
    }

    const tenant = await resolveTenant(slug);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const rows = await db.select()
      .from(services)
      .where(and(eq(services.tenantId, tenant.id), eq(services.active, true)))
      .all();

    res.json({
      tenant: { name: tenant.name, slug: tenant.slug, category: tenant.category },
      services: rows.map((s) => ({
        id: s.id,
        name: s.name,
        duration_minutes: s.durationMinutes,
        price: s.price,
      })),
    });
  } catch (error) {
    console.error('[v1/services] error:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// ─── GET /api/v1/bookings ──────────────────────────────────────────
// Requires `read:bookings` scope. Returns public-safe projection with
// Ethiopian dates. No customer PII beyond name.
router.get('/bookings', requireApiKey('read:bookings'), async (req, res) => {
  try {
    const slug = req.query.tenant_slug as string | undefined;
    if (!slug) {
      return res.status(400).json({ error: 'tenant_slug is required' });
    }

    const tenant = await resolveTenant(slug);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const rows = await db.select({
      id: appointments.id,
      customerName: appointments.customerName,
      staffId: appointments.staffId,
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

    res.json({
      tenant: { name: tenant.name, slug: tenant.slug, category: tenant.category },
      bookings: rows.map((r) => ({
        id: r.id,
        customer_name: r.customerName,
        staff_id: r.staffId,
        start_time: r.startTime,
        end_time: r.endTime,
        status: r.status,
        service_name: r.serviceName,
        start_date_ethiopian: formatEthiopianDateTime(r.startTime),
        start_time_display: formatAddisSlotTime(r.startTime),
      })),
    });
  } catch (error) {
    console.error('[v1/bookings] error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// ─── POST /api/v1/bookings ─────────────────────────────────────────
// Requires `write:bookings` scope. Same schema as the public widget
// (POST /api/public/bookings) but uses tenant_slug query param.
const BookingSchema = z.object({
  staff_id: z.string().uuid(),
  service_ids: z.array(z.string().uuid()).min(1).max(10).optional(),
  service_id: z.string().uuid().optional(),
  start_time: z.string().datetime({ offset: true }),
  customer_name: z.string().min(1).max(120),
  customer_phone: z.string().min(1).max(40),
  customer_email: z.union([z.string().email().max(254), z.literal('')]).optional(),
}).refine((data) => data.service_ids || data.service_id, {
  message: 'Either service_id or service_ids is required',
  path: ['service_ids'],
});

router.post('/bookings', requireApiKey('write:bookings'), async (req, res) => {
  try {
    const slug = req.query.tenant_slug as string | undefined;
    if (!slug) {
      return res.status(400).json({ error: 'tenant_slug is required' });
    }

    const tenant = await resolveTenant(slug);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const data = BookingSchema.parse(req.body);

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

    if (bookedServices.length !== serviceIds.length) {
      return res.status(404).json({ error: 'One or more services not found' });
    }

    const totalDurationMinutes = bookedServices.reduce((sum, s) => sum + s.durationMinutes, 0);
    const totalPriceCents = bookedServices.reduce((sum, s) => sum + s.price, 0);

    const staffRow = await db.select({ id: staff.id }).from(staff)
      .where(and(eq(staff.id, data.staff_id), eq(staff.tenantId, tenant.id))).get();
    if (!staffRow) {
      return res.status(404).json({ error: 'Staff not found' });
    }

    const customerPhone = normalizePhone(data.customer_phone);
    if (!customerPhone) {
      return res.status(422).json({ error: 'Enter a valid Ethiopian phone number' });
    }

    const startTimeMs = new Date(data.start_time).getTime();
    const endTimeMs = startTimeMs + totalDurationMinutes * 60000;

    if (!Number.isFinite(startTimeMs)) {
      return res.status(422).json({ error: 'Invalid start_time' });
    }

    if (startTimeMs <= Date.now()) {
      return res.status(422).json({ error: 'Cannot book a time in the past' });
    }

    // 30-minute slot alignment
    const minuteOfDay = new Date(startTimeMs).getUTCMinutes();
    if (minuteOfDay % 30 !== 0) {
      return res.status(422).json({ error: 'Start time must align to a 30-minute slot boundary' });
    }

    const appId = crypto.randomUUID();
    const initialStatus = 'confirmed';

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
          cancelsAt: null,
          opaqueId,
        });

        await tx.insert(appointmentServices).values(
          bookedServices.map((s) => ({
            appointmentId: appId,
            serviceId: s.id,
            priceAtBooking: s.price,
            durationMinutes: s.durationMinutes,
          })),
        );
      }, { behavior: 'immediate' });
    } catch (err: any) {
      if (err.message === 'CONFLICT') {
        return res.status(409).json({ error: 'Time slot is no longer available' });
      }
      throw err;
    }

    // Send notification emails (fire-and-forget).
    const serviceNames = bookedServices.map((s) => s.name).join(', ');
    const ethiopianDateStr = formatEthiopianDateTime(startTimeMs);
    const customerEmail = data.customer_email || undefined;
    if (customerEmail) {
      const mail = applyTemplate('bookingCustomer', 'en', {
        name: data.customer_name,
        service: serviceNames,
        status: initialStatus,
        business: tenant.name,
        date: ethiopianDateStr,
      });
      sendMail({ to: customerEmail, subject: mail.subject, text: mail.text })
        .catch((err) => console.error('[v1] Failed to send customer email:', err));
    }

    res.status(201).json({
      success: true,
      appointment: {
        id: appId,
        status: initialStatus,
        start_time: startTimeMs,
        end_time: endTimeMs,
        start_date_ethiopian: ethiopianDateStr,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ error: error.issues });
    }
    console.error('[v1/bookings] error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

export default router;
