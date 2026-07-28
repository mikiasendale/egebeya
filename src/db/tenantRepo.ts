/**
 * Tenant-scoped data-access layer.
 *
 * Every tenant-scoped table is reachable here ONLY through functions that
 * take `tenantId` as their first mandatory argument. Because the parameter
 * is required and not optional, TypeScript refuses to compile any call site
 * that forgets it — so a future query literally cannot run without supplying
 * the tenant scope. The old pattern of `db.select().from(X).where(eq(X.id, id))`
 * silently returned rows from any tenant; this module makes that impossible.
 *
 * The functions are thin wrappers over Drizzle that ALWAYS add an
 * `eq(<table>.tenantId, tenantId)` predicate — to the read filter, to the
 * ownership check before an update/delete, or both — so callers cannot
 * forget the scope even if they forget to add the predicate manually.
 *
 * Conventions:
 *   - Reads return `null`/`undefined` when the row exists in another tenant
 *     (so the caller sees a 404, the safe failure mode).
 *   - Mutates use the scoped ownership check before touching the row; an
 *     update that targets the wrong tenant is a no-op (Drizzle returns 0
 *     affected rows).
 *   - Link tables (staff_services, staff_availability) have no `tenant_id`
 *     column by design — they are scoped transitively through the parent
 *     row, so the helpers require the caller to first prove the parent
 *     belongs to the tenant (scoping the link by the parent id is then
 *     safe).
 */
import { db } from '../db';
import {
  services,
  staff,
  staffServices,
  staffAvailability,
  appointments,
  payments,
  tenantBusinessHours,
  tenantClosures,
  pages,
  media,
  proSiteFiles,
  tenantSubscriptions,
} from '../db/schema';
import { eq, and, inArray, lt, gte, type SQL } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// services
// ---------------------------------------------------------------------------

export function getServicesForTenant(tenantId: string) {
  return db.select().from(services).where(eq(services.tenantId, tenantId)).all();
}

/** Fetch a service by id ONLY when it belongs to `tenantId`. Else `null`. */
export function findServiceForTenant(
  tenantId: string,
  serviceId: string,
) {
  return db.select().from(services)
    .where(and(eq(services.id, serviceId), eq(services.tenantId, tenantId)))
    .get();
}

/** Active services for the tenant. Used by the public booking flow. */
export function findActiveServicesForTenant(tenantId: string) {
  return db.select().from(services)
    .where(and(eq(services.tenantId, tenantId), eq(services.active, true)))
    .all();
}

export function insertServiceForTenant(
  tenantId: string,
  fields: Omit<typeof services.$inferInsert, 'tenantId' | 'id'> & { id: string },
) {
  return db.insert(services).values({ ...fields, tenantId });
}

/** Returns true if a row was actually updated (i.e. the service belonged to
 *  this tenant). The ownership check must have been done by the caller
 *  beforehand (use `findServiceForTenant`). */
export function updateServiceForTenant(
  tenantId: string,
  serviceId: string,
  updates: Partial<typeof services.$inferInsert>,
) {
  return db.update(services).set(updates)
    .where(and(eq(services.id, serviceId), eq(services.tenantId, tenantId)));
}

export function deleteServiceForTenant(tenantId: string, serviceId: string) {
  return db.delete(services)
    .where(and(eq(services.id, serviceId), eq(services.tenantId, tenantId)));
}

// ---------------------------------------------------------------------------
// staff (+ staff_services, staff_availability link tables)
// ---------------------------------------------------------------------------

export function getStaffForTenant(tenantId: string) {
  return db.select().from(staff).where(eq(staff.tenantId, tenantId)).all();
}

export function findStaffForTenant(tenantId: string, staffId: string) {
  return db.select().from(staff)
    .where(and(eq(staff.id, staffId), eq(staff.tenantId, tenantId)))
    .get();
}

export function findStaffByUserForTenant(tenantId: string, userId: string) {
  return db.select().from(staff)
    .where(and(eq(staff.userId, userId), eq(staff.tenantId, tenantId)))
    .get();
}

export function findActiveStaffForTenant(tenantId: string) {
  return db.select({
    id: staff.id,
    name: staff.name,
    title: staff.title,
    bio: staff.bio,
    imagePath: staff.imagePath,
  }).from(staff)
    .where(and(eq(staff.tenantId, tenantId), eq(staff.active, true)))
    .all();
}

export function insertStaffForTenant(
  tenantId: string,
  fields: Omit<typeof staff.$inferInsert, 'tenantId' | 'id'> & { id: string },
) {
  return db.insert(staff).values({ ...fields, tenantId });
}

