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
  tenants, users, tenantSubscriptions, appointments,
  services, staff, staffAvailability, media, pages, proSiteFiles,
  tenantBusinessHours, tenantClosures, payments,
} from '../src/db/schema';
import { eq } from 'drizzle-orm';

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

  for (const id of orphanIds) {
    console.log(`  Deleting orphan tenant ${id}...`);

    // Get all staff IDs for this tenant (need to delete availability links)
    const staffRows = await db.select({ sid: staff.id }).from(staff).where(eq(staff.tenantId, id)).all();
    for (const s of staffRows) {
      await db.delete(staffAvailability).where(eq(staffAvailability.staffId, s.sid));
    }

    await db.delete(payments).where(eq(payments.tenantId, id));
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
  }

  console.log('Cleanup complete.');
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
