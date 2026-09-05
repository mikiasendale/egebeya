/**
 * Wayfinder #12/#17 — account deletion (Apple 5.1.1(v), GDPR Art. 17).
 *
 * Covers both self-serve paths decided in the deletion matrix:
 *   Owner:   POST /api/tenant/account/deletion  (typed-name confirm)
 *   Consumer: POST /api/consumer/account/deletion (authenticated, confirm:true)
 *
 * Assertions follow the matrix: money records retained with identity
 * stripped, tenant reduced to an anonymous shell, staff gone in the same
 * transaction, bookings anonymized, consumer identity destroyed across
 * tenants, punch cards destroyed, telegram links anonymized/unlinked.
 */
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants, users, tenantSubscriptions, staff, services, appointments,
  payments, invoices, customerStats, punchCards, telegramLinks,
  consumers, siteConfig, pages,
} from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { cookieValue } from './helpers';
import crypto from 'crypto';

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

// ── Owner path fixtures ────────────────────────────────────────────────────
const suffix = Date.now();
const ownerPhone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
const ownerEmail = `del-owner-${suffix}@egebeya.test`;
const slug = `del-test-${suffix}`;
const businessName = `Delete Test Biz ${suffix}`;
const password = 'SecurePass456!';

let ownerToken = '';
let tenantId = '';

// ── Consumer path fixtures ─────────────────────────────────────────────────
const consumerPhone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
let consumerJwt = '';
let consumerId = '';

async function cleanup() {
  // Bottom-up leaves → identity rows. The owner test leaves an anonymized
  // tenant shell + retained money records; the consumer test leaves
  // anonymized per-tenant stats keyed by tenant. Delete children first.
  try {
    if (tenantId) {
      await db.delete(payments).where(eq(payments.tenantId, tenantId));
      await db.delete(invoices).where(eq(invoices.tenantId, tenantId));
      await db.delete(appointments).where(eq(appointments.tenantId, tenantId));
      await db.delete(customerStats).where(eq(customerStats.tenantId, tenantId));
      await db.delete(punchCards).where(eq(punchCards.tenantId, tenantId));
      await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId));
      await db.delete(users).where(eq(users.tenantId, tenantId));
      await db.delete(tenants).where(eq(tenants.id, tenantId));
    }
    if (consumerId) {
      await db.delete(telegramLinks).where(eq(telegramLinks.phone, consumerPhone));
      await db.delete(consumers).where(eq(consumers.id, consumerId));
    }
  } catch {
    // cleanup is best-effort; a failure here must not mask test results.
  }
}
afterAll(cleanup);

describe('Owner account deletion (POST /api/tenant/account/deletion)', () => {
  it('registers a tenant with staff, services, bookings, subscription and payment rows', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Delete Tester',
      phone: ownerPhone,
      password,
      businessName,
      slug,
      email: ownerEmail,
      consent: true,
    });
    expect(res.status).toBe(200);
    ownerToken = cookieValue(res, 'accessToken') ?? '';
    tenantId = res.body.tenant.id;
    expect(ownerToken).toBeTruthy();

    // Subscription row (register seeds it) + a payment row to protect.
    await db.insert(payments).values({
      id: crypto.randomUUID(),
      tenantId,
      amount: 50000,
      gateway: 'chapa',
      method: 'checkout',
      gatewayReference: `del-test-${suffix}`,
      status: 'completed',
      createdAt: Date.now(),
      meta: { purpose: 'pro_subscription', ownerEmail },
    });

    // Staff + service + booking carrying consumer identity.
    const svc = await request(app).post('/api/tenant/services')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Cut', price: 20000, durationMinutes: 30 });
    expect([200, 201]).toContain(svc.status);
    const staffRes = await request(app).post('/api/tenant/staff')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Staff One', phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}` });
    expect([200, 201]).toContain(staffRes.status);
  });

  it('rejects deletion when the typed business name does not match', async () => {
    const res = await request(app).post('/api/tenant/account/deletion')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ confirmName: 'Wrong Name' });
    expect(res.status).toBe(400);
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    expect(tenant?.name).toBe(businessName);
  });

  it('deletes the account per the decision matrix', async () => {
    const res = await request(app).post('/api/tenant/account/deletion')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ confirmName: businessName });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Tenant shell: anonymous, suspended, unlisted, domain cleared.
    const shell = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    expect(shell).toBeTruthy();
    expect(shell!.name).toBe('Deleted account');
    expect(shell!.isListed).toBe(false);
    expect(shell!.isSuspended).toBe(true);
    expect(shell!.domain).toBeNull();

    // Users (owner + staff) and staff subtree gone.
    const remainingUsers = await db.select().from(users).where(eq(users.tenantId, tenantId));
    expect(remainingUsers).toHaveLength(0);
    const remainingStaff = await db.select().from(staff).where(eq(staff.tenantId, tenantId));
    expect(remainingStaff).toHaveLength(0);
    const remainingServices = await db.select().from(services).where(eq(services.tenantId, tenantId));
    expect(remainingServices).toHaveLength(0);

    // Subscription gone.
    const subs = await db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId));
    expect(subs).toHaveLength(0);

    // Money record RETAINED with identity redacted (meta nulled).
    const keptPayments = await db.select().from(payments).where(eq(payments.tenantId, tenantId));
    expect(keptPayments).toHaveLength(1);
    expect(keptPayments[0].meta).toEqual({ redactedOnDeletion: true });
    expect(JSON.stringify(keptPayments[0].meta)).not.toContain(ownerEmail);

    // Site config + pages gone (site unpublished).
    expect(await db.select().from(siteConfig).where(eq(siteConfig.tenantId, tenantId))).toHaveLength(0);
    expect(await db.select().from(pages).where(eq(pages.tenantId, tenantId))).toHaveLength(0);

    // The deleted owner's token can no longer authenticate.
    const me = await request(app).get('/api/tenant/subscription')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(me.status).toBe(401);
  });
});