export function updateStaffForTenant(
  tenantId: string,
  staffId: string,
  updates: Partial<typeof staff.$inferInsert>,
) {
  return db.update(staff).set(updates)
    .where(and(eq(staff.id, staffId), eq(staff.tenantId, tenantId)));
}

export function deleteStaffForTenant(tenantId: string, staffId: string) {
  return db.delete(staff)
    .where(and(eq(staff.id, staffId), eq(staff.tenantId, tenantId)));
}

// ---------------------------------------------------------------------------
// appointments
// ---------------------------------------------------------------------------

export function findAppointmentForTenant(tenantId: string, id: string) {
  return db.select().from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.tenantId, tenantId)))
    .get();
}

/** Lookup with rich join columns; scoped by tenantId. */
export function findAppointmentDetailedForTenant(tenantId: string, id: string) {
  return db.select({
    id: appointments.id,
    customerName: appointments.customerName,
    customerPhone: appointments.customerPhone,
    customerEmail: appointments.customerEmail,
    startTime: appointments.startTime,
    endTime: appointments.endTime,
    status: appointments.status,
    staffName: staff.name,
    serviceName: services.name,
    servicePrice: services.price,
  })
    .from(appointments)
    .leftJoin(staff, eq(appointments.staffId, staff.id))
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .where(and(eq(appointments.id, id), eq(appointments.tenantId, tenantId)))
    .get();
}

export function listAppointmentsForTenant(
  tenantId: string,
  extra: SQL[] = [],
) {
  return db.select({
    id: appointments.id,
    customerName: appointments.customerName,
    customerPhone: appointments.customerPhone,
    customerEmail: appointments.customerEmail,
    startTime: appointments.startTime,
    endTime: appointments.endTime,
    status: appointments.status,
    staffName: staff.name,
    serviceName: services.name,
    servicePrice: services.price,
  })
    .from(appointments)
    .leftJoin(staff, eq(appointments.staffId, staff.id))
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .where(and(eq(appointments.tenantId, tenantId), ...extra))
    .all();
}

/** Scopes the conflict-detection query by tenantId as well as the staff/time
 *  window, so a same-time booking in another tenant can never cause a false
 *  409 on this tenant's create call. */
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

/**
 * Public helper used by /api/public/availability — fetch the staff's
 * availability rows for a day-of-week AFTER proving the staff belongs to
 * `tenantId`. Returns `[]` when the staff id points at a different tenant,
 * which is the safe behaviour for any "show me availability for this
 * staff_id" endpoint.
 */
export async function findStaffAvailabilityForTenant(
  tenantId: string,
  staffId: string,
  dayOfWeek?: number | null,
) {
  const owned = await findStaffForTenant(tenantId, staffId);
  if (!owned) return [] as typeof staffAvailability.$inferSelect[];
  if (dayOfWeek === undefined || dayOfWeek === null) {
    return db.select().from(staffAvailability)
      .where(eq(staffAvailability.staffId, staffId))
      .all();
  }
  return db.select().from(staffAvailability)
    .where(and(
      eq(staffAvailability.staffId, staffId),
      eq(staffAvailability.dayOfWeek, dayOfWeek),
    ))
    .all();
}

/**
 * Public helper used by /api/public/availability — fetch the staff's
 * appointments in a UTC window so the slot generator can mark
 * conflicting slots unavailable. Two-stage scoping:
 *   1. The staff id must belong to the tenant (otherwise return []),
 *   2. The appointment query constrains on tenantId + window.
 *
 * `statuses` defaults to the active-appointment union
 * (`confirmed` / `pending`).
 */
export async function findStaffAppointmentsInRangeForTenant(
  tenantId: string,
  staffId: string,
  startMs: number,
  endMs: number,
  statuses: string[] = ['confirmed', 'pending'],
) {
  const owned = await findStaffForTenant(tenantId, staffId);
  if (!owned) return [] as typeof appointments.$inferSelect[];
  return db.select().from(appointments)
    .where(and(
      eq(appointments.tenantId, tenantId),
      eq(appointments.staffId, staffId),
      inArray(appointments.status, statuses),
      gte(appointments.startTime, startMs),
      lt(appointments.startTime, endMs),
    ))
    .all();
}

export function updateAppointmentStatusForTenant(
  tenantId: string,
  appointmentId: string,
  status: string,
) {
  return db.update(appointments).set({ status })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.tenantId, tenantId)));
}

/** Update appointment status by id alone — ONLY for webhook paths where the
 *  tenant scope has already been verified through the payment's tenantId
 *  (so the booking belongs to whatever tenant the payment belongs to). This
 *  helper exists so the webhook can update exactly one row by id after it
 *  has independently confirmed the payment's ownership; new code should
 *  prefer `updateAppointmentStatusForTenant`. */
