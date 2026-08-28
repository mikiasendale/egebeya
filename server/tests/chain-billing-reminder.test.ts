/**
 * CHAIN 13 (P1.4): billing reminder → send → marker → idempotency.
 *
 *   server/cron/billingReminders.ts runOnce({ now, notifyFn })
 *     → active Pro subscriptions near their cycle boundary
 *     → billing_reminder_sends marker INSERT FIRST (UNIQUE arbitrates)
 *     → NotificationAdapter dispatch → success keeps the marker.
 *   Second run: marker exists → stage skipped (no duplicate send).
 *   Failure mode: a failed send DELETES the marker so the next run retries
 *   the stage (the P1.4 red-flag fix).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';

import { db } from '../../src/db';
import { tenantSubscriptions, billingReminderSends, users } from '../../src/db/schema';
import { makeOwner, deleteTenantCascade } from './chain-helpers';

const DAY_MS = 24 * 60 * 60 * 1000;

interface CapturedSend {
  email: string;
  template: string;
  text: string;
}

function makeNotify(capture: CapturedSend[], failFirstN = 0) {
  let calls = 0;
  return async (req: any) => {
    calls += 1;
    if (calls <= failFirstN) {
      throw new Error('SMTP down (injected)');
    }
    capture.push({ email: req.to.email, template: req.template, text: req.text });
    return { ok: true, status: 'sent' as const, providerId: 'msg-1' };
  };
}

describe('CHAIN: billing reminder → marker → idempotency', () => {
  const createdTenantIds: string[] = [];

  async function seedProTenant(endsAtOffsetDays: number): Promise<{ tenantId: string; ownerEmail: string; startsAt: number; endsAt: number }> {
    const owner = await makeOwner({
      subscription: { planName: 'pro', status: 'active' },
    });
    createdTenantIds.push(owner.tenantId);
    const now = Date.now();
    const endsAt = now + endsAtOffsetDays * DAY_MS;
    const startsAt = endsAt - 30 * DAY_MS;
    await db.update(tenantSubscriptions)
      .set({ startsAt, endsAt })
      .where(eq(tenantSubscriptions.tenantId, owner.tenantId));
    const ownerUser = await db.select().from(users)
      .where(and(eq(users.tenantId, owner.tenantId), eq(users.role, 'owner'))).get();
    return { tenantId: owner.tenantId, ownerEmail: ownerUser!.email, startsAt, endsAt };
  }

  afterAll(async () => {
    for (const id of createdTenantIds) {
      await db.delete(billingReminderSends).where(eq(billingReminderSends.tenantId, id)).catch(() => {});
      await deleteTenantCascade(id);
    }
  });

  it('happy path: renewal_3d notice sends once; the second run is a no-op', async () => {
    const t = await seedProTenant(3); // inside the T-3d window
    const { runOnce } = await import('../../server/cron/billingReminders');

    const capture: CapturedSend[] = [];
    const sent = await runOnce({ now: Date.now(), notifyFn: makeNotify(capture) });
    expect(sent).toBeGreaterThanOrEqual(1);
    expect(capture.some((c) => c.email === t.ownerEmail && c.template.startsWith('billing_renewal_3d'))).toBe(true);

    // Marker row proves the send for this (tenant, stage, cycle).
    const marker = await db.select().from(billingReminderSends).where(and(
      eq(billingReminderSends.tenantId, t.tenantId),
      eq(billingReminderSends.stage, 'renewal_3d'),
      eq(billingReminderSends.cycleStart, t.startsAt),
    )).get();
    expect(marker).toBeTruthy();
    expect(marker!.channel).toBe('email');

    // Idempotency: a second pass in the same window sends nothing new.
    const capture2: CapturedSend[] = [];
    const sent2 = await runOnce({ now: Date.now(), notifyFn: makeNotify(capture2) });
    expect(capture2.some((c) => c.email === t.ownerEmail)).toBe(false);
    void sent2;
  });

  it('failure mode: failed send rolls the marker back so the next run retries', async () => {
    const t = await seedProTenant(0); // renewal_due window
    const { runOnce } = await import('../../server/cron/billingReminders');

    // First pass: dispatch throws AFTER the marker insert → marker deleted.
    const failedPass = await runOnce({ now: Date.now(), notifyFn: makeNotify([], 999) });
    expect(failedPass).toBe(0);
    const markerAfterFail = await db.select().from(billingReminderSends).where(and(
      eq(billingReminderSends.tenantId, t.tenantId),
      eq(billingReminderSends.stage, 'renewal_due'),
    )).get();
    expect(markerAfterFail ?? null).toBeNull(); // rolled back, stage retryable

    // Second pass: send succeeds → marker lands.
    const capture: CapturedSend[] = [];
    await runOnce({ now: Date.now(), notifyFn: makeNotify(capture) });
    expect(capture.some((c) => c.email === t.ownerEmail && c.template === 'billing_renewal_due')).toBe(true);
    const marker = await db.select().from(billingReminderSends).where(and(
      eq(billingReminderSends.tenantId, t.tenantId),
      eq(billingReminderSends.stage, 'renewal_due'),
      eq(billingReminderSends.cycleStart, t.startsAt),
    )).get();
    expect(marker).toBeTruthy();
  });
});
