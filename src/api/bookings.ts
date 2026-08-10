import { Router } from 'express';
import { db } from '../db';
import { appointments, services, staff, customerStats, promoCodes, appointmentServices, inventoryItems, payments } from '../db/schema';
import { eq, and, desc, gte, lte, lt, or, sql, inArray } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import { requireAuth } from './middleware/auth';
import { csrfProtection } from './middleware/csrf';
import { tenantWriteLimiter } from '../../server/middleware/rateLimiter';
import { logSecurityEvent, ipFromRequest } from '../../server/lib/securityLog';
import { normalizePhone } from '../lib/phone';
import { computeHealthTag } from '../lib/customer-health';

const CANCEL_STOCK_RESTORE_HOURS = 2;

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

    const previousStatus = appointment.status;
    await db.update(appointments).set({ status }).where(eq(appointments.id, id));

    // Update customer_stats + inventory based on status transition.
    const now = Date.now();

    if (status === 'completed' && previousStatus !== 'completed') {
      const paymentRecord = await db.select({ amount: payments.amount })
        .from(payments)
        .where(eq(payments.appointmentId, id))
        .get();
      const spendAmount = paymentRecord?.amount ?? 0;

      const existing = await db.select()
        .from(customerStats)
        .where(and(eq(customerStats.tenantId, tenantId), eq(customerStats.customerPhone, appointment.customerPhone)))
        .get();

      if (existing) {
        await db.update(customerStats)
          .set({
            visitCount: existing.visitCount + 1,
            totalSpendEtbCents: existing.totalSpendEtbCents + spendAmount,
            lastVisitAt: appointment.endTime,
            customerName: appointment.customerName,
          })
          .where(and(eq(customerStats.tenantId, tenantId), eq(customerStats.customerPhone, appointment.customerPhone)));
      } else {
        await db.insert(customerStats).values({
          tenantId,
          customerPhone: appointment.customerPhone,
          customerName: appointment.customerName,
          firstVisitAt: appointment.startTime,
          lastVisitAt: appointment.endTime,
          visitCount: 1,
          totalSpendEtbCents: spendAmount,
          lastCancelledAt: null,
          createdAt: now,
        });
      }

      // Decrement inventory for services that have associated stock items.
      await decrementInventoryForAppointment(id, appointment.serviceId, tenantId);

      // A completed visit updates the health tag (visit_count may tip a
      // customer into vip_loyal, or reset a no-show streak).
      await recomputeHealthTag(tenantId, appointment.customerPhone);
    } else if (
      (status === 'cancelled' || status === 'no_show') &&
      previousStatus !== 'cancelled' &&
      previousStatus !== 'no_show'
    ) {
      const existing = await db.select()
        .from(customerStats)
        .where(and(eq(customerStats.tenantId, tenantId), eq(customerStats.customerPhone, appointment.customerPhone)))
        .get();

      if (existing) {
        await db.update(customerStats)
          .set({
            lastCancelledAt: now,
            noShowCount: existing.noShowCount + 1,
          })
          .where(and(eq(customerStats.tenantId, tenantId), eq(customerStats.customerPhone, appointment.customerPhone)));
      } else {
        await db.insert(customerStats).values({
          tenantId,
          customerPhone: appointment.customerPhone,
          customerName: appointment.customerName,
          firstVisitAt: null,
          lastVisitAt: null,
          visitCount: 0,
          totalSpendEtbCents: 0,
          lastCancelledAt: now,
          noShowCount: 1,
          createdAt: now,
        });
      }

      // A cancelled/no_show increments no_show_count, which may flip the
      // customer into high_no_show_risk.
      await recomputeHealthTag(tenantId, appointment.customerPhone);

      // Restore inventory only if cancelled < 2 hours from the scheduled start.
      if (status === 'cancelled') {
        const hoursUntilStart = (appointment.startTime - now) / (1000 * 3600);
        if (hoursUntilStart < CANCEL_STOCK_RESTORE_HOURS) {
          await restoreInventoryForAppointment(id, appointment.serviceId, tenantId);
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update status error:', error);
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

/**
 * Recompute a customer's health tag from their current stats and persist the
 * cached value on customer_stats.health_tag. Called after every appointment
 * status transition that mutates visit_count / no_show_count so the cached tag
 * stays in sync. The GET /customers endpoint also computes on the fly, so this
 * is a fast-path cache, not the source of truth.
 */
async function recomputeHealthTag(tenantId: string, customerPhone: string): Promise<void> {
  try {
    const row = await db.select()
      .from(customerStats)
      .where(and(eq(customerStats.tenantId, tenantId), eq(customerStats.customerPhone, customerPhone)))
      .get();

    if (!row) return;

    const tag = computeHealthTag(row.visitCount, row.noShowCount, row.lastVisitAt);

    if (tag !== row.healthTag) {
      await db.update(customerStats)
        .set({ healthTag: tag })
        .where(and(eq(customerStats.tenantId, tenantId), eq(customerStats.customerPhone, customerPhone)));
    }
  } catch {
    // best-effort cache — never block the status transition on it
  }
}

/**
 * Decrement inventory stock for the services associated with an appointment.
 * Reads from appointment_services (multi-service support) and falls back
 * to the appointment's primary serviceId for single-service bookings.
 */
async function decrementInventoryForAppointment(appointmentId: string, primaryServiceId: string, tenantId: string): Promise<void> {
  const serviceRows = await db.select({ serviceId: appointmentServices.serviceId })
    .from(appointmentServices)
    .where(eq(appointmentServices.appointmentId, appointmentId))
    .all();

  const serviceIds = serviceRows.length > 0
    ? serviceRows.map(r => r.serviceId)
    : [primaryServiceId];

  // Single set-based decrement — no per-row loop, no N+1.
  try {
    await db.update(inventoryItems)
      .set({ quantityOnHand: sql`max(0, ${inventoryItems.quantityOnHand} - 1)` })
      .where(and(
        eq(inventoryItems.tenantId, tenantId),
        inArray(inventoryItems.serviceId, serviceIds),
      ));
  } catch {
    // non-fatal — inventory is best-effort
  }
}

/**
 * Restore inventory stock for the services associated with an appointment.
 * Used when an appointment is cancelled within 2 hours of its start.
 */
async function restoreInventoryForAppointment(appointmentId: string, primaryServiceId: string, tenantId: string): Promise<void> {
  const serviceRows = await db.select({ serviceId: appointmentServices.serviceId })
    .from(appointmentServices)
    .where(eq(appointmentServices.appointmentId, appointmentId))
    .all();

  const serviceIds = serviceRows.length > 0
    ? serviceRows.map(r => r.serviceId)
    : [primaryServiceId];

  // Single set-based restore — no per-row loop, no N+1.
  try {
    await db.update(inventoryItems)
      .set({ quantityOnHand: sql`${inventoryItems.quantityOnHand} + 1` })
      .where(and(
        eq(inventoryItems.tenantId, tenantId),
        inArray(inventoryItems.serviceId, serviceIds),
      ));
  } catch {
    // non-fatal
  }
}

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

        const opaqueId = crypto.randomBytes(16).toString('hex');
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
          opaqueId,
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
