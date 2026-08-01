import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import { tenants, users, passwordResets, tenantSubscriptions } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { cookieValue } from './helpers';
import crypto from 'crypto';

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

describe('Auth flow (register / login / refresh / forgot-password)', () => {
  const phone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  const slug = `auth-test-${Date.now()}`;
  const email = `auth-test-${Date.now()}@egebeya.test`;
  const password = 'securePass456';

  let token: string;
  let refreshToken: string;
  let tenantId: string;
  let userId: string;

  afterAll(async () => {
    if (!tenantId) return;
    // The forgot-password test inserts a password_resets row (FK → users),
    // and /register seeds a tenant_subscription row (FK → tenants +
    // plans). Both MUST be removed before users / tenants go, or
    // afterAll trips a FOREIGN KEY constraint and the suite fails.
    // Order is bottom-up: leaves → users → subscriptions → tenants.
    await db.delete(passwordResets).where(eq(passwordResets.userId, userId));
    await db.delete(users).where(eq(users.tenantId, tenantId));
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  // -------------------- REGISTER --------------------

  it('registers a new tenant and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Auth Tester',
      phone,
      password,
      businessName: 'Auth Test Biz',
      slug,
      email,
      consent: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('owner');
    expect(res.body.tenant.slug).toBe(slug);

    token = cookieValue(res, 'accessToken');
    refreshToken = cookieValue(res, 'refreshToken');
    expect(token).toBeTruthy();
    expect(refreshToken).toBeTruthy();
    tenantId = res.body.tenant.id;
    // We need the real user.id for password_resets cleanup later. The
    // /register response doesn't return the user row, so resolve it from
    // the DB by tenant + phone (both are known at this point).
    const { eq: eq1, and: and1 } = await import('drizzle-orm');
    const created = await db.select({ id: users.id }).from(users)
      .where(and1(eq1(users.tenantId, tenantId), eq1(users.phone, phone)))
      .get();
    userId = created?.id || '';
  });

  it('rejects duplicate email with 409', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Duplicate Email',
      phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
      password,
      businessName: 'Dup Biz',
      slug: `dup-email-${Date.now()}`,
      email,
      consent: true,
    });
    expect(res.status).toBe(409);
    expect(String(res.body.error || '').toLowerCase()).toMatch(/email/);
  });

  it('rejects duplicate phone with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Dup Phone',
      phone,
      password,
      businessName: 'Dup Phone Biz',
      slug: `dup-phone-${Date.now()}`,
      email: `dup-phone-${Date.now()}@meubeya.test`,
    });
    expect(res.status).toBe(400);
  });

  it('rejects invalid Ethiopian phone (non-+251)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Bad Phone',
      phone: '0987654321',
      password,
      businessName: 'Bad Biz',
      slug: `badphone-${Date.now()}`,
      email: `badphone-${Date.now()}@meubeya.test`,
    });
    expect(res.status).toBe(400);
  });

  // -------------------- LOGIN --------------------

  it('logs in with correct credentials and returns a fresh token', async () => {
    const res = await request(app).post('/api/auth/login').send({
      phone,
      password,
    });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('owner');
    expect(res.body.tenantId).toBeDefined();

    token = cookieValue(res, 'accessToken');
    refreshToken = cookieValue(res, 'refreshToken');
    expect(token).toBeTruthy();
    expect(refreshToken).toBeTruthy();
  });

  it('rejects login with wrong password (401)', async () => {
    const res = await request(app).post('/api/auth/login').send({
      phone,
      password: 'wrongPass999',
    });
    expect(res.status).toBe(401);
  });

  it('rejects login with non-Ethiopian phone (400)', async () => {
    const res = await request(app).post('/api/auth/login').send({
      phone: '5551234567',
      password: 'anything',
    });
    expect(res.status).toBe(400);
    expect(String(res.body.error || '').toLowerCase()).toMatch(/phone/);
  });

  // -------------------- REFRESH --------------------

  it('refreshes an access token with a valid refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({
      refreshToken,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    token = cookieValue(res, 'accessToken');
    expect(token).toBeTruthy();
  });

  it('rejects refresh with a missing token (401)', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(401);
  });

  it('rejects refresh with a garbage token (403)', async () => {
    const res = await request(app).post('/api/auth/refresh').send({
      refreshToken: 'not.a.valid.jwt',
    });
    expect(res.status).toBe(403);
  });

  // -------------------- FORGOT / RESET PASSWORD --------------------

  it('forgot-password returns success even for non-existent email (no leak)', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({
      email: `ghost-${Date.now()}@no-such-domain.test`,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('forgot-password for a real user returns success and creates a reset token', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({
      email,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects reset-password without a token (400)', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({
      newPassword: 'NewPass1234',
    });
    expect(res.status).toBe(400);
  });
});