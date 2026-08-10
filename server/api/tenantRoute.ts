import { Router } from 'express';
import { db } from '../../src/db';
import { services as servicesTable, appointments, payments, inventoryItems } from '../../src/db/schema';
import { eq, and, gte, lt, sql, lte } from 'drizzle-orm';
import { requireAuth } from '../../src/api/middleware/auth';
import { nonceCsp } from '../middleware/nonceCsp';
import { dashboardReadLimiter } from '../middleware/rateLimiter';
import {
  getAddisDateString,
  parseAddisDate,
  formatAddisSlotTime,
} from '../lib/timezone';

const router = Router();

router.use(requireAuth({ roles: ['owner', 'admin', 'staff'] }));
router.use(nonceCsp);
router.use(dashboardReadLimiter);

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Owner/app Home payload. Every field is deliberately whitelisted:
 *
 *  - `today` is a schedule of *confirmed/pending* appointments for the Addis
 *    day, with a pre-formatted Addis `time` so the client never has to
 *    convert timezones. Only fields the dashboard renders are included —
 *    customer email and customer phone are NEVER present, so even the
 *    authenticated owner cannot pull them from this endpoint.
 *  - Today's `completed` payment sum is returned in ETB (and cents) so the
 *    Home revenue card renders without any client-side money math.
 *  - `walkInEnabled` mirrors the server's walk-in role gate (owner only) so
 *    the mobile FAB only appears to accounts that may actually use it.
 */
type ScheduledAppointment = {
  id: string;
  customerName: string;
  serviceName: string | null;
  status: string;
  time: string;
};

type DashboardResponse = {
  today: ScheduledAppointment[];
  todayAppointments: number;
  confirmedAppointments: number;
  pendingAppointments: number;
  completedAppointments: number;
  completedRevenueCents: number;
  completedRevenueEtb: number;
  walkInEnabled: boolean;
  lowStockItems: any[];
  lowStockCount: number;
};

router.get('/', async (_req: any, res: any) => {
  const user = _req.user as { tenantId?: string; role?: string };
  const tenantId = user?.tenantId;

  if (!tenantId) {
    return res.status(400).json({ error: 'Missing tenant context' });
  }

  // Today's window in Addis (UTC+3) wall-clock terms, not UTC. Without this
  // a booking at 02:30 UTC (05:30 Addis) would be assigned to the wrong day.
  const dayStart = parseAddisDate(getAddisDateString(new Date())).getTime();
  const dayEnd = dayStart + DAY_MS;

  const [appts, paymentsRows] = await Promise.all([
    db
      .select({
        id: appointments.id,
        customerName: appointments.customerName,
        serviceName: servicesTable.name,
        status: appointments.status,
        startTime: appointments.startTime,
      })
      .from(appointments)
      .leftJoin(servicesTable, eq(appointments.serviceId, servicesTable.id))
      .where(
        and(
          eq(appointments.tenantId, tenantId),
          gte(appointments.startTime, dayStart),
          lt(appointments.startTime, dayEnd),
        ),
      )
      .all(),
    db
      .select({
        appointmentId: payments.appointmentId,
        total: sql<number>`COALESCE(SUM(payments.amount), 0)`,
      })
      .from(payments)
      .innerJoin(appointments, eq(payments.appointmentId, appointments.id))
      .where(
        and(
          eq(appointments.tenantId, tenantId),
          eq(payments.status, 'completed'),
          gte(appointments.startTime, dayStart),
          lt(appointments.startTime, dayEnd),
        ),
      )
      .groupBy(payments.appointmentId)
      .all(),
  ]);

  const paymentTotals = new Map(
    paymentsRows.map((row) => [row.appointmentId, Number(row.total)]),
  );
  let completedRevenueCents = 0;
  for (const appt of appts) {
    if (appt.status === 'completed') {
      completedRevenueCents += paymentTotals.get(appt.id) || 0;
    }
  }

  const schedule: ScheduledAppointment[] = appts
    .filter((r) => r.status === 'confirmed' || r.status === 'pending')
    .map((r) => ({
      id: r.id,
      customerName: r.customerName,
      serviceName: r.serviceName ?? null,
      status: r.status,
      time: formatAddisSlotTime(r.startTime),
    }))
    .sort((a, b) => a.time.localeCompare(b.time));

  // Low-stock inventory alert — items whose quantity_on_hand is at or below
  // their reorder_threshold. Only returned as a count + id/name/sku summary;
  // the owner can drill into the full inventory list from the Settings/Manage
  // screen.
  let lowStockCount = 0;
  let lowStockItems: any[] = [];
  try {
    lowStockItems = await db.select({
      id: inventoryItems.id,
      name: inventoryItems.name,
      sku: inventoryItems.sku,
      quantityOnHand: inventoryItems.quantityOnHand,
      reorderThreshold: inventoryItems.reorderThreshold,
    })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.tenantId, tenantId),
          sql`${inventoryItems.quantityOnHand} <= ${inventoryItems.reorderThreshold}`,
        ),
      )
      .all();
    lowStockCount = lowStockItems.length;
  } catch {
    // inventory table may not exist on legacy DBs — non-fatal
  }

  return res.json({
    today: schedule,
    todayAppointments: schedule.length,
    confirmedAppointments: schedule.filter((r) => r.status === 'confirmed').length,
    pendingAppointments: schedule.filter((r) => r.status === 'pending').length,
    completedAppointments: appts.filter((r) => r.status === 'completed').length,
    completedRevenueCents,
    completedRevenueEtb: completedRevenueCents / 100,
    walkInEnabled: user?.role === 'owner',
    lowStockItems: lowStockItems.map((r) => ({
      ...r,
      lowStock: true,
    })),
    lowStockCount,
  });
});

export default router;