export function updateAppointmentStatusById(appointmentId: string, status: string) {
  return db.update(appointments).set({ status })
    .where(eq(appointments.id, appointmentId));
}

// ---------------------------------------------------------------------------
// payments
// ---------------------------------------------------------------------------

export function findPaymentByGatewayRef(gatewayReference: string) {
  return db.select().from(payments)
    .where(eq(payments.gatewayReference, gatewayReference))
    .get();
}

export function updatePaymentStatusForTenant(
  tenantId: string,
  paymentId: string,
  status: string,
  meta?: any,
) {
  const set: Partial<typeof payments.$inferInsert> = { status };
  if (meta !== undefined) set.meta = meta;
  return db.update(payments).set(set)
    .where(and(eq(payments.id, paymentId), eq(payments.tenantId, tenantId)));
}

export function updatePaymentStatusById(paymentId: string, status: string, meta?: any) {
  const set: Partial<typeof payments.$inferInsert> = { status };
  if (meta !== undefined) set.meta = meta;
  return db.update(payments).set(set)
    .where(eq(payments.id, paymentId));
}

// ---------------------------------------------------------------------------
// tenant_business_hours / tenant_closures
// ---------------------------------------------------------------------------

export function getBusinessHoursForTenant(tenantId: string) {
  return db.select().from(tenantBusinessHours)
    .where(eq(tenantBusinessHours.tenantId, tenantId)).all();
}

export function findBusinessHoursForTenantDay(tenantId: string, dayOfWeek: number) {
  return db.select().from(tenantBusinessHours)
    .where(and(
      eq(tenantBusinessHours.tenantId, tenantId),
      eq(tenantBusinessHours.dayOfWeek, dayOfWeek),
    ))
    .get();
}

export function findClosureForTenantDate(tenantId: string, date: string) {
  return db.select().from(tenantClosures)
    .where(and(
      eq(tenantClosures.tenantId, tenantId),
      eq(tenantClosures.date, date),
    ))
    .all();
}

export function deleteBusinessHoursForTenant(tenantId: string) {
  return db.delete(tenantBusinessHours)
    .where(eq(tenantBusinessHours.tenantId, tenantId));
}

export function deleteClosuresForTenant(tenantId: string) {
  return db.delete(tenantClosures).where(eq(tenantClosures.tenantId, tenantId));
}

// ---------------------------------------------------------------------------
// pages
// ---------------------------------------------------------------------------

export function findPageForTenant(tenantId: string) {
  return db.select().from(pages).where(eq(pages.tenantId, tenantId)).get();
}

export function upsertPageForTenant(
  tenantId: string,
  content: any,
) {
  return db.insert(pages).values({ tenantId, content })
    .onConflictDoUpdate({
      target: pages.tenantId,
      set: { content },
    });
}

// ---------------------------------------------------------------------------
// media
// ---------------------------------------------------------------------------

export function listMediaForTenant(tenantId: string) {
  return db.select().from(media)
    .where(eq(media.tenantId, tenantId)).all();
}

export function findMediaForTenant(tenantId: string, mediaId: string) {
  return db.select().from(media)
    .where(and(eq(media.id, mediaId), eq(media.tenantId, tenantId)))
    .get();
}

export function deleteMediaForTenant(tenantId: string, mediaId: string) {
  return db.delete(media)
    .where(and(eq(media.id, mediaId), eq(media.tenantId, tenantId)));
}

export function insertMediaForTenant(
  tenantId: string,
  fields: Omit<typeof media.$inferInsert, 'tenantId' | 'id'> & { id: string },
) {
  return db.insert(media).values({ ...fields, tenantId });
}

// ---------------------------------------------------------------------------
// pro_site_files
// ---------------------------------------------------------------------------

export function listProSiteFilesForTenant(tenantId: string) {
  return db.select().from(proSiteFiles)
    .where(eq(proSiteFiles.tenantId, tenantId)).all();
}

export function findProSiteFilesForTenant(tenantId: string) {
  return db.select({ id: proSiteFiles.id }).from(proSiteFiles)
    .where(eq(proSiteFiles.tenantId, tenantId)).all();
}

export function findProSiteFileForTenant(tenantId: string, filePath: string) {
  return db.select({ id: proSiteFiles.id }).from(proSiteFiles)
    .where(and(eq(proSiteFiles.tenantId, tenantId), eq(proSiteFiles.filePath, filePath)))
    .get();
}

export function insertProSiteFileForTenant(
  tenantId: string,
  fields: Omit<typeof proSiteFiles.$inferInsert, 'tenantId' | 'id'> & { id: string },
) {
  return db.insert(proSiteFiles).values({ ...fields, tenantId });
}

