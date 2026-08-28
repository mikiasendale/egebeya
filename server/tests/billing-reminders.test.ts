/**
 * P1.4 — renewal reminders + dunning-lite cron.
 *
 * Clock-injected runOnce (winback-cron pattern). Covers:
 *   1. Each stage (T-3d, T-0d, T+2d, T+5d) fires exactly once per cycle.
 *   2. A second identical pass is a no-op (idempotency marker).
 *   3. A new cycle (fresh startsAt/endsAt) re-arms the stages.
 *   4. Past grace expiry the cron goes silent and downgradeExpired takes over.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { eq, inArray, and } from 'drizzle-orm';

import { db } from '../../src/db';
import { tenants, users, plans, tenantSubscriptions, billingReminderSends } from '../../src/db/schema';
import { runOnce } from '../../server/cron/billingReminders';
import { runOnce as downgradeOnce } from '../../server/cron/downgradeExpired';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 5, 15, 9, 0, 0); // fixed clock

// P3.1 seam: the cron now dispatches through the NotificationAdapter, so the
// stub fakes notify() instead of the raw mailer. Assertions keep the same
// semantics (recipient + subject per send).
function mailerStub() {
  const calls: Array<{ to?: string; subject?: string; channel?: string }> = [];
  return {
    calls,
    fn: (async (req: any) => {
      calls.push({ to: req.to?.email, subject: req.subject, channel: req.channel });
      return { ok: true, providerId: 'test', status: 'sent' };
    }) as any,
  };
}

describe('billing renewal reminders (P1.4)', () => {
  const tenantIds: string[] = [];
  let proPlanId: string;
  let freePlanId: string;

  async function makeProTenant(endsAt: number): Promise<string> {
    const tenantId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    await db.insert(tenants).values({
      id: tenantId,
      name: `Reminder Tenant ${tenantId.slice(0, 6)}`,
      slug: `remind-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      settings: {},
      createdAt: Date.now(),
    });
    await db.insert(users).values({
      id: userId,
      tenantId,
      name: 'Reminder Owner',
      phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
      email: `remind-${userId.slice(0, 8)}@egebeya.test`,
      passwordHash: 'x',
      role: 'owner',
      createdAt: Date.now(),
    });
    await db.insert(tenantSubscriptions).values({
      id: crypto.randomUUID(),
      tenantId,
      planId: proPlanId,
      status: 'active',
      startsAt: NOW - 30 * DAY,
      endsAt,
    });
    tenantIds.push(tenantId);
    return tenantId;
  }

  beforeAll(async () => {
    const pro = await db.select().from(plans).where(eq(plans.name, 'pro')).get();
    const free = await db.select().from(plans).where(eq(plans.name, 'free')).get();
    if (!pro || !free) throw new Error('canonical plans missing');
    proPlanId = pro.id;
    freePlanId = free.id;
  });

  afterAll(async () => {
    if (tenantIds.length > 0) {
      await db.delete(billingReminderSends).where(inArray(billingReminderSends.tenantId, tenantIds)).catch(() => {});
      await db.delete(tenantSubscriptions).where(inArray(tenantSubscriptions.tenantId, tenantIds)).catch(() => {});
      for (const id of tenantIds) {
        await db.delete(users).where(eq(users.tenantId, id)).catch(() => {});
        await db.delete(tenants).where(eq(tenants.id, id)).catch(() => {});
      }
    }
  });

  it('sends exactly one notice per stage across the cycle timeline', async () => {
    const endsAt = NOW + 30 * DAY;
    const tenantId = await makeProTenant(endsAt);
    const m = mailerStub();

    // T-3d window
    expect(await runOnce({ now: endsAt - 3 * DAY + 3600_000, notifyFn: m.fn })).toBe(1);
    // T-0d window
    expect(await runOnce({ now: endsAt + 3600_000, notifyFn: m.fn })).toBe(1);
    // T+2d window
    expect(await runOnce({ now: endsAt + 2 * DAY + 3600_000, notifyFn: m.fn })).toBe(1);
    // T+5d window
    expect(await runOnce({ now: endsAt + 5 * DAY + 3600_000, notifyFn: m.fn })).toBe(1);

    expect(m.calls.length).toBe(4);
    expect(m.calls[0].subject).toContain('የPro');
    expect(m.calls[0].to).toContain('@egebeya.test');

    // Outside any stage window: nothing more.
    expect(await runOnce({ now: endsAt - DAY, notifyFn: m.fn })).toBe(0);

    // Re-running every exact same instant: all idempotent, zero sends.
    expect(await runOnce({ now: endsAt - 3 * DAY + 3600_000, notifyFn: m.fn })).toBe(0);
    expect(await runOnce({ now: endsAt + 3600_000, notifyFn: m.fn })).toBe(0);
    expect(await runOnce({ now: endsAt + 2 * DAY + 3600_000, notifyFn: m.fn })).toBe(0);
    expect(await runOnce({ now: endsAt + 5 * DAY + 3600_000, notifyFn: m.fn })).toBe(0);
    expect(m.calls.length).toBe(4);

    // Four markers exist for the single cycle.
    const markers = await db.select().from(billingReminderSends)
      .where(eq(billingReminderSends.tenantId, tenantId));
    expect(markers.length).toBe(4);
    expect(new Set(markers.map((r) => r.stage)).size).toBe(4);
  });

  it('a new cycle re-arms the stages', async () => {
    // endsAt = NOW + 2.5d puts NOW inside this cycle's renewal_3d window.
    const tenantId = await makeProTenant(NOW + Math.floor(2.5 * DAY));
    const m = mailerStub();

    expect(await runOnce({ now: NOW, notifyFn: m.fn })).toBe(1);
    const afterCycle1 = m.calls.length;

    // Renewal: a new cycle_start re-arms the SAME stage even though endsAt is
    // unchanged — markers are keyed by (tenant, stage, cycle_start).
    await db.update(tenantSubscriptions)
      .set({ startsAt: NOW })
      .where(eq(tenantSubscriptions.tenantId, tenantId));

    expect(await runOnce({ now: NOW, notifyFn: m.fn })).toBe(1);
    expect(m.calls.length).toBe(afterCycle1 + 1);
  });

  it('P1.4 RED-FLAG: a failed send commits NO marker; the next run retries the stage', async () => {
    const endsAt = NOW + Math.floor(2.5 * DAY); // NOW inside renewal_3d window
    const tenantId = await makeProTenant(endsAt);

    // First run: the send FAILS (adapter returns ok:false). Old behavior
    // would have committed the marker anyway — the tenant loses the notice.
    const failingStub = {
      fn: (async () => ({ ok: false, status: 'failed', error: 'SMTP down' })) as any,
    };
    expect(await runOnce({ now: NOW, notifyFn: failingStub.fn })).toBe(0);

    // No marker was written — the stage is NOT burned.
    const markers = await db.select().from(billingReminderSends)
      .where(and(
        eq(billingReminderSends.tenantId, tenantId),
        eq(billingReminderSends.stage, 'renewal_3d'),
      )).all();
    expect(markers).toHaveLength(0);

    // Second run (mailer recovered): the SAME stage fires and commits.
    const m = mailerStub();
    expect(await runOnce({ now: NOW, notifyFn: m.fn })).toBe(1);
    expect(m.calls.length).toBe(1);
    expect(m.calls[0].channel).toBe('email');

    // Idempotent after success: no third send.
    expect(await runOnce({ now: NOW, notifyFn: m.fn })).toBe(0);
    expect(m.calls.length).toBe(1);

    // Remove this tenant NOW so its active cycle doesn't bleed into sibling
    // tests (runOnce iterates ALL tenants; the shared test DB persists).
    await db.delete(billingReminderSends).where(eq(billingReminderSends.tenantId, tenantId)).catch(() => {});
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).catch(() => {});
    await db.delete(users).where(eq(users.tenantId, tenantId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
    const idx = tenantIds.indexOf(tenantId);
    if (idx >= 0) tenantIds.splice(idx, 1);
  });

  it('past grace expiry the cron stays silent and downgradeExpired takes over', async () => {
    const endsAt = NOW - 8 * DAY; // beyond the 7-day downgrade window
    const tenantId = await makeProTenant(endsAt);
    const m = mailerStub();

    expect(await runOnce({ now: NOW, notifyFn: m.fn })).toBe(0);

    const flipped = await downgradeOnce(NOW);
    expect(flipped).toBeGreaterThanOrEqual(1);

    const sub = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    expect(sub?.planId).toBe(freePlanId);
    expect(sub?.status).toBe('expired');
  });
});
