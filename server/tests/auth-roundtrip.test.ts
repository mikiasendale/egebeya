/**
 * Auth roundtrip + protected-route middleware coverage.
 *
 * What's already covered by auth.test.ts:
 *   - register / login / refresh happy paths
 *   - bad-phone / wrong-password / bad-pin / missing-token rejection
 *   - forgot-password no-leak invariance
 *   - reset-password missing-token rejection
 *
 * What THIS file locks down:
 *   - The full reset-password SUCCESS path: request a reset, look up the
 *     issued token, call reset-password with old + new password, then
 *     confirm login works with the NEW password (and the OLD password is
 *     rejected). This closes the loop on /auth/reset-password so a
 *     regression in this endpoint blocks CI.
 *   - JWT middleware rejection paths on the protected /api/bookings route
 *     (no Authorization / Authorization without "Bearer " / malformed
 *     header / signed-with-wrong-secret JWT) — the existing auth tests
 *     use the bare auth router which doesn't share middleware with the
 *     other mounts, so we have to exercise it through a real route.
 *   - That the OWNER-only auth guard on /api/tenant/* denies a non-owner
 *     (staff role) user. The pro-site router has the same shape; we
 *     cover the tenant one because it has the broader surface.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';

import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants,
  users,
  passwordResets,
  tenantSubscriptions,
  plans,
} from '../../src/db/schema';

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

describe('Auth roundtrip + protected-route middleware', () => {
  const slug = `auth-rt-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  const phone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  const email = `auth-rt-${Date.now()}@egebeya.test`;
  const oldPassword = 'oldPass1234';
  const newPassword = 'newPass5678';

  let tenantId: string;
  let userId: string;
  let resetToken: string;

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    userId = crypto.randomUUID();

    await db.insert(tenants).values({
      id: tenantId,
      name: 'Auth Roundtrip',
      slug,
      settings: { require_payment_upfront: false },
      createdAt: Date.now(),
    });
    await db.insert(users).values({
      id: userId,
      tenantId,
      name: 'Roundtrip Owner',
      phone,
      email,
      passwordHash: await bcrypt.hash(oldPassword, 10),
      role: 'owner',
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
  });

  afterAll(async () => {
    // Mirror the FK-safe delete order used by the other tests.
    await db.delete(passwordResets).where(eq(passwordResets.userId, userId));
    await db.delete(users).where(eq(users.tenantId, tenantId));
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  // ---- full reset-password roundtrip ----

  it('forgot-password issues a reset token persisted to password_resets', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // The mailer is a stub in tests; pull the token from the DB instead.
    const row = await db.select()
      .from(passwordResets)
      .where(eq(passwordResets.userId, userId))
      .get();
    expect(row).toBeDefined();
    expect(typeof row!.token).toBe('string');
    expect(row!.token.length).toBeGreaterThan(0);
    expect(row!.expiresAt).toBeGreaterThan(Date.now());
    resetToken = row!.token;
  });

  it('reset-password with the issued token + oldPassword + newPassword succeeds', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, oldPassword, newPassword });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // The token row must be consumed (deleted) so it cannot be replayed.
    const stillThere = await db.select()
      .from(passwordResets)
      .where(eq(passwordResets.token, resetToken))
      .get();
    expect(stillThere).toBeUndefined();
  });

  it('login with the NEW password succeeds', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone, password: newPassword });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.tenantId).toBe(tenantId);
  });

  it('login with the OLD password is rejected after the reset', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone, password: oldPassword });
    expect(res.status).toBe(401);
  });

  it('reset-password cannot replay a consumed token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, oldPassword, newPassword });
    expect(res.status).toBe(400);
    expect(String(res.body.error || '').toLowerCase()).toMatch(/token/i);
  });

  // ---- protected-route middleware ----

  it('GET /api/bookings without Authorization returns 401', async () => {
    const res = await request(app).get('/api/bookings');
    expect(res.status).toBe(401);
  });

  it('GET /api/bookings with a malformed Authorization header returns 401', async () => {
    const res = await request(app)
      .get('/api/bookings')
      .set('Authorization', 'NotBearer xxx');
    expect(res.status).toBe(401);
  });

  it('GET /api/bookings with a JWT signed by the wrong secret returns 401', async () => {
    const jwt = require('jsonwebtoken');
    const forged = jwt.sign(
      { userId, tenantId, role: 'owner' },
      'attacker-controlled-secret',
      { expiresIn: '15m' },
    );
    const res = await request(app)
      .get('/api/bookings')
      .set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it('GET /api/bookings with a well-signed JWT returns 200', async () => {
    const jwt = require('jsonwebtoken');
    const valid = jwt.sign(
      { userId, tenantId, role: 'owner' },
      JWT_SECRET,
      { expiresIn: '15m' },
    );
    const res = await request(app)
      .get('/api/bookings')
      .set('Authorization', `Bearer ${valid}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // ---- role-gate on owner-only routes ----

  it('owner-only /api/tenant/* rejects a non-owner (staff) JWT with 403', async () => {
    const jwt = require('jsonwebtoken');
    const staffToken = jwt.sign(
      { userId, tenantId, role: 'staff' },
      JWT_SECRET,
      { expiresIn: '15m' },
    );
    const res = await request(app)
      .get('/api/tenant/services')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  it('owner-only /api/tenant/pro-site/files rejects a non-owner (staff) JWT with 403', async () => {
    const jwt = require('jsonwebtoken');
    const staffToken = jwt.sign(
      { userId, tenantId, role: 'staff' },
      JWT_SECRET,
      { expiresIn: '15m' },
    );
    const res = await request(app)
      .get('/api/tenant/pro-site/files')
      .set('Authorization', `Bearer ${staffToken}`);
    // The router-level guard returns 403 BEFORE the PlanRequired gate runs
    // (since 'staff' doesn't pass the owner check), so we expect 403 here.
    expect(res.status).toBe(403);
  });

  // ---- token_version revocation ----

  it('refresh token is rejected after password reset (token_version bump)', async () => {
    const jwt = require('jsonwebtoken');
    const REFRESH_SECRET = process.env.REFRESH_SECRET || 'refresh_supersecret_fallback';

    // 1) Login to get tokens.
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ phone, password: newPassword });
    expect(loginRes.status).toBe(200);
    const refreshToken = loginRes.body.refreshToken;

    // 2) Verify the refresh token works before password change.
    const beforeRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(beforeRes.status).toBe(200);
    expect(beforeRes.body.token).toBeDefined();

    // 3) Issue a fresh password-reset token in the DB.
    await db.delete(passwordResets).where(eq(passwordResets.userId, userId));
    const pwtoken = crypto.randomUUID();
    await db.insert(passwordResets).values({
      id: crypto.randomUUID(),
      token: pwtoken,
      userId,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    // 4) Change the password (reset-password bumps token_version).
    const newerPassword = 'newerPass999';
    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: pwtoken, oldPassword: newPassword, newPassword: newerPassword });
    expect(resetRes.status).toBe(200);

    // 5) The OLD refresh token must now be rejected (token_version mismatch).
    const afterRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(afterRes.status).toBe(403);
  });

  it('refresh token is rejected after explicit logout', async () => {
    const jwt = require('jsonwebtoken');

    // 1) Login with the post-reset password to get fresh tokens.
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ phone, password: 'newerPass999' });
    expect(loginRes.status).toBe(200);
    const accessToken = loginRes.body.token;
    const refreshToken = loginRes.body.refreshToken;

    // 2) Verify the refresh token works before logout.
    const beforeRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(beforeRes.status).toBe(200);
    expect(beforeRes.body.token).toBeDefined();

    // 3) Call the logout endpoint.
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(logoutRes.status).toBe(200);

    // 4) The pre-logout refresh token must now be rejected.
    const afterRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(afterRes.status).toBe(403);
  });

  it('logout endpoint requires authentication', async () => {
    const res = await request(app)
      .post('/api/auth/logout');
    expect(res.status).toBe(401);
  });
});
