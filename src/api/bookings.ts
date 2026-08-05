import { Router } from 'express';
import { db } from '../db';
import { appointments, services, staff } from '../db/schema';
import { eq, and, desc, gte, lte, lt, or } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import { requireAuth } from './middleware/auth';
import { csrfProtection } from './middleware/csrf';
import { tenantWriteLimiter } from '../../server/middleware/rateLimiter';
import { logSecurityEvent, ipFromRequest } from '../../server/lib/securityLog';
import { normalizePhone } from '../lib/phone';

const router = Router();

// Authenticated (any role — staff see only their own bookings via the
// role-based filter below). tokenVersion is verified so a revoked session is
// rejected immediately.
router.use(requireAuth());

// Data-minimisation: staff users see booking existence/time/service but NOT
// customer PII (phone, email). Owners see the full record.
function bookingProjection(role: string) {
  const cols: Record<string, any> = {
    id: appointments.id,
    customerName: appointments.customerName,
    startTime: appointments.startTime,
    endTime: appointments.endTime,
    status: appointments.status,
    staffName: staff.name,
    serviceName: services.name,
    servicePrice: services.price,
  };
  if (role !== 'staff') {
    cols.customerPhone = appointments.customerPhone;
    cols.customerEmail = appointments.customerEmail;
  }
  return cols;
}

router.get('/', async (req, res) => {
  const { tenantId, role, userId } = (req as any).user;
  const { date, staff_id } = req.query;

  try {
    let filters = [eq(appointments.tenantId, tenantId)];
    
    // If staff, only show their own bookings
    if (role === 'staff') {
      const staffMember = await db.select().from(staff).where(eq(staff.userId, userId)).get();
      if (staffMember) {
         filters.push(eq(appointments.staffId, staffMember.id));
      }
    } else if (staff_id) {
      filters.push(eq(appointments.staffId, staff_id as string));
    }

    if (date) {
      const startOfDay = new Date(`${date}T00:00:00.000Z`).getTime();
      const endOfDay = new Date(`${date}T23:59:59.999Z`).getTime();
      filters.push(gte(appointments.startTime, startOfDay));
      filters.push(lte(appointments.startTime, endOfDay));
    }

    const results = await db.select(bookingProjection(role))
    .from(appointments)
    .leftJoin(staff, eq(appointments.staffId, staff.id))
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .where(and(...filters))
    .orderBy(desc(appointments.startTime))
    .all();

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

router.put('/:id/status', async (req, res) => {
  const { tenantId } = (req as any).user;
  const { id } = req.params;
  const { status } = req.body;

  try {
    const appointment = await db.select().from(appointments).where(and(eq(appointments.id, id), eq(appointments.tenantId, tenantId))).get();
    
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    await db.update(appointments).set({ status }).where(eq(appointments.id, id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.get('/:id', async (req, res) => {
  const { tenantId, role } = (req as any).user;
  const { id } = req.params;

  try {
    const result = await db.select(bookingProjection(role))
    .from(appointments)
    .leftJoin(staff, eq(appointments.staffId, staff.id))
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .where(and(eq(appointments.id, id), eq(appointments.tenantId, tenantId)))
    .get();

    if (!result) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// ---- Walk-in booking (owner entry) ----

// A separate router mounted at /api/tenant/bookings so it gets owner-only
// auth + CSRF (same guards as the rest of the /api/tenant write surface)
// rather than the any-role `bookings` router above.
export const walkInRouter = Router();
walkInRouter.use(requireAuth({ roles: ['owner'] }));
walkInRouter.use(csrfProtection);
walkInRouter.use(tenantWriteLimiter);

// Owner-entered walk-ins use camelCase and a phone OPTIONAL (a staff-side
// tablet may not have the walk-in's number). Length caps mirror the public
// booking schema so an oversized payload can't bloat a row.
const WalkInSchema = z.object({
  staffId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startTime: z.string().datetime({ offset: true }),
  customerName: z.string().min(1).max(120),
  customerPhone: z
    .union([z.string().min(1).max(40), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
});

// POST /api/tenant/bookings/walk-in
walkInRouter.post('/walk-in', async (req, res) => {
  const { tenantId } = (req as any).user;

  try {
    const data = WalkInSchema.parse(req.body);

    // Future-only: a walk-in logged for the owner dashboard cannot be in the
    // past (the appointment window has already begun/ended).
    const startTimeMs = new Date(data.startTime).getTime();
    if (!Number.isFinite(startTimeMs)) {
      return res.status(422).json({ error: 'Invalid startTime. Expected an ISO 8601 timestamp with offset.' });
    }
    if (startTimeMs <= Date.now()) {
      return res.status(422).json({ error: 'Cannot book a walk-in time in the past.' });
    }

    // Cross-tenant guards: service AND staff must belong to THIS tenant.
    const service = await db.select().from(services).where(eq(services.id, data.serviceId)).get();
    if (!service || service.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Service not found' });
    }
    const staffRow = await db.select({ id: staff.id }).from(staff)
      .where(and(eq(staff.id, data.staffId), eq(staff.tenantId, tenantId))).get();
    if (!staffRow) {
      logSecurityEvent({
        type: 'cross_tenant_attempt',
        tenantId,
        ip: ipFromRequest(req),
        details: { path: req.path, staffId: data.staffId },
      });
      return res.status(404).json({ error: 'Staff not found' });
    }

    const customerPhone = data.customerPhone
      ? (normalizePhone(data.customerPhone) || data.customerPhone.trim())
      : '';
    const endTimeMs = startTimeMs + service.durationMinutes * 60000;
    const appId = crypto.randomUUID();

    try {
      await db.transaction(async (tx) => {
        const conflicting = await tx.select().from(appointments).where(and(
          eq(appointments.tenantId, tenantId),
          eq(appointments.staffId, data.staffId),
          or(eq(appointments.status, 'confirmed'), eq(appointments.status, 'pending')),
          lt(appointments.startTime, endTimeMs),
          gte(appointments.endTime, startTimeMs),
        )).get();

        if (conflicting) {
          throw new Error('CONFLICT');
        }

        await tx.insert(appointments).values({
          id: appId,
          tenantId,
          staffId: data.staffId,
          serviceId: data.serviceId,
          customerName: data.customerName,
          customerPhone,
          customerEmail: null,
          startTime: startTimeMs,
          endTime: endTimeMs,
          status: 'confirmed',
          reminderSent: false,
        });
      }, { behavior: 'immediate' });
    } catch (err: any) {
      if (err.message === 'CONFLICT') {
        return res.status(409).json({ error: 'Time slot is no longer available' });
      }
      throw err;
    }

    res.status(201).json({
      success: true,
      appointment: {
        id: appId,
        status: 'confirmed',
        startTime: startTimeMs,
        endTime: endTimeMs,
      },
    });
  } catch (error: any) {
    if (error.message === 'CONFLICT') {
      return res.status(409).json({ error: 'Time slot is no longer available' });
    }
    if (error instanceof z.ZodError) {
      return res.status(422).json({ error: error.issues });
    }
    console.error('Walk-in booking error:', error);
    res.status(500).json({ error: 'Failed to create walk-in booking' });
  }
});

export default router;