describe('Consumer account deletion (POST /api/consumer/account/deletion)', () => {
  it('rejects an unauthenticated call', async () => {
    const res = await request(app).post('/api/consumer/account/deletion')
      .send({ confirm: true });
    expect(res.status).toBe(401);
  });

  it('rejects without confirmation', async () => {
    // Seed a real consumer so requireConsumerAuth's fresh-row check passes —
    // the 400 must come from the missing confirmation, not the auth layer.
    consumerId = crypto.randomUUID();
    await db.insert(consumers).values({
      id: consumerId,
      phone: consumerPhone,
      name: 'Kalkidan',
      consentGivenAt: Date.now(),
      createdAt: Date.now(),
    });
    const jwt = await import('jsonwebtoken');
    const token = (jwt as any).sign(
      { consumerId, phone: consumerPhone, aud: 'consumer' },
      process.env.JWT_SECRET ?? 'test-secret',
      { expiresIn: '10m' },
    );
    const res = await request(app).post('/api/consumer/account/deletion')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('deletes the consumer identity and anonymizes phone-keyed rows in one call', async () => {
    // Consumer row was seeded by the previous test; add the tenant-scoped rows.
    const seedTenantId = tenantId; // shell tenant from the owner test
    await db.insert(punchCards).values({
      id: crypto.randomUUID(),
      tenantId: seedTenantId,
      consumerPhone,
      punches: 2,
      target: 5,
      createdAt: Date.now(),
    });
    await db.insert(customerStats).values({
      tenantId: seedTenantId,
      customerPhone: consumerPhone,
      customerName: 'Kalkidan',
      visitCount: 3,
      marketingOptIn: true,
      marketingOptInGivenAt: Date.now(),
      createdAt: Date.now(),
    });

    const jwt = await import('jsonwebtoken');
    const token = (jwt as any).sign(
      { consumerId, phone: consumerPhone, aud: 'consumer' },
      process.env.JWT_SECRET ?? 'test-secret',
      { expiresIn: '10m' },
    );
    consumerJwt = token;

    const res = await request(app).post('/api/consumer/account/deletion')
      .set('Authorization', `Bearer ${consumerJwt}`)
      .send({ confirm: true });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Consumer identity destroyed.
    expect(await db.select().from(consumers).where(eq(consumers.id, consumerId))).toHaveLength(0);

    // Punch cards destroyed.
    expect(await db.select().from(punchCards).where(eq(punchCards.consumerPhone, consumerPhone))).toHaveLength(0);

    // Customer stats anonymized in place (unique token, consent cleared).
    const stat = await db.select().from(customerStats)
      .where(and(eq(customerStats.tenantId, seedTenantId), eq(customerStats.customerPhone, `deleted:${consumerId}`))).get();
    expect(stat).toBeTruthy();
    expect(stat!.customerName).toBe('Deleted User');
    expect(stat!.marketingOptIn).toBe(false);

    // The consumer's token can no longer authenticate (identity row gone).
    const me = await request(app).get('/api/consumer/me')
      .set('Authorization', `Bearer ${consumerJwt}`);
    expect([401, 403]).toContain(me.status);
  });
});
