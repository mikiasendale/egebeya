/**
 * Queue-Buster routes (P4.1–P4.3).
 *
 *   Owner console (mounted /api/tenant/queue):
 *     GET  /                — today's queue, auto-enrolled, canonical order
 *     POST /advance/:id     — one tap: waiting → serving → done
 *
 *   Consumer status (mounted /api/public):
 *     GET /queue-status/:opaqueId — the three-state public board.
 *
 * PRIVACY RULE (PRODUCT.md principle 5): public surfaces expose initials +
 * service + time — never customer names. The owner console may show names;
 * nothing returned by the public route does.
 */
import { Router } from 'express';
import { db } from '../db';
import { appointments, appointmentServices, services as servicesTable } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { requireAuth } from './middleware/auth';
import { csrfProtection } from './middleware/csrf';
import { tenantWriteLimiter, queueStatusLimiter } from '../../server/middleware/rateLimiter';
import { enrollAndListQueue, advanceEntry, type QueueState } from '../../server/lib/queue';
import { logSecurityEvent } from '../../server/lib/securityLog';
import {
  gregorianToEthiopian,
  ETHIOPIAN_MONTHS,
} from '../lib/ethiopianCalendar';
import { toAddis } from '../../server/lib/timezone';

// ── Queue console ─────────────────────────────────────────────────────────
// F4 (Phase-4 polish): the wedge acceptance is "a BARBER clears his morning
// queue with one tap per customer" — the barber is STAFF. Read + advance are
// therefore granted to any authenticated user (owner/staff/admin); CREATION
// (walk-ins) and configuration stay owner-only, consistent with the walk-in
// router (bookings.ts) which gates walk-in writes on the owner role. The
// router name stays "ownerRouter" for import compat but the intent is
// "queue operator".
const ownerRouter = Router();
ownerRouter.use(requireAuth());
ownerRouter.use(csrfProtection);
ownerRouter.use(tenantWriteLimiter);

/** Attach service names to queue entries (one batched query — N+1 law). */
async function withServiceNames(tenantId: string, entries: Awaited<ReturnType<typeof enrollAndListQueue>>['entries']) {
  if (entries.length === 0) return entries.map((e) => ({ ...e, serviceName: '' }));
  const apptIds = entries.map((e) => e.id);
  const rows = await db.select({
    appointmentId: appointmentServices.appointmentId,
    serviceName: servicesTable.name,
  })
    .from(appointmentServices)
    .innerJoin(servicesTable, eq(appointmentServices.serviceId, servicesTable.id))
    .where(inArray(appointmentServices.appointmentId, apptIds))
    .all();

  const byAppt = new Map<string, string[]>();
  for (const r of rows) {
    const list = byAppt.get(r.appointmentId) ?? [];
    list.push(r.serviceName);
    byAppt.set(r.appointmentId, list);
  }
  return entries.map((e) => ({ ...e, serviceName: (byAppt.get(e.id) ?? []).join(', ') }));
}

ownerRouter.get('/', async (req, res) => {
  try {
    const { tenantId } = (req as any).user;
    const { entries, businessName } = await enrollAndListQueue(tenantId);
    res.json({
      businessName,
      entries: await withServiceNames(tenantId, entries),
    });
  } catch (error) {
    console.error('Queue list error:', error);
    res.status(500).json({ error: 'Failed to load queue' });
  }
});

ownerRouter.post('/advance/:appointmentId', async (req, res) => {
  try {
    const { tenantId } = (req as any).user;
    const result = await advanceEntry(tenantId, String(req.params.appointmentId || ''));
    if (result.ok === false) {
      const { reason } = result;
      return res.status(reason === 'not_found' ? 404 : 409)
        .json({ error: reason === 'not_found' ? 'Appointment not found' : 'Appointment is not in today’s queue' });
    }
    const newState: QueueState = result.newState;
    // Fresh board after the flip — positions/ETAs recomputed server-side.
    const { entries, businessName } = await enrollAndListQueue(tenantId);
    res.json({
      success: true,
      newState,
      businessName,
      entries: await withServiceNames(tenantId, entries),
    });
  } catch (error) {
    console.error('Queue advance error:', error);
    res.status(500).json({ error: 'Failed to advance queue' });
  }
});

// ── Consumer status board ────────────────────────────────────────────────

const publicRouter = Router();

/**
 * GET /api/public/queue-status/:opaqueId
 *
 * Exactly three states drive the consumer page:
 *   waiting → "#N · ~X min" · serving → "It's your turn" · done → gentle close.
 */
publicRouter.get('/queue-status/:opaqueId', queueStatusLimiter, async (req, res) => {
  try {
    const opaqueId = String(req.params.opaqueId || '');
    if (!opaqueId || opaqueId.length > 64) {
      return res.status(404).json({ error: 'Not found' });
    }

    const appt = await db.select({
      id: appointments.id,
      tenantId: appointments.tenantId,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
      queueState: appointments.queueState,
      queuePosition: appointments.queuePosition,
      customerName: appointments.customerName, // reduced to initials below — NEVER echoed raw
    })
      .from(appointments)
      .where(eq(appointments.opaqueId, opaqueId))
      .get();

    if (!appt || appt.status === 'cancelled') {
      return res.status(404).json({ error: 'Not found' });
    }

    const { entries } = await enrollAndListQueue(appt.tenantId);
    const mine = entries.find((e) => e.id === appt.id);

    // Not a same-day entry → there is no live queue for this booking.
    if (!mine && !appt.queueState) {
      return res.status(404).json({ error: 'Not found' });
    }

    const state = mine?.state ?? (appt.queueState as string) ?? 'done';
    const etaMinutes = mine?.etaMinutes ?? null;

    const startLocal = toAddis(new Date(appt.startTime));
    const eth = gregorianToEthiopian(startLocal);

    res.json({
      state, // waiting | serving | done
      position: state === 'waiting' ? (mine?.position ?? appt.queuePosition ?? null) : null,
      etaMinutes,
      // Privacy reduction happens HERE — the raw name never leaves.
      initials: mine?.customerInitials ?? '?',
      startTimeIso: new Date(appt.startTime).toISOString(),
      timeLabel: `${String(startLocal.getHours()).padStart(2, '0')}:${String(startLocal.getMinutes()).padStart(2, '0')}`,
      dateEthiopian: {
        day: eth.day,
        monthIndex: eth.month - 1,
        monthName: ETHIOPIAN_MONTHS[eth.month - 1] ?? '',
        year: eth.year,
      },
    });
  } catch (error) {
    logSecurityEvent({
      type: 'rate_limit',
      ip: null,
      details: { surface: 'queue_status_error' },
    });
    console.error('queue-status error:', error);
    res.status(500).json({ error: 'Failed to fetch queue status' });
  }
});

export { ownerRouter as queueOwnerRouter, publicRouter as queuePublicRouter };
