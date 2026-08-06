/**
 * Local Buying Intent — backend tests.
 *
 * Verifies:
 *   1. POST /api/public/intent records a row (and validates payloads).
 *   2. GET /discover fires a fire-and-forget intent signal.
 *   3. The aggregation cron groups by (category, city), only triggers SMS when
 *      the group exceeds the threshold (>5), and only alerts Pro tenants.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { eq, and } from 'drizzle-orm';

import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants, users, plans, tenantSubscriptions, searchIntent, proAlerts,
} from '../../src/db/schema';

import { runOnce as runAggregate } from '../cron/aggregateIntent';
import type { SmsOptions } from '../lib/sms';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 0, 15, 9, 0, 0);

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

function tokenFor(uid: string, tid: string, role: string, secret: string): string {
  return require('jsonwebtoken').sign({ userId: uid, tenantId: tid, role, tokenVersion: 0 }, secret, { expiresIn: '15m' });
}

describe('Local Buying Intent', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';
  const slug = `intent-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  let tenantId: string;
  let ownerId: string;
  let token: string;
  let proPlanId: string;

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    ownerId = crypto.randomUUID();
    const phone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;

    await db.insert(tenants).values({
      id: tenantId, name: 'Intent Salon', slug,
      category: 'salon',
      settings: { city: 'Bole' },
      createdAt: NOW,
    });
    await db.insert(users).values({
      id: ownerId, tenantId, name: 'Owner', phone,
      email: `${slug}@egebeya.test`,
      passwordHash: await bcrypt.hash('pass', 8),
      role: 'owner', createdAt: NOW,
    });

    proPlanId = (await db.select().from(plans).where(eq(plans.name, 'pro')).get())!.id;
    await db.insert(tenantSubscriptions).values({
      id: crypto.randomUUID(), tenantId, planId: proPlanId, status: 'active', startsAt: NOW,
    });

    token = tokenFor(ownerId, tenantId, 'owner', JWT_SECRET);
  });

  // Clean the signal + alert tables before each test so fire-and-forget rows
  // from the /discover tests never leak into the aggregation assertions.
  beforeEach(async () => {
    await db.delete(proAlerts);
    await db.delete(searchIntent);
  });

  afterAll(async () => {
    await db.delete(proAlerts);
    await db.delete(searchIntent);
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId));
    await db.delete(users).where(eq(users.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  // ── 1. Intent recording ────────────────────────────────────────────

  it('POST /api/public/intent records an intent row', async () => {
    const before = (await db.select().from(searchIntent).all()).length;

    const res = await request(app)
      .post('/api/public/intent')
      .send({ category: 'salon', city: 'Bole', action: 'search' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const rows = await db.select().from(searchIntent).all();
    expect(rows.length).toBe(before + 1);
    expect(rows.find((r) => r.category === 'salon' && r.city === 'Bole')).toBeDefined();
    expect(rows[0].action).toBe('search');
  });

  it('rejects an invalid action with 422', async () => {
    const res = await request(app)
      .post('/api/public/intent')
      .send({ category: 'salon', action: 'click' });
    expect(res.status).toBe(422);
  });

  // ── 2. Discover fires intent fire-and-forget ───────────────────────

  it('GET /discover with a category filter fires a search intent', async () => {
    const before = (await db.select().from(searchIntent).all()).length;

    const res = await request(app).get('/api/public/discover?category=salon');
    expect(res.status).toBe(200);

    // Fire-and-forget: give the async insert a tick to land.
    await new Promise((r) => setTimeout(r, 50));

    const after = (await db.select().from(searchIntent).all()).length;
    expect(after).toBe(before + 1);
  });

  it('GET /discover without filters fires a view intent', async () => {
    const before = (await db.select().from(searchIntent).all()).length;

    const res = await request(app).get('/api/public/discover');
    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 50));

    const after = (await db.select().from(searchIntent).all()).length;
    expect(after).toBe(before + 1);
  });

  // ── 3. Aggregation cron ────────────────────────────────────────────

  it('aggregates intent, triggers SMS only above threshold, alerts only Pro tenants', async () => {
    // Seed 7 "salon in Bole" signals this window — above the >5 threshold.
    for (let i = 0; i < 7; i++) {
      await db.insert(searchIntent).values({
        id: crypto.randomUUID(),
        category: 'salon',
        city: 'Bole',
        action: 'search',
        createdAt: NOW - 1000 * i,
      });
    }
    // Seed only 3 "spa in Bole" — below threshold, should NOT trigger.
    for (let i = 0; i < 3; i++) {
      await db.insert(searchIntent).values({
        id: crypto.randomUUID(),
        category: 'spa',
        city: 'Bole',
        action: 'search',
        createdAt: NOW - 1000 * i,
      });
    }

    const sent: string[] = [];
    const sendSmsFn = vi.fn(async (opts: SmsOptions) => {
      sent.push(opts.text);
      return { success: true };
    });

    const alerted = await runAggregate({
      now: NOW,
      threshold: 5,
      throttleMs: 0,
      sendSmsFn,
    });

    // Only the salon-in-Bole pulse fires; it alerts our 1 Pro tenant.
    expect(alerted).toBe(1);
    expect(sent.length).toBe(1);
    expect(sent[0]).toContain('7 customers');
    expect(sent[0]).toContain('Bole');
    expect(sent[0]).toContain('salon');

    // A pro_alert row was inserted for the tenant.
    const alerts = await db.select().from(proAlerts)
      .where(eq(proAlerts.tenantId, tenantId))
      .all();
    expect(alerts.length).toBe(1);
    expect(alerts[0].category).toBe('salon');
    expect(alerts[0].actionCount).toBe(7);
  });

  it('does NOT alert a Free-plan tenant even when demand is high', async () => {
    // Seed HIGH demand for salon-in-Bole so a pulse definitely fires — this
    // makes the test non-trivial (it would alert any Pro tenant in Bole/salon).
    for (let i = 0; i < 8; i++) {
      await db.insert(searchIntent).values({
        id: crypto.randomUUID(),
        category: 'salon',
        city: 'Bole',
        action: 'search',
        createdAt: NOW - 1000 * i,
      });
    }

    const freeId = crypto.randomUUID();
    const slugF = `intent-free-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
    await db.insert(tenants).values({
      id: freeId, name: 'Free Salon', slug: slugF,
      category: 'salon', settings: { city: 'Bole' }, createdAt: NOW,
    });
    const freePlanId = (await db.select().from(plans).where(eq(plans.name, 'free')).get())!.id;
    await db.insert(tenantSubscriptions).values({
      id: crypto.randomUUID(), tenantId: freeId, planId: freePlanId, status: 'active', startsAt: NOW,
    });

    const sendSmsFn = vi.fn(async () => ({ success: true }));
    const alerted = await runAggregate({ now: NOW, threshold: 5, throttleMs: 0, sendSmsFn });

    // The Pro tenant (tenantId, salon/Bole) IS alerted by this pulse...
    const proAlertRows = await db.select().from(proAlerts)
      .where(eq(proAlerts.tenantId, tenantId))
      .all();
    expect(proAlertRows.length).toBeGreaterThanOrEqual(1);

    // ...but the Free-plan tenant is NOT, despite matching city + category.
    const freeAlerts = await db.select().from(proAlerts)
      .where(eq(proAlerts.tenantId, freeId))
      .all();
    expect(freeAlerts.length).toBe(0);

    await db.delete(proAlerts).where(eq(proAlerts.tenantId, freeId));
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, freeId));
    await db.delete(tenants).where(eq(tenants.id, freeId));
  });
});
