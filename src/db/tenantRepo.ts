/**
 * Tenant-scoped data-access helpers — LIGHT SET (T5.2 decision).
 *
 * HISTORY: this file was once a 615-line full repository layer covering every
 * tenant-scoped table. It was never adopted (zero importers) and the
 * aspirational bulk was deleted per the owner's T5.2 ruling — a big file
 * documenting an architecture nothing follows is a trap, not an asset.
 * What survives is the small set of primitives worth reaching for BY HAND
 * when writing tenant-scoped queries.
 *
 * ADOPTION RULE: adopt deliberately — when writing a new tenant-scoped query,
 * replace the raw `db.select().from(X).where(eq(X.id, id))` call with the
 * matching helper here. Do NOT grow this file by default; add a helper only
 * when a second call site genuinely needs the same scoped shape.
 *
 * Conventions (unchanged):
 *   - Reads return `null`/`undefined` when the row belongs to another tenant
 *     (the caller renders a 404 — the safe failure mode).
 *   - Scoped mutations AND the id predicate together, so a wrong-tenant id is
 *     a no-op (0 affected rows), never a cross-tenant write.
 *   - Link tables (staff_services) have no `tenant_id` column by design —
 *     they are scoped transitively (see getStaffServicesForServiceByTenant).
 */
import { db } from '../db';
import { services, staff, staffServices, appointments } from '../db/schema';
import { eq, and, inArray, lt, gte } from 'drizzle-orm';

// ── services ─────────────────────────────────────────────────────────────

/** Fetch a service by id ONLY when it belongs to `tenantId`. Else `null`. */
export function findServiceForTenant(tenantId: string, serviceId: string) {
  return db.select().from(services)
    .where(and(eq(services.id, serviceId), eq(services.tenantId, tenantId)))
    .get();
}

/** Scoped update — a serviceId from another tenant matches nothing. */
export function updateServiceForTenant(
  tenantId: string,
  serviceId: string,
  updates: Partial<typeof services.$inferInsert>,
) {
  return db.update(services).set(updates)
    .where(and(eq(services.id, serviceId), eq(services.tenantId, tenantId)));
}

/** Filter service ids by ownership — defence in depth before linking. */
export function filterOwnedServiceIdsForTenant(
  tenantId: string,
  serviceIds: string[],
) {
  if (!serviceIds.length) return Promise.resolve([] as string[]);
  return db.select({ id: services.id }).from(services)
    .where(and(eq(services.tenantId, tenantId), inArray(services.id, serviceIds)))
    .all()
    .then((rows) => rows.map((r) => r.id));
}

// ── staff ────────────────────────────────────────────────────────────────

/** Fetch a staff row by id ONLY when it belongs to `tenantId`. Else `null`. */
export function findStaffForTenant(tenantId: string, staffId: string) {
  return db.select().from(staff)
    .where(and(eq(staff.id, staffId), eq(staff.tenantId, tenantId)))
    .get();
}

// ── appointments ─────────────────────────────────────────────────────────

/** Fetch an appointment by id ONLY when it belongs to `tenantId`. */
export function findAppointmentForTenant(tenantId: string, id: string) {
  return db.select().from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.tenantId, tenantId)))
    .get();
}

/**
 * Scopes conflict detection by tenantId AND staff/time window, so a
 * same-time booking in another tenant can never cause a false 409 on this
 * tenant's create call.
 */
export function findConflictingAppointmentForTenant(
  tenantId: string,
  staffId: string,
  startTimeMs: number,
  endTimeMs: number,
) {
  return db.select().from(appointments)
    .where(and(
      eq(appointments.tenantId, tenantId),
      eq(appointments.staffId, staffId),
      inArray(appointments.status, ['confirmed', 'pending']),
      lt(appointments.startTime, endTimeMs),
      gte(appointments.endTime, startTimeMs),
    ))
    .get();
}

/** Scoped status update — a foreign appointmentId matches nothing. */
export function updateAppointmentStatusForTenant(
  tenantId: string,
  appointmentId: string,
  status: string,
) {
  return db.update(appointments).set({ status })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.tenantId, tenantId)));
}

/**
 * Update appointment status by id alone — ONLY for webhook paths where the
 * tenant scope has already been verified through the payment's tenantId
 * (so the booking belongs to whatever tenant the payment belongs to). New
 * code should prefer `updateAppointmentStatusForTenant`.
 */
export function updateAppointmentStatusById(appointmentId: string, status: string) {
  return db.update(appointments).set({ status })
    .where(eq(appointments.id, appointmentId));
}

// ── staff_services (link table — transitive scoping) ─────────────────────

/**
 * Fetch staff_services links for a service id, RESTRICTED to staff rows that
 * belong to `tenantId`. The link table has no `tenant_id` column, so we first
 * resolve the tenant's staff ids and constrain the link query to that set —
 * otherwise a caller could supply another tenant's service_id and read every
 * staff in the platform mapped to it.
 */
export async function getStaffServicesForServiceByTenant(
  tenantId: string,
  serviceId: string,
) {
  const tenantStaff = await db.select({ id: staff.id }).from(staff)
    .where(eq(staff.tenantId, tenantId)).all();
  if (!tenantStaff.length) return [];
  const staffIds = tenantStaff.map((s) => s.id);
  return db.select().from(staffServices)
    .where(and(
      eq(staffServices.serviceId, serviceId),
      inArray(staffServices.staffId, staffIds),
    ))
    .all();
}
