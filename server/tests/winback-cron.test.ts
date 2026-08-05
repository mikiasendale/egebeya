/**
 * Automated Win-Bac Automations — cron tests.
 *
 * Verifies the VPS-safe contract:
 *   1. Only inactive (>30 days), automation_state='active', Pro-subscription
 *      customers are messaged.
 *   2. Exactly the eligible count of API calls are made.
 *   3. Each sent customer flips to `winback_sent` + gets a timestamp.
 *   4. A second run sends nothing (idempotency).
 *   5. The candidate query carries a LIMIT (chunking to protect VPS RAM).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'crypto';

import { db } from '../../src/db';
import {
  tenants, users, customerStats, plans, tenantSubscriptions, promoCodes,
} from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

import { runOnce } from '../cron/runWinbackAutomations';
import type { SmsOptions } from '../lib/sms';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 0, 15, 9, 0, 0); // fixed clock for determinism

describe('runWinbackAutomations cron', () => {
  const slug = `winback-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  let tenantId: string;
  let proPlanId: string;
  let freePlanId: string;

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    const phone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;

    await db.insert(tenants).values({
      id: tenantId, name: 'Winback Salon', slug,
      settings: {}, createdAt: Date.now(),
    });
    const ownerId = crypto.randomUUID();
    await db.insert(users).values({
      id: ownerId, tenantId, name: 'Owner', phone,
      email: `${slug}@egebeya.test`,
      passwordHash: await bcrypt.hash('pass', 8),
      role: 'owner', createdAt: Date.now(),
    });

    proPlanId = (await db.select().from(plans).where(eq(plans.name, 'pro')).get())!.id;
    freePlanId = (await db.select().from(plans).where(eq(plans.name, 'free')).get())!.id;
    await db.insert(tenantSubscriptions).values({
      id: crypto.randomUUID(), tenantId, planId: proPlanId, status: 'active', startsAt: NOW,
    });

    // 100 customers: 40 inactive >30 days, 60 recent.
    for (let i = 0; i < 100; i++) {
      const inactive = i < 40;
      const lastVisit = inactive
        ? NOW - 45 * DAY_MS   // 45 days ago → eligible
        : NOW - 5 * DAY_MS;   // 5 days ago → not eligible
      await db.insert(customerStats).values({
        tenantId,
        customerPhone: `+2519${String(i).padStart(9, '0')}`,
        customerName: `Customer ${i}`,
        firstVisitAt: lastVisit,
        lastVisitAt: lastVisit,
        visitCount: 3,
        createdAt: NOW,
      });
    }
  });

  afterAll(async () => {
    await db.delete(promoCodes).where(eq(promoCodes.tenantId, tenantId));
    await db.delete(customerStats).where(eq(customerStats.tenantId, tenantId));
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId));
    await db.delete(users).where(eq(users.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('messages exactly the eligible customers (40) and no others', async () => {
    const sentPhones: string[] = [];
    const sendSmsFn = vi.fn(async (opts: SmsOptions) => {
      sentPhones.push(opts.to);
      return { success: true };
    });

    const count = await runOnce({ now: NOW, chunkSize: 50, throttleMs: 0, sendSmsFn });

    expect(count).toBe(40);
    expect(sendSmsFn).toHaveBeenCalledTimes(40);

    // Every sent phone belongs to the inactive cohort (phone number encodes i<40).
    for (const phone of sentPhones) {
      const idx = Number(phone.replace('+2519', ''));
      expect(idx).toBeLessThan(40);
    }
  });

  it('flips each sent customer to winback_sent with a timestamp', async () => {
    const rows = await db.select().from(customerStats)
      .where(eq(customerStats.tenantId, tenantId))
      .all();

    const inactive = rows.filter((r) => Number(r.customerPhone.replace('+2519', '')) < 40);
    const recent = rows.filter((r) => Number(r.customerPhone.replace('+2519', '')) >= 40);

    for (const r of inactive) {
      expect(r.automationState).toBe('winback_sent');
      expect(r.lastAutomationSentAt).toBe(NOW);
    }
    // The recent cohort is untouched.
    for (const r of recent) {
      expect(r.automationState).toBe('active');
      expect(r.lastAutomationSentAt).toBeNull();
    }
  });

  it('is idempotent — a second run sends nothing', async () => {
    const sendSmsFn = vi.fn(async () => ({ success: true }));
    const count = await runOnce({ now: NOW, chunkSize: 50, throttleMs: 0, sendSmsFn });

    expect(count).toBe(0);
    expect(sendSmsFn).not.toHaveBeenCalled();
  });

  it('carries a LIMIT in the candidate query (VPS chunking)', async () => {
    // Override chunkSize to a small value; only that many eligible rows (still
    // in 'active' state) may be returned. To isolate LIMIT from the
    // winback_sent flip, we assert via the module's behavior: a fresh tenant
    // with 60 eligible customers and chunkSize=50 yields exactly 50 sends.
    const t2Id = crypto.randomUUID();
    const slug2 = `wb-limit-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
    await db.insert(tenants).values({
      id: t2Id, name: 'Limit Test', slug: slug2, settings: {}, createdAt: NOW,
    });
    await db.insert(tenantSubscriptions).values({
      id: crypto.randomUUID(), tenantId: t2Id, planId: proPlanId, status: 'active', startsAt: NOW,
    });
    for (let i = 0; i < 60; i++) {
      await db.insert(customerStats).values({
        tenantId: t2Id,
        customerPhone: `+2517${String(i).padStart(9, '0')}`,
        customerName: `Limit ${i}`,
        lastVisitAt: NOW - 40 * DAY_MS,
        visitCount: 2,
        createdAt: NOW,
      });
    }

    const sendSmsFn = vi.fn(async () => ({ success: true }));
    const count = await runOnce({ now: NOW, chunkSize: 50, throttleMs: 0, sendSmsFn });

    // LIMIT 50 caps the chunk even though 60 are eligible.
    expect(count).toBe(50);
    expect(sendSmsFn).toHaveBeenCalledTimes(50);

    await db.delete(promoCodes).where(eq(promoCodes.tenantId, t2Id));
    await db.delete(customerStats).where(eq(customerStats.tenantId, t2Id));
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, t2Id));
    await db.delete(tenants).where(eq(tenants.id, t2Id));
  });

  it('skips customers on a Free-plan tenant', async () => {
    const freeId = crypto.randomUUID();
    const slugF = `wb-free-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
    await db.insert(tenants).values({
      id: freeId, name: 'Free Salon', slug: slugF, settings: {}, createdAt: NOW,
    });
    await db.insert(tenantSubscriptions).values({
      id: crypto.randomUUID(), tenantId: freeId, planId: freePlanId, status: 'active', startsAt: NOW,
    });
    for (let i = 0; i < 10; i++) {
      await db.insert(customerStats).values({
        tenantId: freeId,
        customerPhone: `+2516${String(i).padStart(9, '0')}`,
        customerName: `Free ${i}`,
        lastVisitAt: NOW - 50 * DAY_MS,
        visitCount: 2,
        createdAt: NOW,
      });
    }

    const sendSmsFn = vi.fn(async () => ({ success: true }));
    const count = await runOnce({ now: NOW, chunkSize: 50, throttleMs: 0, sendSmsFn });

    // Free-plan tenant's customers are never messaged.
    expect(count).toBe(0);
    expect(sendSmsFn).not.toHaveBeenCalled();

    await db.delete(customerStats).where(eq(customerStats.tenantId, freeId));
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, freeId));
    await db.delete(tenants).where(eq(tenants.id, freeId));
  });
});
