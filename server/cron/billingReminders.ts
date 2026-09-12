/**
 * Billing renewal reminders + dunning-lite (P1.4).
 *
 * Sends, per Pro subscription cycle, exactly one notice per stage:
 *   renewal_3d   — T-3d  "renews in 3 days"
 *   renewal_due  — T-0d  "payment due today"
 *   past_due_2d  — T+2d  grace-period warning
 *   past_due_5d  — T+5d  final warning before downgrade
 *
 * Idempotent per (tenant, stage, cycle) via the billing_reminder_sends
 * UNIQUE index — safe to run every hour from crontab:
 *   0 * * * * cd /path/to/egebeya && npm run billing:reminders
 *
 * Grace expiry itself is handled by the existing downgrade-expired cron at
 * endsAt + 7 days; the T+5d notice is the last friendly warning before it.
 *
 * TODO(P3.x): Telegram channel delivery via NotificationAdapter once the bot
 * exists — the marker row already carries a `channel` column for it.
 */
import { db } from '../../src/db';
import { tenantSubscriptions, plans, tenants, users, billingReminderSends } from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { logSecurityEvent } from '../lib/securityLog';
import { notify, type SendOutcome } from '../lib/notifications';
import { bothLocaleTrees } from '../lib/cronCopy';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReminderStage {
  key: string;
  /** Offset in days from subscription endsAt. */
  offsetDays: number;
}

/** Stage copy lives in src/locales under notifications.billingStages.<key> — no Amharic literals in cron code (#46). */
const STAGES: ReminderStage[] = [
  { key: 'renewal_3d', offsetDays: -3 },
  { key: 'renewal_due', offsetDays: 0 },
  { key: 'past_due_2d', offsetDays: 2 },
  { key: 'past_due_5d', offsetDays: 5 },
];

export interface BillingReminderRunOptions {
  now?: number;
  /** Adapter dispatch — injected for tests (winback-cron pattern). */
  notifyFn?: typeof notify;
}

/**
 * One cron pass. Returns how many notices were actually sent.
 * Clock-injectable for deterministic tests (winback-cron pattern).
 */
export async function runOnce(opts: BillingReminderRunOptions = {}): Promise<number> {
  const now = opts.now ?? Date.now();
  const dispatch = opts.notifyFn ?? notify;
  let sent = 0;

  // Active Pro subscriptions with a known cycle end.
  const subs = await db.select({
    tenantId: tenantSubscriptions.tenantId,
    startsAt: tenantSubscriptions.startsAt,
    endsAt: tenantSubscriptions.endsAt,
  })
    .from(tenantSubscriptions)
    .innerJoin(plans, eq(tenantSubscriptions.planId, plans.id))
    .where(and(
      eq(tenantSubscriptions.status, 'active'),
      eq(plans.name, 'pro'),
    ))
    .all();

  for (const sub of subs) {
    if (typeof sub.endsAt !== 'number') continue;

    // Identify the cycle this notice belongs to. startAt may be null on old
    // rows — fall back to endsAt minus one standard cycle.
    const cycleStart = typeof sub.startsAt === 'number'
      ? sub.startsAt
      : sub.endsAt - 30 * DAY_MS;

    const owner = await db.select({ email: users.email, name: users.name })
      .from(users)
      .where(and(eq(users.tenantId, sub.tenantId), eq(users.role, 'owner')))
      .get();
    if (!owner?.email) continue;

    for (const stage of STAGES) {
      const windowStart = sub.endsAt + stage.offsetDays * DAY_MS;
      const inWindow = now >= windowStart && now < windowStart + DAY_MS;
      if (!inWindow) continue;

      // P1.4 red-flag fix: a send failure must NOT burn the stage's notice.
      // Two-phase: insert the idempotency marker FIRST (its UNIQUE index
      // arbitrates concurrent runs and prevents duplicate sends), then send.
      // If the send fails, DELETE the marker so the next run retries the
      // stage. The delete-on-failure is what the old code lacked — it left
      // the marker committed on a failed send, silently losing the notice
      // for the whole cycle.
      let markerId: string | null = null;
      try {
        const row = { id: crypto.randomUUID(), tenantId: sub.tenantId, stage: stage.key, cycleStart, channel: 'email', sentAt: Date.now() };
        markerId = row.id;
        await db.insert(billingReminderSends).values(row);
      } catch (err: any) {
        const code = String(err?.code || err?.cause?.code || '');
        const msg = String(err?.message || err?.cause?.message || '');
        if (code.includes('SQLITE_CONSTRAINT') || msg.includes('UNIQUE')) continue; // another run owns this stage
        throw err;
      }

      try {
        // P3.1: dispatched through the NotificationAdapter. Email is the
        // configured channel today; Telegram owner notices can ride the same
        // seam once a tenant-owner chat link exists (marker row already
        // carries the `channel` column for it).
        const stageCopy = bothLocaleTrees('notifications', 'billingStages', stage.key);
        const outcome: SendOutcome = await dispatch({
          channel: 'email',
          template: `billing_${stage.key}`,
          to: { email: owner.email },
          subject: `${stageCopy.am.subject} · ${stageCopy.en.subject}`,
          text: `${stageCopy.am.body}\n\n${stageCopy.en.body}`,
          tenantId: sub.tenantId,
          refType: 'subscription',
          refId: String(cycleStart),
        });
        if (!outcome.ok) {
          throw new Error(outcome.error || 'send failed');
        }
        sent += 1;
        logSecurityEvent({
          type: 'billing_reminder_sent',
          tenantId: sub.tenantId,
          result: 'success',
          details: { stage: stage.key, cycleStart, endsAt: sub.endsAt },
        });
      } catch (err) {
        // Send failed → roll back the marker so the next run retries this
        // stage. Without this delete the notice would be lost for the cycle.
        console.error(`[billing-reminders] send failed (${stage.key}) for ${sub.tenantId}:`, err);
        if (markerId) {
          try {
            await db.delete(billingReminderSends).where(and(
              eq(billingReminderSends.id, markerId),
              eq(billingReminderSends.tenantId, sub.tenantId),
              eq(billingReminderSends.stage, stage.key),
              eq(billingReminderSends.cycleStart, cycleStart),
            ));
          } catch (delErr) {
            console.error(`[billing-reminders] marker rollback failed for ${sub.tenantId}:`, delErr);
          }
        }
      }
    }
  }

  return sent;
}

// ── CLI entry point ─────────────────────────────────────────────────────
const invokedDirectly = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invokedDirectly && process.env.NODE_ENV !== 'test') {
  runOnce()
    .then((count) => {
      console.log(`[billing-reminders] sent ${count} notice(s).`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[billing-reminders] failed:', err);
      process.exit(1);
    });
}
