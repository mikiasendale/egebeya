import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants, users, tenantSubscriptions, plans, pages, appointments, services, staff,
} from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

function makeToken(payload: any): string {
  return jwt.sign({ ...payload, tokenVersion: 0 }, JWT_SECRET, { expiresIn: '1h' });
}

function authHeader(user: any): Record<string, string> {
  return { Authorization: `Bearer ${makeToken(user)}` };
}

const RESERVED = new Set([
  'egebeya.et', 'egebeya.test', 'egebeya.com',
  'example.com', 'example.org', 'example.net',
  'localhost',
]);

function reservedSuffix(domain: string): boolean {
  const suffix = domain.split('.').slice(-2).join('.');
  return RESERVED.has(suffix) || RESERVED.has(domain);
}

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

describe('Custom domain (WP3.2)', () => {
  let proTenantId: string;
  let proUserId: string;
  const proSlug = `dom-pro-${Date.now()}`;

  let freeTenantId: string;
  let freeUserId: string;
  let freeOwnerToken: string;
  const freeSlug = `dom-free-${Date.now()}`;

  let customDomain: string;

  beforeAll(async () => {
    proTenantId = crypto.randomUUID();
    proUserId = crypto.randomUUID();
    freeTenantId = crypto.randomUUID();
    freeUserId = crypto.randomUUID();

    const [freePlan, proPlan] = await Promise.all([
      db.select().from(plans).where(eq(plans.name, 'free')).get(),
      db.select().from(plans).where(eq(plans.name, 'pro')).get(),
    ]);

    const pwHash = await bcrypt.hash('pass1234', 10);
    const now = Date.now();

    await Promise.all([
      db.insert(tenants).values({ id: proTenantId, name: 'Domain Pro', slug: proSlug, createdAt: now }),
      db.insert(tenants).values({ id: freeTenantId, name: 'Domain Free', slug: freeSlug, createdAt: now }),
      db.insert(users).values({ id: proUserId, tenantId: proTenantId, name: 'Pro Owner', phone: `+25170000001`, email: `pro-${now}@test.com`, passwordHash: pwHash, role: 'owner', createdAt: now }),
      db.insert(users).values({ id: freeUserId, tenantId: freeTenantId, name: 'Free Owner', phone: `+25170000002`, email: `free-${now}@test.com`, passwordHash: pwHash, role: 'owner', createdAt: now }),
    ]);

    if (proPlan) {
      await db.insert(tenantSubscriptions).values({ id: crypto.randomUUID(), tenantId: proTenantId, planId: proPlan.id, status: 'active', startsAt: now });
    }
    if (freePlan) {
      await db.insert(tenantSubscriptions).values({ id: crypto.randomUUID(), tenantId: freeTenantId, planId: freePlan.id, status: 'active', startsAt: now });
      freeOwnerToken = makeToken({ userId: freeUserId, tenantId: freeTenantId, role: 'owner' });
    }

    customDomain = `salon-${Date.now()}.example.co`;
  });

  afterAll(async () => {
    await db.delete(appointments).where(eq(appointments.tenantId, proTenantId)).catch(() => {});
    await db.delete(appointments).where(eq(appointments.tenantId, freeTenantId)).catch(() => {});
    await db.delete(services).where(eq(services.tenantId, proTenantId)).catch(() => {});
    await db.delete(services).where(eq(services.tenantId, freeTenantId)).catch(() => {});
    await db.delete(pages).where(eq(pages.tenantId, proTenantId)).catch(() => {});
    await db.delete(pages).where(eq(pages.tenantId, freeTenantId)).catch(() => {});
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, proTenantId)).catch(() => {});
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, freeTenantId)).catch(() => {});
    await db.delete(users).where(eq(users.id, proUserId)).catch(() => {});
    await db.delete(users).where(eq(users.id, freeUserId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, proTenantId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, freeTenantId)).catch(() => {});
  });

  it('Pro: sets a valid custom domain via PUT /api/tenant/domain', async () => {
    const res = await request(app)
      .put('/api/tenant/domain')
      .set(authHeader({ userId: proUserId, tenantId: proTenantId, role: 'owner' }))
      .send({ domain: customDomain });

    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    expect(res.body.domain).toBe(customDomain.toLowerCase());

    const t = await db.select().from(tenants).where(eq(tenants.id, proTenantId)).get();
    expect(t?.domain).toBe(customDomain.toLowerCase());
  });

  it('Rejects an invalid domain format → 400', async () => {
    const res = await request(app)
      .put('/api/tenant/domain')
      .set(authHeader({ userId: proUserId, tenantId: proTenantId, role: 'owner' }))
      .send({ domain: 'not a domain!!' });

    expect(res.status).toBe(400);
  });

  it('Rejects a reserved domain suffix → 400', async () => {
    const res = await request(app)
      .put('/api/tenant/domain')
      .set(authHeader({ userId: proUserId, tenantId: proTenantId, role: 'owner' }))
      .send({ domain: 'mybusiness.egebeya.et' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reserved/i);
  });

  it('Non-Pro tenant is rejected → 403', async () => {
    const res = await request(app)
      .put('/api/tenant/domain')
      .set({ Authorization: `Bearer ${freeOwnerToken}` })
      .send({ domain: 'free-domain.example.com' });

    expect(res.status).toBe(403);
  });

  it('GET /api/public/page with Host header resolves the tenant by custom domain', async () => {
    // Ensure a page exists so /page doesn't 404 for unrelated reasons
    await db.insert(pages).values({ tenantId: proTenantId, content: { content: [], blocks: [] } })
      .catch(() => {});

    const res = await request(app)
      .get('/api/public/page')
      .set('Host', customDomain);

    expect(res.status).toBe(200);
    expect(res.body.tenant?.slug).toBe(proSlug);
  });

  it('Subdomain fallback still works (no custom domain set, Host: <slug>.egebeya.test)', async () => {
    const res = await request(app)
      .get('/api/public/page')
      .set('Host', `${proSlug}.egebeya.test`);

    expect(res.status).toBe(200);
    expect(res.body.tenant?.slug).toBe(proSlug);
  });

  it('Clears custom domain when passed an empty string', async () => {
    const res = await request(app)
      .put('/api/tenant/domain')
      .set(authHeader({ userId: proUserId, tenantId: proTenantId, role: 'owner' }))
      .send({ domain: '' });

    expect(res.status).toBe(200);
    expect(res.body.domain).toBeNull();

    const t = await db.select().from(tenants).where(eq(tenants.id, proTenantId)).get();
    expect(t?.domain).toBeNull();
  });
});
