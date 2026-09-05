/**
 * Wayfinder #13/#18 — AI consent gate (Apple 5.1.2(i)).
 *
 * No AI endpoint may transmit data to a third-party provider before the
 * owner has recorded explicit consent (settings JSON `aiConsentAt`).
 * Covers: gate behavior on all three AI endpoints, the consent read/write
 * endpoints, and one-record-unlocks-all (Q1 decision).
 */
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import { tenants, users, tenantSubscriptions, plans, aiUsage } from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { cookieValue } from './helpers';
import crypto from 'crypto';

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

const suffix = Date.now();
const ownerPhone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
const ownerEmail = `ai-consent-${suffix}@egebeya.test`;
const slug = `ai-consent-${suffix}`;

let ownerToken = '';
let tenantId = '';

afterAll(async () => {
  try {
    if (tenantId) {
      await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId));
      await db.delete(users).where(eq(users.tenantId, tenantId));
      await db.delete(tenants).where(eq(tenants.id, tenantId));
    }
  } catch {
    // best-effort
  }
});

describe('AI consent gate (POST /api/tenant/ai/consent)', () => {
  it('registers a fresh owner (no consent recorded)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'AI Consent Tester',
      phone: ownerPhone,
      password: 'SecurePass456!',
      businessName: 'AI Consent Biz',
      slug,
      email: ownerEmail,
      consent: true,
    });
    expect(res.status).toBe(200);
    ownerToken = cookieValue(res, 'accessToken') ?? '';
    tenantId = res.body.tenant.id;
    expect(ownerToken).toBeTruthy();
  });

  it('blocks generate-description with AI_CONSENT_REQUIRED before consent', async () => {
    const res = await request(app).post('/api/tenant/ai/generate-description')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ businessName: 'Biz', category: 'salon', services: ['Cut'] });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AI_CONSENT_REQUIRED');
  });

  it('blocks marketing-snippet with AI_CONSENT_REQUIRED before consent', async () => {
    const res = await request(app).post('/api/tenant/ai/marketing-snippet')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ businessName: 'Biz', category: 'salon', services: ['Cut'] });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AI_CONSENT_REQUIRED');
  });

  it('blocks site/ai-chat with AI_CONSENT_REQUIRED before consent (before plan gate)', async () => {
    const res = await request(app).post('/api/tenant/site/ai-chat')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ messages: [{ role: 'user', parts: [{ text: 'hello' }] }] });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AI_CONSENT_REQUIRED');
  });

  it('reports unconsented via GET /ai/consent', async () => {
    const res = await request(app).get('/api/tenant/ai/consent')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.consentedAt).toBeNull();
  });

  it('records consent and unlocks all AI endpoints (one consent covers all)', async () => {
    const post = await request(app).post('/api/tenant/ai/consent')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ accept: true });
    expect(post.status).toBe(200);
    expect(typeof post.body.consentedAt).toBe('number');

    const state = await request(app).get('/api/tenant/ai/consent')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(state.body.consentedAt).toBe(post.body.consentedAt);

    // Settings JSON flag persisted (decision Q2).
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    expect(typeof (tenant!.settings as any)?.aiConsentAt).toBe('number');

    // The gate now passes — the request proceeds past consent. A fresh
    // registrant is on Free, so the NEXT gate (plan) fires instead: the error
    // code changes from AI_CONSENT_REQUIRED to PLAN_REQUIRED, proving consent
    // no longer blocks. (Without GEMINI_API_KEY a Pro tenant would get the
    // generator's static 200 fallback.)
    const gen = await request(app).post('/api/tenant/ai/generate-description')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ businessName: 'Biz', category: 'salon', services: ['Cut'] });
    expect(gen.status).toBe(403);
    expect(gen.body.code).toBe('PLAN_REQUIRED');
  });

  it('rejects consent endpoints for unauthenticated callers', async () => {
    const get = await request(app).get('/api/tenant/ai/consent');
    expect(get.status).toBe(401);
    const post = await request(app).post('/api/tenant/ai/consent').send({ accept: true });
    expect(post.status).toBe(401);
  });
});

/**
 * S-7 — persistent AI daily limiter (replaces the in-memory Map).
 *
 * Counters live in the ai_usage SQLite table (UNIQUE tenant_id + day),
 * so they survive restarts and are correct across processes.
 */
