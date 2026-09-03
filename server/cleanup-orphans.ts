/**
 * Orphan tenant cleanup script.
 *
 * Deletes any tenant row that has no associated user (orphaned by a failed
 * registration where the tenant was inserted but the user or subscription
 * was not). Safe to run at any time — it only removes rows that are
 * unreachable through any normal platform operation.
 *
 * Usage: npx tsx server/cleanup-orphans.ts
 */
import { db } from '../src/db';
import {
  tenants, users, tenantSubscriptions, appointments, appointmentServices,
  services, staff, staffAvailability, staffServices, recurringSeries,
  inventoryItems, media, pages, proSiteFiles,
  tenantBusinessHours, tenantClosures, payments,
  siteConfig, invoices, apiKeys, billingReminderSends, promoCodes,
  customerStats, punchCards, proAlerts, loyaltyLedger,
} from '../src/db/schema';
import { eq, inArray } from 'drizzle-orm';

async function main() {
  const allTenantIds = (await db.select({ id: tenants.id }).from(tenants).all()).map(r => r.id);
  if (allTenantIds.length === 0) {
    console.log('No tenants found — nothing to clean up.');
    return;
  }

  const ownedIds = new Set(
    (await db.select({ tenantId: users.tenantId }).from(users).all())
      .map(r => r.tenantId)
      .filter(Boolean) as string[]
  );

  const orphanIds = allTenantIds.filter(id => !ownedIds.has(id));

  if (orphanIds.length === 0) {
    console.log('No orphaned tenants found. All tenants have associated users.');
    return;
  }

  console.log(`Found ${orphanIds.length} orphaned tenant(s): ${orphanIds.join(', ')}`);

  // loyalty_ledger rows are append-only (enforced by triggers) — they cannot
  // be deleted, and their cascade from tenants is also blocked. Tenants that
  // still carry ledger history are SKIPPED and reported for manual handling:
  // the ledger is a fraud-protection audit surface, not cleanup debris.
  const skipped: string[] = [];
  let deleted = 0;

  for (const id of orphanIds) {
    const loyaltyRows = await db.select({ id: loyaltyLedger.id })
      .from(loyaltyLedger)
      .where(eq(loyaltyLedger.tenantId, id))
      .all();
    if (loyaltyRows.length > 0) {
      skipped.push(id);
      continue;
    }

    console.log(`  Deleting orphan tenant ${id}...`);

    // Delete in FK-safe order: children that reference appointments /
    // staff / services must go BEFORE the rows they point at, or SQLite
    // raises FOREIGN KEY constraint failures and aborts the cleanup.
    const apptIds = (await db.select({ id: appointments.id })
      .from(appointments).where(eq(appointments.tenantId, id)).all())
      .map(r => r.id);
    if (apptIds.length > 0) {
      await db.delete(appointmentServices).where(inArray(appointmentServices.appointmentId, apptIds));
    }
    await db.delete(recurringSeries).where(eq(recurringSeries.tenantId, id));
    await db.delete(inventoryItems).where(eq(inventoryItems.tenantId, id));
    // staff_services is keyed by staff, not tenant — delete via the
    // tenant's staff IDs (collected here, used for both child tables).
    const staffRows = (await db.select({ sid: staff.id }).from(staff).where(eq(staff.tenantId, id)).all())
      .map(r => r.sid);
    if (staffRows.length > 0) {
      await db.delete(staffServices).where(inArray(staffServices.staffId, staffRows));
      await db.delete(staffAvailability).where(inArray(staffAvailability.staffId, staffRows));
    }
    await db.delete(payments).where(eq(payments.tenantId, id));
    await db.delete(invoices).where(eq(invoices.tenantId, id));
    await db.delete(billingReminderSends).where(eq(billingReminderSends.tenantId, id));
    await db.delete(apiKeys).where(eq(apiKeys.tenantId, id));
    await db.delete(promoCodes).where(eq(promoCodes.tenantId, id));
    await db.delete(siteConfig).where(eq(siteConfig.tenantId, id));
    await db.delete(customerStats).where(eq(customerStats.tenantId, id));
    // loyalty_ledger is append-only (enforced by triggers) AND cascades on
    // tenant delete — so do NOT delete it directly; the tenant delete below
    // removes its rows through the cascade.
    await db.delete(punchCards).where(eq(punchCards.tenantId, id));
    await db.delete(proAlerts).where(eq(proAlerts.tenantId, id));
    await db.delete(appointments).where(eq(appointments.tenantId, id));
    await db.delete(proSiteFiles).where(eq(proSiteFiles.tenantId, id));
    await db.delete(pages).where(eq(pages.tenantId, id));
    await db.delete(media).where(eq(media.tenantId, id));
    await db.delete(tenantBusinessHours).where(eq(tenantBusinessHours.tenantId, id));
    await db.delete(tenantClosures).where(eq(tenantClosures.tenantId, id));
    await db.delete(services).where(eq(services.tenantId, id));
    await db.delete(staff).where(eq(staff.tenantId, id));
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, id));
    await db.delete(tenants).where(eq(tenants.id, id));

    console.log(`  Deleted orphan tenant ${id}.`);
    deleted++;
  }

  console.log(`Cleanup complete: ${deleted} deleted, ${skipped.length} skipped (append-only loyalty history).`);
  if (skipped.length > 0) {
    console.log(`Skipped tenant IDs: ${skipped.join(', ')}`);
  }
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
