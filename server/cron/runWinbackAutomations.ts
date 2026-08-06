/**
 * Automated Win-Back Sequence — Apollo.io-style outreach, indigenized for
 * Ethiopian service businesses over SMS (Telegram deep-links render client-side).
 *
 * VPS HARD CONSTRAINTS (low-RAM):
 *   - Never loads all customer rows. The candidate query filters in SQL
 *     (last_visit_at window, automation_state, Pro-subscription join) and
 *     applies a server-side LIMIT so memory is bounded per run.
 *   - Throttles: one outbound send per second so a cheap VPS never bursts
 *     into provider rate limits.
 *   - No customer PII in logs — only a redacted phone prefix and counts.
 *
 * Production crontab (runs daily at 09:00 Addis time):
 *   0 6 * * * cd /path/to/egebeya && npm run winback-automations
 *
 * The --loop flag runs continuously with a 6-hour sleep (dev/demo convenience).
 */

import { db } from '../../src/db';
import {
  customerStats,
  tenants,
  tenantSubscriptions,
  plans,
  promoCodes,
} from '../../src/db/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { sendSms, type SmsOptions } from '../lib/sms';

/** Customers contacted in one run. Bounded to protect VPS RAM. */
const CHUNK_SIZE = 50;
/** One outbound API call per second — cheap-VPS ratelimit guard. */
const THROTTLE_MS = 1000;
/** Winback targets: last visit older than this (30 days). */
const INACTIVE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/** A single winback-ready customer + the tenant context needed to message them. */
interface WinbackTarget {
  customerPhone: string;
  customerName: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
}

/** Overridable hooks for testing (LIMIT assertion, deterministic throttle). */
export interface WinbackDeps {
  now?: number;
  chunkSize?: number;
  throttleMs?: number;
  sendSmsFn?: (opts: SmsOptions) => Promise<unknown>;
}

function redactPhone(phone: string): string {
  return phone.length >= 7 ? phone.slice(0, 7) + '****' : '***';
}

/** Generate a short, unique winback promo code, e.g. WINBACK10-A1B2. */
function generatePromoCode(): string {
  return `WINBACK10-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

/**
 * Pick the next batch of winback candidates. SQL-side filtering + a LIMIT
 * guarantee memory stays bounded regardless of table size.
 */
async function selectCandidates(
  now: number,
  chunkSize: number,
): Promise<WinbackTarget[]> {
  const cutoff = now - INACTIVE_AFTER_MS;

  // Join customer_stats → tenants → tenant_subscriptions → plans so we only
  // ever touch customers whose tenant is on an active Pro plan. All filters
  // (date window, automation_state, plan) live in SQL — nothing pulled into
  // a JS array unfiltered.
  const rows = await db
    .select({
      customerPhone: customerStats.customerPhone,
      customerName: customerStats.customerName,
      tenantId: customerStats.tenantId,
      tenantSlug: tenants.slug,
      tenantName: tenants.name,
    })
    .from(customerStats)
    .innerJoin(tenants, eq(customerStats.tenantId, tenants.id))
    .innerJoin(tenantSubscriptions, eq(tenants.id, tenantSubscriptions.tenantId))
    .innerJoin(plans, eq(tenantSubscriptions.planId, plans.id))
    .where(
      and(
        // Inactive >30 days. NULL last_visit_at (never visited) is excluded —
        // winback only fires for lapsed visitors.
        sql`${customerStats.lastVisitAt} IS NOT NULL`,
        lt(customerStats.lastVisitAt, cutoff),
        eq(customerStats.automationState, 'active'),
        eq(plans.name, 'pro'),
        // Active (or trialing, non-lapsed) Pro subscription only.
        sql`${tenantSubscriptions.status} IN ('active', 'trial')`,
        // Tenant-owner opt-in gate. The winback sequence only fires when the
        // owner has flipped `automations_enabled` ON in Settings. Filtered
        // SQL-side so a disabled tenant's rows are never loaded AND never
        // have their automation_state touched — they stay eligible for a
        // later run if the owner turns the toggle back on.
        sql`json_extract(${tenants.settings}, '$.automations_enabled') = 1`,
      ),
    )
    .limit(chunkSize)
    .all();

  return rows;
}

/**
 * Run one winback pass. Returns the number of customers contacted.
 *
 * Idempotent: every sent customer flips to `winback_sent`, which excludes them
 * from the next run's candidate query. A second run therefore sends nothing.
 */
export async function runOnce(deps: WinbackDeps = {}): Promise<number> {
  const now = deps.now ?? Date.now();
  const chunkSize = deps.chunkSize ?? CHUNK_SIZE;
  const throttleMs = deps.throttleMs ?? THROTTLE_MS;
  const sender = deps.sendSmsFn ?? sendSms;

  const candidates = await selectCandidates(now, chunkSize);
  if (candidates.length === 0) {
    console.log('[winback] No winback candidates.');
    return 0;
  }

  console.log(`[winback] Processing ${candidates.length} winback candidate(s)...`);

  let sent = 0;
  for (const c of candidates) {
    const code = generatePromoCode();

    // Persist the promo code so the discount is redeemable at booking time.
    try {
      await db.insert(promoCodes).values({
        id: crypto.randomUUID(),
        tenantId: c.tenantId,
        code,
        discountType: 'percent',
        discountValue: 10,
        maxUses: 1,
        usedCount: 0,
        isActive: true,
        validFrom: now,
        validUntil: now + 30 * 24 * 60 * 60 * 1000, // 30-day validity
        createdAt: now,
      });
    } catch (err) {
      // Duplicate code (collision) — skip this customer rather than spam.
      console.warn(`[winback] Promo insert failed for ${redactPhone(c.customerPhone)}; skipping.`);
      continue;
    }

    // Bilingual (Amharic first) winback message with a direct booking link.
    const name = c.customerName?.trim() || 'there';
    const link = `https://${c.tenantSlug}.egebeya.et`;
    const text = `ሰላም ${name}፣ እንደገና እንገናኝብሃለን! የልዩ የ10% ቅናጻ ${code} በመጠቀም ይመልሱ። ${link} / Hi ${name}, we miss you! Come back with 10% off using code ${code}. Book: ${link}`;

    try {
      await sender({ to: c.customerPhone, text });
    } catch (err) {
      // Log a redacted prefix only — never PII. Continue to the next customer.
      console.error(`[winback] Send failed for ${redactPhone(c.customerPhone)}; continuing.`, err);
      continue;
    }

    // Flip state so this customer is never contacted twice (idempotency).
    await db.update(customerStats)
      .set({
        automationState: 'winback_sent',
        lastAutomationSentAt: now,
      })
      .where(
        and(
          eq(customerStats.tenantId, c.tenantId),
          eq(customerStats.customerPhone, c.customerPhone),
        ),
      );
    sent += 1;

    // Throttle: wait between outbound API calls to respect rate limits.
    if (throttleMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, throttleMs));
    }
  }

  console.log(`[winback] Finished. Sent ${sent} winback message(s) this run.`);
  return sent;
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
      const INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
      console.log(`Loop mode: running every ${INTERVAL_MS / 1000}s`);
      await runOnce();
      setInterval(async () => {
        try {
          await runOnce();
        } catch (err) {
          console.error('[winback] Loop iteration error:', err);
        }
      }, INTERVAL_MS);
    } else {
      await runOnce();
      process.exit(0);
    }
  }

  main().catch((err) => {
    console.error('[winback] Fatal error:', err);
    process.exit(1);
  });
}