describe('AI daily limiter (S-7)', () => {
  const limiterSuffix = Date.now();
  const limiterOwnerPhone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  const limiterOwnerEmail = `ai-lim-${limiterSuffix}@egebeya.test`;
  const limiterSlug = `ai-lim-${limiterSuffix}`;
  let limiterToken = '';
  let limiterTenantId = '';

  afterAll(async () => {
    if (limiterTenantId) {
      await db.delete(aiUsage).where(eq(aiUsage.tenantId, limiterTenantId)).catch(() => {});
      await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, limiterTenantId)).catch(() => {});
      await db.delete(users).where(eq(users.tenantId, limiterTenantId)).catch(() => {});
      await db.delete(tenants).where(eq(tenants.id, limiterTenantId)).catch(() => {});
    }
  });

  it('creates a Pro tenant with consent', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'AI Limiter Tester',
      phone: limiterOwnerPhone,
      password: 'SecurePass456!',
      businessName: 'AI Limiter Biz',
      slug: limiterSlug,
      email: limiterOwnerEmail,
      consent: true,
    });
    expect(res.status).toBe(200);
    limiterToken = cookieValue(res, 'accessToken') ?? '';
    limiterTenantId = res.body.tenant.id;
    expect(limiterToken).toBeTruthy();
    // Upgrade to Pro (register seeds a Free subscription).
    const proPlan = await db.select().from(plans).where(eq(plans.name, 'pro')).get();
    await db.update(tenantSubscriptions).set({ planId: proPlan!.id, status: 'active', startsAt: Date.now() - 86400_000 })
      .where(eq(tenantSubscriptions.tenantId, limiterTenantId));
    await db.insert(users).values({
      id: crypto.randomUUID(), tenantId: limiterTenantId, name: 'Owner',
      phone: limiterOwnerPhone, email: limiterOwnerEmail,
      passwordHash: await require('bcryptjs').hash('SecurePass456!', 10),
      role: 'owner', createdAt: Date.now(),
    }).onConflictDoNothing();
    // Verify Pro is active.
    const sub = await db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, limiterTenantId)).get();
    const plan = await db.select().from(plans).where(eq(plans.id, sub!.planId)).get();
    expect(plan!.name).toBe('pro');
    // Record tenant-level AI consent (register only sets user consentGivenAt).
    const consentRes = await request(app).post('/api/tenant/ai/consent')
      .set('Authorization', `Bearer ${limiterToken}`)
      .send({ accept: true });
    expect(consentRes.status).toBe(200);
  });

  it('allows up to DAILY_AI_LIMIT (20) requests', async () => {
    const body = { messages: [{ role: 'user', parts: [{ text: 'hello' }] }] };
    // Drain any pre-existing counter for today.
    const today = new Date().toISOString().slice(0, 10);
    await db.delete(aiUsage).where(and(eq(aiUsage.tenantId, limiterTenantId), eq(aiUsage.day, today))).catch(() => {});
    for (let i = 0; i < 20; i++) {
      const res = await request(app).post('/api/tenant/site/ai-chat')
        .set('Authorization', `Bearer ${limiterToken}`)
        .send(body);
      // Any status except 429 proves the request passed the limiter. 200/502 =
      // provider answered (or errored) when OPENROUTER_API_KEY is set; 500 is
      // the documented env-gated outcome when the key is unset (CI runs have no
      // OPENROUTER_API_KEY); 403 would mean the Pro gate misfired.
      expect([200, 403, 500, 502]).toContain(res.status);
    }
    // 21st should be rate-limited.
    const res = await request(app).post('/api/tenant/site/ai-chat')
      .set('Authorization', `Bearer ${limiterToken}`)
      .send(body);
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('AI_RATE_LIMITED');
  });

  it('counter persists in ai_usage table', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const row = await db.select().from(aiUsage).where(and(eq(aiUsage.tenantId, limiterTenantId), eq(aiUsage.day, today))).get();
    expect(row).toBeTruthy();
    expect(row!.count).toBe(20);
  });

  it('429 response shape includes remaining: 0', async () => {
    const res = await request(app).post('/api/tenant/site/ai-chat')
      .set('Authorization', `Bearer ${limiterToken}`)
      .send({ messages: [{ role: 'user', parts: [{ text: 'hello' }] }] });
    expect(res.status).toBe(429);
    expect(res.body.remaining).toBe(0);
    expect(res.body.error).toContain('20/day');
  });
});
