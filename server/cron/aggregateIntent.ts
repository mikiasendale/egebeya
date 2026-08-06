/**
 * Intent Aggregation Cron — turns /discover buying signals into proactive
 * Pro-merchant demand alerts (Market Pulse).
 *
 * Runs every 2 hours. Queries search_intent for the last window, groups by
 * (category, city). When a group crosses the demand threshold (>5 actions),
 * it:
 *   1. finds every Pro tenant in that city + category,
 *   2. sends them a proactive SMS alert ("N customers are looking for a X"),
 *   3. records a pro_alert per tenant so the dashboard can show the pulse.
 *
 * Cheap-VPS friendly: counts/aggregation happen in SQL; only matching tenants
 * are loaded; outbound SMS is throttled to 1/sec.
 *
 * Production crontab (every 2 hours):
 *   0 0,2,4,6,8,10,12,14,16,18,20,22 * * * cd /path/to/egebeya && npm run aggregate-intent
 */
import { db } from '../../src/db';
import {
  searchIntent, proAlerts, tenants, tenantSubscriptions, plans, users,
} from '../../src/db/schema';
import { eq, and, gte, sql, inArray } from 'drizzle-orm';
import crypto from 'crypto';
import { sendSms, type SmsOptions } from '../lib/sms';

/** Lookback window matches the cron cadence (2 hours). */
const WINDOW_MS = 2 * 60 * 60 * 1000;
/** Demand threshold — only surface pulses with more than this many signals. */
const DEMAND_THRESHOLD = 5;
/** One outbound SMS per second — cheap-VPS ratelimit guard. */
const THROTTLE_MS = 1000;

interface DemandPulse {
  category: string | null;
  city: string | null;
  count: number;
}

/** Overridable hooks for testing (asserting the LIMIT-free SQL aggregation). */
export interface AggregateDeps {
  now?: number;
  threshold?: number;
  throttleMs?: number;
  sendSmsFn?: (opts: SmsOptions) => Promise<unknown>;
}

/**
 * Aggregate recent intent into (category, city) demand pulses, all in SQL.
 * Only groups strictly above the threshold are returned.
 */
async function aggregatePulses(now: number, threshold: number): Promise<DemandPulse[]> {
  const since = now - WINDOW_MS;

  const groups = await db
    .select({
      category: searchIntent.category,
      city: searchIntent.city,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(searchIntent)
    .where(gte(searchIntent.createdAt, since))
    .groupBy(searchIntent.category, searchIntent.city)
    .having(sql`count(*) > ${threshold}`)
    .all();

  return groups.map((g) => ({
    category: g.category,
    city: g.city,
    count: Number(g.count),
  }));
}

/**
 * Find Pro tenants that serve a given city + category. City is stored in the
 * tenant settings JSON blob, so we match it case-insensitively via LIKE.
 */
async function findProTenants(category: string | null, city: string | null): Promise<Array<{
  tenantId: string;
  tenantName: string;
  slug: string;
  ownerPhone: string | null;
}>> {
  const conditions: any[] = [eq(plans.name, 'pro')];
  if (category) {
    conditions.push(eq(tenants.category, category));
  }
  if (city) {
    conditions.push(
      sql`lower(json_extract(${tenants.settings}, '$.city')) LIKE ${'%' + city.toLowerCase() + '%'}`,
    );
  }

  const matches = await db
    .select({
      tenantId: tenants.id,
      tenantName: tenants.name,
      slug: tenants.slug,
    })
    .from(tenants)
    .innerJoin(tenantSubscriptions, eq(tenants.id, tenantSubscriptions.tenantId))
    .innerJoin(plans, eq(tenantSubscriptions.planId, plans.id))
    .where(and(...conditions))
    .all();

  // Attach the owner's phone (best-effort) so we can alert them by SMS.
  const ownerPhone = new Map<string, string | null>();
  if (matches.length > 0) {
    const ids = matches.map((m) => m.tenantId);
    // users.inArray requires a non-empty array (guarded above).
    const owners = await db
      .select({ tenantId: users.tenantId, phone: users.phone })
      .from(users)
      .where(and(inArray(users.tenantId, ids), eq(users.role, 'owner')))
      .all();
    for (const o of owners) ownerPhone.set(o.tenantId, o.phone);
  }

  return matches.map((m) => ({
    tenantId: m.tenantId,
    tenantName: m.tenantName,
    slug: m.slug,
    ownerPhone: ownerPhone.get(m.tenantId) ?? null,
  }));
}

/**
 * Run one aggregation pass. Returns the number of tenants alerted.
 */
export async function runOnce(deps: AggregateDeps = {}): Promise<number> {
  const now = deps.now ?? Date.now();
  const threshold = deps.threshold ?? DEMAND_THRESHOLD;
  const throttleMs = deps.throttleMs ?? THROTTLE_MS;
  const sender = deps.sendSmsFn ?? sendSms;

  const pulses = await aggregatePulses(now, threshold);
  if (pulses.length === 0) {
    console.log('[aggregateIntent] No demand pulses above threshold.');
    return 0;
  }

  let alerted = 0;

  for (const pulse of pulses) {
    const categoryLabel = pulse.category ?? 'business';
    const cityLabel = pulse.city ?? 'your area';
    const message =
      `📈 ${pulse.count} customers in ${cityLabel} are looking for a ${categoryLabel} ` +
      `right now! Tap here to send a flash discount link.`;

    const tenants = await findProTenants(pulse.category, pulse.city);

    for (const t of tenants) {
      // Record the alert for the dashboard regardless of whether we can SMS.
      await db.insert(proAlerts).values({
        id: crypto.randomUUID(),
        tenantId: t.tenantId,
        category: categoryLabel,
        city: cityLabel,
        actionCount: pulse.count,
        message,
        createdAt: now,
      });

      if (t.ownerPhone) {
        try {
          await sender({ to: t.ownerPhone, text: message });
        } catch (err) {
          console.error(`[aggregateIntent] SMS failed for tenant ${t.tenantId}; continuing.`, err);
        }
        alerted += 1;

        if (throttleMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, throttleMs));
        }
      }
    }

    console.log(
      `[aggregateIntent] Pulse: ${pulse.count}× ${categoryLabel} in ${cityLabel} → ${tenants.length} Pro tenant(s).`,
    );
  }

  console.log(`[aggregateIntent] Finished. Alerted ${alerted} tenant(s).`);
  return alerted;
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
  const isLoop = process.argv.includes('--loop');

  async function main(): Promise<void> {
    if (isLoop) {
      const INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
      console.log(`Loop mode: running every ${INTERVAL_MS / 1000}s`);
      await runOnce();
      setInterval(async () => {
        try {
          await runOnce();
        } catch (err) {
          console.error('[aggregateIntent] Loop iteration error:', err);
        }
      }, INTERVAL_MS);
    } else {
      await runOnce();
      process.exit(0);
    }
  }

  main().catch((err) => {
    console.error('[aggregateIntent] Fatal error:', err);
    process.exit(1);
  });
}
