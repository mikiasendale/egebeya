/**
 * AI-generated marketing snippet (Feature B): a Pro-gated,
 * locale-aware social-media post generator.
 *
 * Covers:
 *   1. A Free tenant is rejected with 403 (PLAN_REQUIRED).
 *   2. A Pro tenant gets a 200 response with a non-empty snippet containing
 *      the business name.
 *   3. When GEMINI_API_KEY is missing the static fallback is returned (no
 *      network) and never throws.
 *   4. An Amharic (am) locale returns Amharic (Ethiopic-range) text.
 *
 * The marketing generator reads GEMINI_API_KEY at module load; in the test
 * environment the key is unset, so every call exercises the static fallback
 * — which is exactly the "no key" behavior required.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';

import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import { tenants, users, plans, tenantSubscriptions } from '../../src/db/schema';
import { activateProSubscription } from '../../server/lib/billing';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

function tokenFor(userId: string, tenantId: string, role = 'owner'): string {
  return jwt.sign({ userId, tenantId, role, tokenVersion: 0 }, JWT_SECRET, { expiresIn: '15m' });
}

// A char is "Ethiopic" if it falls in the Unicode Ethiopic block.
function isAmharic(text: string): boolean {
  return Array.from(text).some((ch) => {
    const cp = ch.codePointAt(0)!;
    return cp >= 0x1200 && cp <= 0x137f;
  });
}

describe('AI marketing snippet (Feature B)', () => {
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;

  const freeTenant = {
    id: crypto.randomUUID(), slug: `aimkt-free-${suffix}`, userId: crypto.randomUUID(),
  };
  const proTenant = {
    id: crypto.randomUUID(), slug: `aimkt-pro-${suffix}`, userId: crypto.randomUUID(),
  };

  let freePlanId: string;
  let proPlanId: string;
  let freeToken: string;
  let proToken: string;

  beforeAll(async () => {
    // Ensure this exact "missing key" scenario is in place for the fallback
    // assertions below.
    delete process.env.GEMINI_API_KEY;

    freePlanId = (await db.select().from(plans).where(eq(plans.name, 'free')).get())!.id;
    proPlanId = (await db.select().from(plans).where(eq(plans.name, 'pro')).get())!.id;

    const makeTenant = async (t: typeof freeTenant, name: string, emailSeed: string) => {
      await db.insert(tenants).values({
        id: t.id, name, slug: t.slug, settings: {}, createdAt: Date.now(),
      });
      await db.insert(users).values({
        id: t.userId, tenantId: t.id, name, phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
        email: emailSeed, passwordHash: await bcrypt.hash('pass1234', 10),
        role: 'owner', createdAt: Date.now(),
      });
      await db.insert(tenantSubscriptions).values({
        id: crypto.randomUUID(), tenantId: t.id, planId: freePlanId,
        status: 'active', startsAt: Date.now(),
      });
    };

    await makeTenant(freeTenant, 'Free Salon', `aimkt-free-${suffix}@egebeya.test`);
    await makeTenant(proTenant, 'Pro Salon', `aimkt-pro-${suffix}@egebeya.test`);
    await activateProSubscription(proTenant.id, proPlanId, Date.now());

    freeToken = tokenFor(freeTenant.userId, freeTenant.id);
    proToken = tokenFor(proTenant.userId, proTenant.id);
  });

  afterAll(async () => {
    for (const t of [freeTenant, proTenant]) {
      await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, t.id));
      await db.delete(users).where(eq(users.tenantId, t.id));
      await db.delete(tenants).where(eq(tenants.id, t.id));
    }
  });

  const body = {
    businessName: 'Aurora Beauty Spa',
    category: 'beauty salon',
    services: ['braids', 'manicure', 'facial'],
    locale: 'en',
  };

  it('rejects a Free-lan tenant with 403 PLAN_REQUIRED', async () => {
    const res = await request(app)
      .post('/api/tenant/ai/marketing-snippet')
      .set('Authorization', `Bearer ${freeToken}`)
      .send(body);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_REQUIRED');
  });

  it('returns a marketing snippet for a Pro tenant', async () => {
    const res = await request(app)
      .post('/api/tenant/ai/marketing-snippet')
      .set('Authorization', `Bearer ${proToken}`)
      .send({ ...body, businessName: 'Aurora Beauty Spa' });
    expect(res.status).toBe(200);
    expect(typeof res.body.snippet).toBe('string');
    expect(res.body.snippet.length).toBeGreaterThan(0);
    expect(res.body.locale).toBe('en');
    expect(res.body.snippet).toContain('Aurora Beauty Spa');
  });

  it('falls back to static text when GEMINI_API_KEY is missing', async () => {
    // Key is explicitly deleted in beforeAll; the generator must still
    // succeed with the deterministic local fallback rather than throwing or
    // hitting the network.
    const res = await request(app)
      .post('/api/tenant/ai/marketing-snippet')
      .set('Authorization', `Bearer ${proToken}`)
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.snippet).toContain('Aurora Beauty Spa');
    expect(res.body.snippet).toMatch(/your go-to/i);
  });

  it('returns Amharic text when locale is "am"', async () => {
    const res = await request(app)
      .post('/api/tenant/ai/marketing-snippet')
      .set('Authorization', `Bearer ${proToken}`)
      .send({ ...body, locale: 'am' });
    expect(res.status).toBe(200);
    expect(res.body.locale).toBe('am');
    expect(typeof res.body.snippet).toBe('string');
    expect(isAmharic(res.body.snippet)).toBe(true);
  });

  it('validates required fields', async () => {
    const res = await request(app)
      .post('/api/tenant/ai/marketing-snippet')
      .set('Authorization', `Bearer ${proToken}`)
      .send({ category: 'x', services: [], locale: 'en' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('businessName');
  });
});