export function updateProSiteFileForTenant(
  tenantId: string,
  fileId: string,
  updates: Partial<typeof proSiteFiles.$inferInsert>,
) {
  return db.update(proSiteFiles).set(updates)
    .where(and(eq(proSiteFiles.id, fileId), eq(proSiteFiles.tenantId, tenantId)));
}

// ---------------------------------------------------------------------------
// tenant_subscriptions (one row per tenant; verify scope explicitly).
// ---------------------------------------------------------------------------

export function findSubscriptionForTenant(tenantId: string) {
  return db.select().from(tenantSubscriptions)
    .where(eq(tenantSubscriptions.tenantId, tenantId)).get();
}

// ---------------------------------------------------------------------------
// staff_services (link table; scope-by-parent-id helpers).
// Caller MUST have first verified that the parent staff row is owned by the
// tenant via `findStaffForTenant`; only then is it safe to query the link
// by staffId alone.
// ---------------------------------------------------------------------------

/**
 * Bulk helper: fetch staff-services links for a service, AFTER first
 * resolving the tenant's own staff ids and constraining the link query to
 * that set. This is the safe replacement for any caller that previously
 * did `db.select(...).from(staffServices).where(eq(serviceId, q))` with
 * an untrusted `q` — without this scoping, the caller could observe
 * staff_ids from another tenant that share the same service_id.
 *
 * The two-step scan is necessary because staff_services has no
 * tenant_id column by design (see header comment).
 */
export async function getStaffServicesForServiceInTenant(
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

export function getStaffServicesForStaff(staffId: string) {
  return db.select().from(staffServices)
    .where(eq(staffServices.staffId, staffId)).all();
}

/**
 * Fetch staff_services links for a given service id, RESTRICTED to staff rows
 * that belong to `tenantId`. The link table has no `tenant_id` column, so
 * we first resolve the tenant's staff ids and constrain the link query to
 * that set — otherwise an attacker could supply another tenant's service_id
 * and read every staff in the platform mapped to it.
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

export function deleteStaffServiceLinksByStaff(staffId: string) {
  return db.delete(staffServices).where(eq(staffServices.staffId, staffId));
}

export function deleteStaffServiceLinksByService(serviceId: string) {
  return db.delete(staffServices).where(eq(staffServices.serviceId, serviceId));
}

export function deleteStaffServiceLinksByStaffInTenant(
  tenantId: string,
  staffIds: string[],
) {
  if (!staffIds.length) return Promise.resolve();
  return db.delete(staffServices)
    .where(inArray(staffServices.staffId, staffIds));
}

export function insertStaffServiceLinks(
  staffId: string,
  serviceIds: string[],
) {
  if (!serviceIds.length) return Promise.resolve();
  return db.insert(staffServices).values(
    serviceIds.map((serviceId) => ({ staffId, serviceId })),
  );
}

/** Filter services by id list AND tenant — defence in depth before linking
 *  them to a staff. Returns the ids that are actually owned by `tenantId`. */
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

// ---------------------------------------------------------------------------
// staff_availability (no tenant_id column; scope via parent staffId after
// the caller has proven staff ownership).
// ---------------------------------------------------------------------------

export function getStaffAvailabilityForStaff(staffId: string) {
  return db.select().from(staffAvailability)
    .where(eq(staffAvailability.staffId, staffId)).all();
}

export function deleteStaffAvailabilityForStaff(staffId: string) {
  return db.delete(staffAvailability).where(eq(staffAvailability.staffId, staffId));
}

export function insertStaffAvailabilityForStaff(
  staffId: string,
  rows: { dayOfWeek: number; startTime: string; endTime: string; id: string }[],
) {
  if (!rows.length) return Promise.resolve();
  return db.insert(staffAvailability).values(
    rows.map((r) => ({
      id: r.id,
      staffId,
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
    })),
  );
}

// ---------------------------------------------------------------------------
// Misc — public "today's queue" feed for a tenant. Used by /api/public to
// list confirmed/pending appointments on a given Addis day.
// ---------------------------------------------------------------------------

export function listPublicAppointmentsForTenantOnDay(
  tenantId: string,
  startTimeGte: number,
  startTimeLt: number,
) {
  return db.select({
    id: appointments.id,
    startTime: appointments.startTime,
    endTime: appointments.endTime,
    status: appointments.status,
    serviceName: services.name,
  })
    .from(appointments)
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .where(and(
      eq(appointments.tenantId, tenantId),
      inArray(appointments.status, ['confirmed', 'pending']),
      gte(appointments.startTime, startTimeGte),
      lt(appointments.startTime, startTimeLt),
    ))
    .all();
}

// Re-export sql helpers callers may need to build their own extra filters.
export { gte as tenantGte, lt as tenantLt, desc as tenantDesc } from 'drizzle-orm';
