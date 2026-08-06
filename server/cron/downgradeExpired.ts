/**
 * Downgrade cron — reverts lapsed Pro tenants to the Free plan.
 *
 * A tenant whose paid Pro cycle ended more than `DOWNGRADE_AFTER_GRACE_MS`
 * (7 days) ago — i.e. they are well past both `endsAt` and the 5-day grace
 * window — is moved back onto Free so Pro-only gates stop granting access.
 *
 * Production crontab (runs daily):
 *   0 3 * * * cd /path/to/egebeya && npm run downgrade-expired
 */
import { db } from '../../src/db';
import { tenantSubscriptions, plans } from '../../src/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { DOWNGRADE_AFTER_GRACE_MS } from '../lib/billing';

/**
 * Revert every Pro subscription whose `endsAt` fell out of the 7-day
 * window to the Free plan. Returns the number of tenants downgraded.
 */
export async function runOnce(now: number = Date.now()): Promise<number> {
  const freePlan = await db.select().from(plans).where(eq(plans.name, 'free')).get();
  if (!freePlan) {
    console.warn('[downgradeExpired] free plan row missing — aborting');
    return 0;
  }

  const cutoff = now - DOWNGRADE_AFTER_GRACE_MS;

  const lapsed = await db.select().from(tenantSubscriptions)
    .where(and(
      eq(tenantSubscriptions.status, 'active'),
      sql`${tenantSubscriptions.endsAt} IS NOT NULL`,
      sql`${tenantSubscriptions.endsAt} < ${cutoff}`,
    ))
    .all();

  let count = 0;
  for (const sub of lapsed) {
    await db.update(tenantSubscriptions)
      .set({
        planId: freePlan.id,
        status: 'expired',
        trialEndsAt: null,
        endsAt: null,
      })
      .where(eq(tenantSubscriptions.id, sub.id));
    count++;
  }

  if (count > 0) {
    console.log(`[downgradeExpired] downgraded ${count} lapsed Pro tenant(s) to Free`);
  }
  return count;
}

import { fileURLToPath } from 'url';
import path from 'path';

// Only execute CLI on direct invocation, never on import (server.ts loads
// this module for node-cron scheduling, so it must not self-run in a bundle).
const isDirectRun = (() => {
  if (process.env.NODE_ENV === 'test') return false;
  try {
    return process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  async function main(): Promise<void> {
    const count = await runOnce();
    console.log(`[downgradeExpired] done. ${count} tenant(s) downgraded.`);
    process.exit(0);
  }

  main().catch((err) => {
    console.error('Fatal error in downgradeExpired cron', err);
    process.exit(1);
  });
}
