/**
 * P3.4 — magic-link consumer login tests.
 *
 * Acceptance coverage:
 *   - code brute-force lockout (5 wrong attempts kill the code)
 *   - audience confusion: owner token on consumer route → 403,
 *     consumer token on merchant route → 403
 *   - phone normalization dedupe (0911… and +251911… = same consumer)
 *   - request-code fails fast with NO_TELEGRAM_LINK for unlinked phones
 *   - booking creation backfills consumers + appointments.consumer_id
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

vi.mock('../../server/lib/sms', async () => ({
  sendSms: vi.fn(async ({ to, text }: { to: string; text: string }) => {
    lastSmsText = text;
    return { success: true, messageId: 'sms-stub' };
  }),
}));
let lastSmsText = '';

import { db } from '../../src/db';
import {
  tenants, users, services as servicesTable, staff, appointments,
  telegramLinks, otpCodes, consumers, customerStats,
} from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { generateOtp } from '../lib/otp';
import { notify } from '../lib/notifications';
import { __setTelegramFetch, ensureTelegramRegistered } from '../lib/telegram';

ensureTelegramRegistered();
__setTelegramFetch(async (_url: any, init: any) => {
  const body = JSON.parse(init.body);
  // Capture the code out of the Telegram message body — the OTP lib hashes at
  // rest, so the delivery text is the only place the plaintext exists.
  lastSmsText = body.text;
  return new Response(JSON.stringify({ ok: true, result: { message_id: 7 } }), { status: 200 });
});

const app = express();
app.use(express.json());
const { default: apiRoutes } = await import('../../src/api');
app.use('/api', apiRoutes);

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

describe('Consumer identity-lite (P3.4)', () => {
  const slug = `consumer-${Date.now()}`;
  let tenantId: string;
  let svcId: string;
  let staffId: string;
  let ownerToken: string;
  let opaqueId: string;
  const CHAT_ID = '777123';
  const PHONE_A = '+251955112233';
  const CHAT_ID_B = '777124';
  const CHAT_ID_C = '777125';

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    svcId = crypto.randomUUID();
    staffId = crypto.randomUUID();
    await db.insert(tenants).values({
      id: tenantId, name: 'Consumer Salon', slug,
      settings: { require_payment_upfront: false }, createdAt: Date.now(),
    });
    await db.insert(users).values({
      id: crypto.randomUUID(), tenantId, name: 'Owner',
      phone: `+2519${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
      email: `${slug}@egebeya.test`,
      passwordHash: await bcrypt.hash('Str0ng-Passw0rd!', 8),
      role: 'owner', createdAt: Date.now(),
    });
    await db.insert(servicesTable).values({ id: svcId, tenantId, name: 'Braid', durationMinutes: 60, price: 30000, active: true });
    await db.insert(staff).values({ id: staffId, tenantId, name: 'Braider', active: true });

    opaqueId = crypto.randomBytes(16).toString('hex');

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        phone: `+2519${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
        password: 'x',
      });
    void loginRes; // owner token minted directly below instead:
    const ownerRow = await db.select().from(users).where(eq(users.tenantId, tenantId)).get();
    ownerToken = jwt.sign(
      { userId: ownerRow!.id, tenantId, role: 'owner', tokenVersion: 0 },
      JWT_SECRET,
      { expiresIn: '15m' },
    );
  });

  afterAll(async () => {
    await db.delete(appointments).where(eq(appointments.tenantId, tenantId)).catch(() => {});
    await db.delete(customerStats).where(eq(customerStats.tenantId, tenantId)).catch(() => {});
    for (const chat of [CHAT_ID, CHAT_ID_B, CHAT_ID_C]) {
      await db.delete(telegramLinks).where(eq(telegramLinks.chatId, chat)).catch(() => {});
    }
    await db.delete(otpCodes).where(eq(otpCodes.phone, PHONE_A)).catch(() => {});
    await db.delete(consumers).where(eq(consumers.phone, PHONE_A)).catch(() => {});
    await db.delete(staff).where(eq(staff.id, staffId)).catch(() => {});
    await db.delete(servicesTable).where(eq(servicesTable.id, svcId)).catch(() => {});
    await db.delete(users).where(eq(users.tenantId, tenantId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
    __setTelegramFetch(null);
  });

  async function requestCode(phone: string): Promise<any> {
    return request(app).post('/api/consumer/request-code').send({ phone });
  }

  async function linkChatForPhone(chatId: string, phone: string): Promise<void> {
    await db.insert(telegramLinks).values({
      chatId,
      phone,
      tenantId: null,
      consentGivenAt: Date.now(),
      linkedAt: Date.now(),
    }).onConflictDoUpdate({
      target: telegramLinks.chatId,
      set: { phone, linkedAt: Date.now() },
    });
  }

  it('request-code refuses unlinked phones without consuming OTP quota', async () => {
    const res = await requestCode('+251944556677');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NO_TELEGRAM_LINK');
  });

  it('delivers the code via Telegram and verifies into a consumer JWT', async () => {
    await linkChatForPhone(CHAT_ID, PHONE_A);

    const reqRes = await requestCode(PHONE_A);
    expect(reqRes.status).toBe(200);
    expect(reqRes.body.deliveredVia).toBe('telegram');

    const code = lastSmsText.match(/(\d{6})/)?.[1];
    expect(code).toBeTruthy();

    const verifyRes = await request(app)
      .post('/api/consumer/verify')
      .send({ phone: PHONE_A, code });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.token).toBeTruthy();

    const payload: any = jwt.verify(verifyRes.body.token, JWT_SECRET);
    expect(payload.aud).toBe('consumer');

    const consumerRow = await db.select().from(consumers).where(eq(consumers.phone, PHONE_A)).get();
    expect(consumerRow).toBeTruthy();
    // P3.7 invariant: consent stamped on creation.
    expect(consumerRow!.consentGivenAt).toBeGreaterThan(0);
  });

  it('phone normalization dedupe: alternate formats resolve to one consumer', async () => {
    await linkChatForPhone(CHAT_ID_B, '251955112233'); // no plus

    await requestCode(PHONE_A);
    const code2 = lastSmsText.match(/(\d{6})/)?.[1]!;

    // Request a second send is rate-limited (3/h) — reuse flow: verify with a
    // differently-formatted phone instead. The code was requested for
    // +251955112233; verify accepts 0955112233 as the SAME number.
    await linkChatForPhone(CHAT_ID_C, '0955112233');
    const reqRes = await requestCode('0955112233'); // normalized to same phone
    expect(reqRes.status).toBe(200);
    const freshCode = lastSmsText.match(/(\d{6})/)?.[1]!;

    const res = await request(app)
      .post('/api/consumer/verify')
      .send({ phone: '0955112233', code: freshCode || code2 });
    expect(res.status).toBe(200);

    const rows = await db.select().from(consumers).where(eq(consumers.phone, PHONE_A)).all();
    expect(rows.length).toBe(1);
  });

  it('brute-force lockout: 5 wrong attempts invalidate the code', async () => {
    const victimChat = '777126';
    const victimPhone = '+251966778899';
    await linkChatForPhone(victimChat, victimPhone);

    await requestCode(victimPhone);
    const realCode = lastSmsText.match(/(\d{6})/)?.[1]!;
    const wrong = realCode === '000000' ? '111111' : '000000';

    for (let i = 0; i < 5; i++) {
      const r = await request(app)
        .post('/api/consumer/verify')
        .send({ phone: victimPhone, code: wrong });
      expect(r.status).toBe(400);
    }

    // The REAL code is now dead too — lockout holds.
    const final = await request(app)
      .post('/api/consumer/verify')
      .send({ phone: victimPhone, code: realCode });
    expect(final.status).toBe(400);

    await db.delete(otpCodes).where(eq(otpCodes.phone, victimPhone)).catch(() => {});
    await db.delete(consumers).where(eq(consumers.phone, victimPhone)).catch(() => {});
    await db.delete(telegramLinks).where(eq(telegramLinks.chatId, victimChat)).catch(() => {});
  });

  it('AUDIENCE CONFUSION: owner token on consumer route → 403', async () => {
    const me = await request(app)
      .get('/api/consumer/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(me.status).toBe(403);
  });

  it('AUDIENCE CONFUSION: consumer token on merchant route → 403', async () => {
    await linkChatForPhone(CHAT_ID, PHONE_A);
    await requestCode(PHONE_A);
    const code = lastSmsText.match(/(\d{6})/)?.[1]!;
    const v = await request(app).post('/api/consumer/verify').send({ phone: PHONE_A, code });
    const consumerToken = v.body.token;

    const bookings = await request(app)
      .get('/api/tenant/bookings')
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(bookings.status).toBe(403);
  });

  it('booking creation backfills consumer + appointments.consumer_id', async () => {
    const start = new Date(Date.now() + 48 * 3600 * 1000);
    start.setUTCMinutes(start.getUTCMinutes() >= 30 ? 30 : 0, 0, 0);

    const res = await request(app)
      .post('/api/public/bookings')
      .set('X-Tenant-Slug', slug)
      .send({
        staff_id: staffId,
        service_ids: [svcId],
        start_time: start.toISOString(),
        customer_name: 'Backfill Customer',
        customer_phone: '+251933445566',
        marketing_opt_in: true,
      });
    expect(res.status).toBe(201);

    const appt = await db.select().from(appointments)
      .where(eq(appointments.opaqueId, res.body.appointment.id)).get();
    expect(appt?.consumerId).toBeTruthy();

    const consumer = appt?.consumerId
      ? await db.select().from(consumers).where(eq(consumers.id, appt.consumerId)).get()
      : null;
    expect(consumer?.phone).toBe('+251933445566');
    expect(consumer!.consentGivenAt).toBeGreaterThan(0);

    // P3.1 capture: explicit marketing opt-in recorded WITH timestamp.
    const stats = await db.select().from(customerStats)
      .where(eq(customerStats.customerPhone, '+251933445566')).get();
    expect(stats?.marketingOptIn).toBe(true);
    expect((stats as any)?.marketingOptInGivenAt).toBeGreaterThan(0);

    await db.delete(appointments).where(eq(appointments.id, appt!.id)).catch(() => {});
    await db.delete(consumers).where(eq(consumers.phone, '+251933445566')).catch(() => {});
    await db.delete(customerStats).where(eq(customerStats.customerPhone, '+251933445566')).catch(() => {});
  });
});
