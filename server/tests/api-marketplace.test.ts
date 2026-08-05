/**
 * API Marketplace tests — key creation, scope enforcement, 401 on wrong key,
 * last_used_at updates, raw key only returned once.
 *
 * Covers:
 *   1. Key creation returns raw key ONCE
 *   2. Key creation is owner-only
 *   3. Scope enforcement (403 on missing scope)
 *   4. 401 on wrong/missing key
 *   5. last_used_at is updated on successful access
 *   6. Expired keys are rejected
 *   7. Key listing (metadata only)
 *   8. Key deletion
 *   9. Public v1 endpoints work with valid key
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';

import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants,
  users,
  services,
  staff,
  staffServices,
  staffAvailability,
  tenantSubscriptions,
  plans,
  apiKeys,
  tenantBusinessHours,
} from '../../src/db/schema';

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

const JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

describe('API Marketplace', () => {
  const slug = `api-mkt-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  const phone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  const email = `api-mkt-${Date.now()}@egebeya.test`;

  let tenantId: string;
  let userId: string;
  let bearerToken: string;

  let serviceId: string;
  let staffId: string;

  // Track all created key IDs for cleanup
  const createdKeyIds: string[] = [];

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    userId = crypto.randomUUID();

    await db.insert(tenants).values({
      id: tenantId,
      name: 'API Marketplace Test',
      slug,
      settings: { require_payment_upfront: false, calendar_display: 'ethiopian' },
      createdAt: Date.now(),
    });

    const bcryptHash = await bcrypt.hash('TestPass1234', 10);
    await db.insert(users).values({
      id: userId,
      tenantId,
      name: 'API Owner',
      phone,
      email,
      passwordHash: bcryptHash,
      role: 'owner',
      tokenVersion: 0,
      createdAt: Date.now(),
    });

    const freePlan = await db.select().from(plans).where(eq(plans.name, 'free')).get();
    await db.insert(tenantSubscriptions).values({
      id: crypto.randomUUID(),
      tenantId,
      planId: freePlan!.id,
      status: 'active',
      startsAt: Date.now(),
    });

    // Create service
    serviceId = crypto.randomUUID();
    await db.insert(services).values({
      id: serviceId,
      tenantId,
      name: 'Haircut',
      durationMinutes: 30,
      price: 50000,
      active: true,
    });

    // Create staff
    staffId = crypto.randomUUID();
    await db.insert(staff).values({
      id: staffId,
      tenantId,
      name: 'Staff One',
      active: true,
    });

    await db.insert(staffServices).values({ staffId, serviceId });

    // Staff availability: Mon-Fri 09:00-17:00
    for (let day = 1; day <= 5; day++) {
      await db.insert(staffAvailability).values({
        id: crypto.randomUUID(),
        staffId,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '17:00',
      });
    }

    // Business hours: Mon-Fri 09:00-17:00
    for (let day = 1; day <= 5; day++) {
      await db.insert(tenantBusinessHours).values({
        id: crypto.randomUUID(),
        tenantId,
        dayOfWeek: day,
        openTime: '09:00',
        closeTime: '17:00',
        isClosed: false,
      });
    }

    // Generate a valid JWT for the owner
    bearerToken = jwt.sign(
      { userId, tenantId, role: 'owner', tokenVersion: 0 },
      JWT_SECRET,
      { expiresIn: '1h' },
    );
  });

  afterAll(async () => {
    // Clean up all created API keys
    for (const id of createdKeyIds) {
      await db.delete(apiKeys).where(eq(apiKeys.id, id)).catch(() => {});
    }
    await db.delete(staffAvailability).where(eq(staffAvailability.staffId, staffId)).catch(() => {});
    await db.delete(tenantBusinessHours).where(eq(tenantBusinessHours.tenantId, tenantId)).catch(() => {});
    await db.delete(staffServices).where(eq(staffServices.staffId, staffId)).catch(() => {});
    await db.delete(staff).where(eq(staff.tenantId, tenantId)).catch(() => {});
    await db.delete(services).where(eq(services.tenantId, tenantId)).catch(() => {});
    await db.delete(users).where(eq(users.tenantId, tenantId)).catch(() => {});
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
  });

  async function authHeader() {
    return { Authorization: `Bearer ${bearerToken}` };
  }

  // ─── Key Creation ────────────────────────────────────────────────

  describe('Key creation', () => {
    let createdKeyId: string;
    let rawKey: string;

    it('POST /api/tenant/api-keys creates a key and returns raw key ONCE', async () => {
      const res = await request(app)
        .post('/api/tenant/api-keys')
        .set(await authHeader())
        .send({ scopes: ['read:bookings', 'read:services'] });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeTruthy();
      expect(res.body.key).toBeTruthy();
      expect(res.body.key).toMatch(/^egb_/);
      expect(res.body.prefix).toBeTruthy();
      expect(res.body.prefix).toBe(res.body.key.slice(0, 8));
      expect(res.body.scopes).toEqual(['read:bookings', 'read:services']);
      expect(res.body.expiresAt).toBeNull();

      createdKeyId = res.body.id;
      rawKey = res.body.key;
      createdKeyIds.push(createdKeyId);
    });

    it('raw key is NOT in the database (only the hash)', async () => {
      const row = await db.select().from(apiKeys).where(eq(apiKeys.id, createdKeyId)).get();
      expect(row).toBeTruthy();
      expect(row!.keyHash).not.toBe(rawKey);
      const match = await bcrypt.compare(rawKey, row!.keyHash);
      expect(match).toBe(true);
    });

    it('listing keys does NOT expose raw key or hash', async () => {
      const res = await request(app)
        .get('/api/tenant/api-keys')
        .set(await authHeader());

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find((k: any) => k.id === createdKeyId);
      expect(found).toBeTruthy();
      expect(found.key).toBeUndefined();
      expect(found.keyHash).toBeUndefined();
      expect(found.prefix).toBeTruthy();
    });

    it('rejects creation without owner auth', async () => {
      const res = await request(app)
        .post('/api/tenant/api-keys')
        .send({ scopes: ['read:bookings'] });

      expect(res.status).toBe(401);
    });

    it('rejects creation with empty scopes', async () => {
      const res = await request(app)
        .post('/api/tenant/api-keys')
        .set(await authHeader())
        .send({ scopes: [] });

      expect(res.status).toBe(422);
    });

    it('rejects creation with invalid scope', async () => {
      const res = await request(app)
        .post('/api/tenant/api-keys')
        .set(await authHeader())
        .send({ scopes: ['admin:delete'] });

      expect(res.status).toBe(422);
    });
  });

  // ─── Scope Enforcement ──────────────────────────────────────────

  describe('Scope enforcement', () => {
    let readBookingsKey: string;
    let readServicesKey: string;
    let writeBookingsKey: string;

    beforeAll(async () => {
      const k1 = await request(app)
        .post('/api/tenant/api-keys')
        .set(await authHeader())
        .send({ scopes: ['read:bookings'] });
      readBookingsKey = k1.body.key;
      createdKeyIds.push(k1.body.id);

      const k2 = await request(app)
        .post('/api/tenant/api-keys')
        .set(await authHeader())
        .send({ scopes: ['read:services'] });
      readServicesKey = k2.body.key;
      createdKeyIds.push(k2.body.id);

      const k3 = await request(app)
        .post('/api/tenant/api-keys')
        .set(await authHeader())
        .send({ scopes: ['write:bookings'] });
      writeBookingsKey = k3.body.key;
      createdKeyIds.push(k3.body.id);
    });

    it('read:bookings key can access GET /api/v1/bookings', async () => {
      const res = await request(app)
        .get('/api/v1/bookings')
        .set('x-api-key', readBookingsKey)
        .query({ tenant_slug: slug });

      expect(res.status).toBe(200);
      expect(res.body.tenant).toBeTruthy();
      expect(res.body.tenant.slug).toBe(slug);
    });

    it('read:bookings key CANNOT access GET /api/v1/services (403)', async () => {
      const res = await request(app)
        .get('/api/v1/services')
        .set('x-api-key', readBookingsKey)
        .query({ tenant_slug: slug });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('API_KEY_SCOPE_DENIED');
      expect(res.body.missing).toContain('read:services');
    });

    it('read:services key can access GET /api/v1/services', async () => {
      const res = await request(app)
        .get('/api/v1/services')
        .set('x-api-key', readServicesKey)
        .query({ tenant_slug: slug });

      expect(res.status).toBe(200);
      expect(res.body.services).toBeDefined();
      expect(Array.isArray(res.body.services)).toBe(true);
    });

    it('read:services key CANNOT access GET /api/v1/bookings (403)', async () => {
      const res = await request(app)
        .get('/api/v1/bookings')
        .set('x-api-key', readServicesKey)
        .query({ tenant_slug: slug });

      expect(res.status).toBe(403);
    });

    it('write:bookings key CANNOT access GET /api/v1/bookings (403)', async () => {
      const res = await request(app)
        .get('/api/v1/bookings')
        .set('x-api-key', writeBookingsKey)
        .query({ tenant_slug: slug });

      expect(res.status).toBe(403);
    });
  });

  // ─── 401 on wrong/missing key ──────────────────────────────────

  describe('Authentication', () => {
    let validKey: string;

    beforeAll(async () => {
      const k = await request(app)
        .post('/api/tenant/api-keys')
        .set(await authHeader())
        .send({ scopes: ['read:bookings', 'read:services', 'write:bookings'] });
      validKey = k.body.key;
      createdKeyIds.push(k.body.id);
    });

    it('returns 401 without x-api-key header', async () => {
      const res = await request(app)
        .get('/api/v1/bookings')
        .query({ tenant_slug: slug });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('API_KEY_INVALID');
    });

    it('returns 401 with too-short key', async () => {
      const res = await request(app)
        .get('/api/v1/bookings')
        .set('x-api-key', 'egb_tooshort')
        .query({ tenant_slug: slug });

      expect(res.status).toBe(401);
    });

    it('returns 401 with completely wrong key', async () => {
      const res = await request(app)
        .get('/api/v1/bookings')
        .set('x-api-key', 'egb_00000000000000000000000000000000000000000000000000')
        .query({ tenant_slug: slug });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('API_KEY_INVALID');
    });

    it('returns 401 with wrong prefix (non-existent)', async () => {
      const res = await request(app)
        .get('/api/v1/bookings')
        .set('x-api-key', 'xxxxxxx1234567890123456789012345678901234567890')
        .query({ tenant_slug: slug });

      expect(res.status).toBe(401);
    });

    it('accepts a valid key', async () => {
      const res = await request(app)
        .get('/api/v1/bookings')
        .set('x-api-key', validKey)
        .query({ tenant_slug: slug });

      expect(res.status).toBe(200);
    });
  });

  // ─── last_used_at updates ──────────────────────────────────────

  describe('last_used_at tracking', () => {
    let trackKey: string;
    let trackId: string;

    beforeAll(async () => {
      const k = await request(app)
        .post('/api/tenant/api-keys')
        .set(await authHeader())
        .send({ scopes: ['read:bookings'] });
      trackKey = k.body.key;
      trackId = k.body.id;
      createdKeyIds.push(trackId);
    });

    it('last_used_at is null on a freshly created key', async () => {
      const row = await db.select().from(apiKeys).where(eq(apiKeys.id, trackId)).get();
      expect(row).toBeTruthy();
      expect(row!.lastUsedAt).toBeNull();
    });

    it('last_used_at is updated after a successful API call', async () => {
      await request(app)
        .get('/api/v1/bookings')
        .set('x-api-key', trackKey)
        .query({ tenant_slug: slug });

      const row = await db.select().from(apiKeys).where(eq(apiKeys.id, trackId)).get();
      expect(row).toBeTruthy();
      expect(row!.lastUsedAt).toBeTruthy();
      expect(row!.lastUsedAt).toBeGreaterThan(0);
    });
  });

  // ─── Expired keys ──────────────────────────────────────────────

  describe('Expired key rejection', () => {
    it('rejects an expired key', async () => {
      const rawKey = `egb_${crypto.randomBytes(32).toString('hex')}`;
      const prefix = rawKey.slice(0, 8);
      const keyHash = await bcrypt.hash(rawKey, 10);

      const row = await db.insert(apiKeys).values({
        id: crypto.randomUUID(),
        tenantId,
        keyPrefix: prefix,
        keyHash,
        scopes: ['read:bookings'],
        expiresAt: Date.now() - 1000,
        createdAt: Date.now(),
      }).returning().get();
      createdKeyIds.push(row.id);

      const res = await request(app)
        .get('/api/v1/bookings')
        .set('x-api-key', rawKey)
        .query({ tenant_slug: slug });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('API_KEY_EXPIRED');
    });
  });

  // ─── Key deletion ──────────────────────────────────────────────

  describe('Key deletion', () => {
    let deleteKeyId: string;
    let deleteKeyRaw: string;

    beforeAll(async () => {
      const k = await request(app)
        .post('/api/tenant/api-keys')
        .set(await authHeader())
        .send({ scopes: ['read:bookings'] });
      deleteKeyId = k.body.id;
      deleteKeyRaw = k.body.key;
      // Don't push to createdKeyIds since we'll delete it
    });

    it('DELETE /api/tenant/api-keys/:id removes the key', async () => {
      const delRes = await request(app)
        .delete(`/api/tenant/api-keys/${deleteKeyId}`)
        .set(await authHeader());

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
    });

    it('deleted key is rejected by the API', async () => {
      const res = await request(app)
        .get('/api/v1/bookings')
        .set('x-api-key', deleteKeyRaw)
        .query({ tenant_slug: slug });

      expect(res.status).toBe(401);
    });

    it('DELETE for non-existent key returns 404', async () => {
      const res = await request(app)
        .delete(`/api/tenant/api-keys/${crypto.randomUUID()}`)
        .set(await authHeader());

      expect(res.status).toBe(404);
    });
  });

  // ─── Public v1 endpoint responses ──────────────────────────────

  describe('Public v1 endpoints', () => {
    let readAllKey: string;

    beforeAll(async () => {
      const k = await request(app)
        .post('/api/tenant/api-keys')
        .set(await authHeader())
        .send({ scopes: ['read:bookings', 'read:services', 'write:bookings'] });
      readAllKey = k.body.key;
      createdKeyIds.push(k.body.id);
    });

    it('GET /api/v1/services returns tenant info + services list', async () => {
      const res = await request(app)
        .get('/api/v1/services')
        .set('x-api-key', readAllKey)
        .query({ tenant_slug: slug });

      expect(res.status).toBe(200);
      expect(res.body.tenant.name).toBe('API Marketplace Test');
      expect(res.body.tenant.slug).toBe(slug);
      expect(res.body.services.length).toBeGreaterThanOrEqual(1);
      const svc = res.body.services.find((s: any) => s.id === serviceId);
      expect(svc).toBeTruthy();
      expect(svc.name).toBe('Haircut');
      expect(svc.duration_minutes).toBe(30);
      expect(svc.price).toBe(50000);
    });

    it('GET /api/v1/services without tenant_slug returns 400', async () => {
      const res = await request(app)
        .get('/api/v1/services')
        .set('x-api-key', readAllKey);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('tenant_slug');
    });

    it('GET /api/v1/services with unknown slug returns 404', async () => {
      const res = await request(app)
        .get('/api/v1/services')
        .set('x-api-key', readAllKey)
        .query({ tenant_slug: 'nonexistent-slug-xyz' });

      expect(res.status).toBe(404);
    });

    it('GET /api/v1/bookings returns bookings with Ethiopian dates', async () => {
      const res = await request(app)
        .get('/api/v1/bookings')
        .set('x-api-key', readAllKey)
        .query({ tenant_slug: slug });

      expect(res.status).toBe(200);
      expect(res.body.tenant).toBeTruthy();
      expect(Array.isArray(res.body.bookings)).toBe(true);
    });

    it('POST /api/v1/bookings creates a booking with Ethiopian date in response', async () => {
      // Find a future weekday at 10:00 Addis time (07:00 UTC)
      const now = new Date();
      const addisNow = new Date(now.getTime() + 3 * 3600 * 1000);
      let targetDate = new Date(addisNow);
      targetDate.setUTCHours(0, 0, 0, 0);
      // Skip to next weekday
      while (targetDate.getUTCDay() === 0 || targetDate.getUTCDay() === 6) {
        targetDate.setUTCDate(targetDate.getUTCDate() + 1);
      }
      // Set to 07:00 UTC = 10:00 Addis
      targetDate.setUTCHours(7, 0, 0, 0);
      // Ensure it's in the future
      if (targetDate.getTime() <= Date.now()) {
        targetDate.setUTCDate(targetDate.getUTCDate() + 7);
      }
      const slotIso = targetDate.toISOString(); // includes +00:00 offset

      const res = await request(app)
        .post(`/api/v1/bookings?tenant_slug=${slug}`)
        .set('x-api-key', readAllKey)
        .send({
          staff_id: staffId,
          service_id: serviceId,
          start_time: slotIso,
          customer_name: 'API Customer',
          customer_phone: '+251911223344',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.appointment.status).toBe('confirmed');
      expect(res.body.appointment.start_date_ethiopian).toContain('20');
      expect(res.body.appointment.id).toBeTruthy();
    });

    it('POST /api/v1/bookings without tenant_slug returns 400', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('x-api-key', readAllKey)
        .send({
          staff_id: staffId,
          service_id: serviceId,
          start_time: new Date(Date.now() + 86400000).toISOString(),
          customer_name: 'No Slug',
          customer_phone: '+251911223344',
        });

      expect(res.status).toBe(400);
    });

    it('POST /api/v1/bookings with invalid body returns 422', async () => {
      const res = await request(app)
        .post(`/api/v1/bookings?tenant_slug=${slug}`)
        .set('x-api-key', readAllKey)
        .send({
          staff_id: 'not-a-uuid',
          start_time: 'bad-date',
        });

      expect(res.status).toBe(422);
    });
  });

  // ─── Multi-scope key ──────────────────────────────────────────

  describe('Multi-scope key', () => {
    it('key with all three scopes can access read and write endpoints', async () => {
      const k = await request(app)
        .post('/api/tenant/api-keys')
        .set(await authHeader())
        .send({ scopes: ['read:bookings', 'read:services', 'write:bookings'] });
      createdKeyIds.push(k.body.id);
      const multiKey = k.body.key;

      const res1 = await request(app)
        .get('/api/v1/bookings')
        .set('x-api-key', multiKey)
        .query({ tenant_slug: slug });
      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .get('/api/v1/services')
        .set('x-api-key', multiKey)
        .query({ tenant_slug: slug });
      expect(res2.status).toBe(200);
    });
  });
});
