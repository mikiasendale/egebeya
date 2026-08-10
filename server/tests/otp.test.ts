/**
 * SMS OTP identity flow (Feature E): phone-based registration and password
 * reset, plus per-phone rate limiting.
 *
 * Covers:
 *   1. Send (register-with-phone) → verify (verify-otp) completes
 *      registration and issues auth cookies.
 *   2. Resending invalidates the previous code (the old code is rejected).
 *   3. The 3-sends-per-hour per-phone rate limit returns 429.
 *   4. reset-password-via-sms → verify-otp → confirm-password-reset roundtrip.
 *
 * OTP codes are read straight from the `otp_codes` table (the SMS stub never
 * carries them on a real gateway), keeping the test independent of SMS
 * delivery plumbing.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { eq, desc } from 'drizzle-orm';

import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import { otpCodes, users, tenants, tenantSubscriptions, passwordResets } from '../../src/db/schema';
import { cookieValue } from './helpers';

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

function randomPhone(): string {
  return `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
}

async function latestCode(phone: string): Promise<string | null> {
  const row = await db.select().from(otpCodes)
    .where(eq(otpCodes.phone, phone))
    .orderBy(desc(otpCodes.createdAt))
    .get();
  return row?.code ?? null;
}

interface SendOpts {
  phone: string;
  password?: string;
  businessName?: string;
  slug?: string;
}

function sendOtpRequest(opts: SendOpts) {
  return request(app).post('/api/auth/register-with-phone').send({
    phone: opts.phone,
    password: opts.password ?? 'SecurePass123!',
    businessName: opts.businessName ?? 'OTP Test Business',
    slug: opts.slug ?? `otp-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    consent: true,
  });
}

function verifyRegisterRequest(phone: string, code: string, slug: string) {
  return request(app).post('/api/auth/verify-otp').send({
    phone,
    code,
    intent: 'register',
    password: 'SecurePass123!',
    businessName: 'OTP Test Business',
    slug,
    consent: true,
  });
}

describe('SMS OTP identity (Feature E)', () => {
  const createdTenantSlugs: string[] = [];
  const createdPhones: string[] = [];

  afterAll(async () => {
    // Delete OTP codes, subscriptions, users and tenants created by these
    // tests so they don't leak into the shared test database.
    for (const phone of createdPhones) {
      await db.delete(otpCodes).where(eq(otpCodes.phone, phone)).catch(() => {});
    }
    for (const slug of createdTenantSlugs) {
      const tenantsRows = await db.select().from(tenants).where(eq(tenants.slug, slug)).all();
      for (const t of tenantsRows) {
        await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, t.id)).catch(() => {});
        await db.delete(users).where(eq(users.tenantId, t.id)).catch(() => {});
        await db.delete(passwordResets).where(eq(passwordResets.userId, t.id)).catch(() => {});
        await db.delete(tenants).where(eq(tenants.id, t.id)).catch(() => {});
      }
    }
  });

  it('send → verify completes registration and returns auth cookies', async () => {
    const phone = randomPhone();
    const slug = `otpreg-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
    createdPhones.push(phone);
    createdTenantSlugs.push(slug);

    const send = await sendOtpRequest({ phone, slug });
    expect(send.status).toBe(200);
    expect(send.body.phone).toBe(phone);

    const code = await latestCode(phone);
    expect(code).toBeTruthy();
    expect(String(code)).toMatch(/^\d{6}$/);

    const verify = await verifyRegisterRequest(phone, code!, slug);
    expect(verify.status).toBe(200);
    expect(verify.body.role).toBe('owner');
    expect(cookieValue(verify, 'accessToken')).toBeTruthy();

    const user = await db.select().from(users).where(eq(users.phone, phone)).get();
    expect(user).toBeTruthy();
    expect(user?.role).toBe('owner');

    const tenant = await db.select().from(tenants).where(eq(tenants.slug, slug)).get();
    expect(tenant).toBeTruthy();
  });

  it('a resend invalidates the previously-issued code', async () => {
    const phone = randomPhone();
    const slug = `otpresend-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
    createdPhones.push(phone);
    createdTenantSlugs.push(slug);

    const first = await sendOtpRequest({ phone, slug });
    expect(first.status).toBe(200);
    const code1 = await latestCode(phone);

    // Resend — same phone, new code.
    const second = await sendOtpRequest({ phone, slug });
    expect(second.status).toBe(200);
    const code2 = await latestCode(phone);
    expect(code2).not.toBe(code1);

    // Old code must now be rejected.
    const stale = await verifyRegisterRequest(phone, code1!, slug);
    expect(stale.status).toBe(400);

    // The freshly-resent code still works.
    const fresh = await verifyRegisterRequest(phone, code2!, slug);
    expect(fresh.status).toBe(200);
    expect(fresh.body.role).toBe('owner');
  });

  it('rate limit: the 4th send within an hour returns 429', async () => {
    const phone = randomPhone();
    const slug = `otprate-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
    createdPhones.push(phone);
    createdTenantSlugs.push(slug);

    for (let i = 0; i < 3; i++) {
      const res = await sendOtpRequest({ phone, slug });
      expect(res.status).toBe(200);
    }

    const fourth = await sendOtpRequest({ phone, slug });
    expect(fourth.status).toBe(429);
    expect(fourth.body.code).toBe('RATE_LIMITED_OTP_SEND');
  });

  it('reset-password-via-sms → verify-otp → confirm-password-reset roundtrip', async () => {
    const phone = randomPhone();
    const slug = `otpreset-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
    createdPhones.push(phone);
    createdTenantSlugs.push(slug);

    // Register an account the normal way so we have a password to reset.
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Reset Owner',
      phone,
      password: 'OldPass123!',
      businessName: 'Reset Test Business',
      slug,
      email: `reset-${slug}@egebeya.test`,
      consent: true,
    });
    expect(reg.status).toBe(200);

    const send = await request(app).post('/api/auth/reset-password-via-sms').send({ phone });
    expect(send.status).toBe(200);

    const code = await latestCode(phone);
    expect(code).toBeTruthy();

    const verify = await request(app).post('/api/auth/verify-otp').send({
      phone, code, intent: 'reset-password',
    });
    expect(verify.status).toBe(200);
    expect(verify.body.resetToken).toBeTruthy();

    const confirm = await request(app).post('/api/auth/confirm-password-reset').send({
      resetToken: verify.body.resetToken,
      newPassword: 'BrandNewPass456!',
    });
    expect(confirm.status).toBe(200);
    expect(confirm.body.success).toBe(true);

    // The new password actually works for login.
    const login = await request(app).post('/api/auth/login').send({
      phone, password: 'BrandNewPass456!',
    });
    expect(login.status).toBe(200);
    expect(cookieValue(login, 'accessToken')).toBeTruthy();
  });
});
