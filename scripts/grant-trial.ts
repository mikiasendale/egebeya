import { db } from '../src/db';
import { tenants, plans } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { grantProTrial } from '../server/lib/trial';

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: npx tsx scripts/grant-trial.ts <tenant-slug|tenant-id>');
    process.exit(1);
  }

  const tenant = await db.select().from(tenants).where(eq(tenants.slug, raw)).get();
  const tenantId = tenant?.id ?? raw;

  const row = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
  if (!row) {
    console.error(`Tenant not found: ${raw}`);
    process.exit(1);
  }

  const result = await grantProTrial(tenantId);
  const plan = await db.select().from(plans).where(eq(plans.name, 'pro')).get();

  console.log(JSON.stringify({
    success: true,
    tenantId,
    granted: result.granted,
    planName: plan?.name ?? 'pro',
    status: 'trial',
    trialEndsAt: result.trialEndsAt,
  }, null, 2));
}

main();
