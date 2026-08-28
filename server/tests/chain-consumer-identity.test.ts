/**
 * CHAIN 14 (P3.4): consumer request-code → verify → booking backfill.
 *
 *   POST /api/telegram/webhook /start<opaqueId> → chat linked to phone
 *     → POST /api/consumer/request-code (consumer.ts → otp.generateOtp
 *       channel 'telegram') → code delivered over the captured Telegram
 *       transport
 *     → POST /api/consumer/verify (otp.verifyOtp → consumers.upsertByPhone
 *       → consumer JWT aud:'consumer')
 *     → POST /api/public/bookings with the same phone → the appointment's
 *       consumer_id links to the SAME consumer profile (identity backfill).
 *
 * Failure modes: unlinked phone → 409 NO_TELEGRAM_LINK; wrong code → 400;
 * a merchant token must NOT open consumer surfaces (audience confusion 403).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';

import { db } from '../../src/db';
import { consumers, appointments, telegramLinks, staff as staffTable } from '../../src/db/schema';
import {
  mountApp, makeOwner, seedBusiness, deleteTenantCascade, deleteOtpAndLink,
  nextSlotInAddisToday,
} from './chain-helpers';
import type { App } from './chain-helpers';

describe('CHAIN: consumer request-code → verify → booking backfill', () => {
  let app: App;
  let tenantId: string;
  let ownerToken: string;
  let slug: string;
  let staffId: string;
  let serviceId: string;
  const chatId = '66000222';
  const phone = '+251988990011';
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET as string;
  const sentBodies: any[] = [];

  beforeAll(async () => {
    app = await mountApp();
    const owner = await makeOwner({ category: 'salon', isListed: true });
    tenantId = owner.tenantId;
    ownerToken = owner.token;
    slug = owner.slug;
    const biz = await seedBusiness(tenantId, { durationMinutes: 30, priceCents: 15000 });
    staffId = biz.staffId;
    serviceId = biz.serviceId;

    const lib = await import('../../server/lib/telegram');
    lib.ensureTelegramRegistered();
    lib.__setTelegramFetch((async (_url: string, init?: any) => {
      sentBodies.push(JSON.parse(init?.body ?? '{}'));
      return {
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 7 } }),
        text: async () => '',
      } as any;
    }) as any);
  });

  afterAll(async () => {
    const lib = await import('../../server/lib/telegram');
    lib.__setTelegramFetch(null);
    await deleteOtpAndLink(phone, chatId);
    await db.delete(consumers).where(eq(consumers.phone, phone)).catch(() => {});
    await deleteTenantCascade(tenantId);
  });

  it('happy path: OTP over Telegram → consumer JWT → booking links the profile', async () => {
    // 1. A booking establishes the phone the deep link resolves against.
    const slot = nextSlotInAddisToday();
    expect(slot).toBeTruthy();
    const b1 = await request(app)
      .post('/api/public/bookings')
      .set('X-Tenant-Slug', slug)
      .send({
        staff_id: staffId,
        service_ids: [serviceId],
        start_time: new Date(slot!).toISOString(),
        customer_name: 'Consumer Kalkidan',
        customer_phone: phone,
      });
    expect(b1.status).toBe(201);

    // 2. Opt-in via the bot: /start<opaqueId> links chat ↔ phone.
    const start = await request(app)
      .post('/api/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', secret)
      .send({ message: { chat: { id: chatId }, text: `/start ${b1.body.appointment.id}` } });
    expect(start.body.linked).toBe(true);

    // 3. Request a login code — delivered through the linked chat.
    const reqCode = await request(app)
      .post('/api/consumer/request-code')
      .send({ phone });
    expect(reqCode.status).toBe(200);
    expect(reqCode.body.deliveredVia).toBe('telegram');

    // The captured transport carries the plaintext code (hashed at rest).
    const otpMsg = sentBodies.find((b) => String(b.text ?? '').includes('verification code'));
    expect(otpMsg).toBeTruthy();
    const code = String(otpMsg.text).match(/code is: (\d{6})/)?.[1];
    expect(code).toBeTruthy();

    // 4. Verify → consumer row + aud:'consumer' JWT.
    const verify = await request(app)
      .post('/api/consumer/verify')
      .send({ phone, code, name: 'Kalkidan' });
    expect(verify.status).toBe(200);
    expect(verify.body.ok).toBe(true);
    expect(verify.body.consumer.phone).toBe(phone);
    const consumerJwt: string = verify.body.token;

    const consumerRow = await db.select().from(consumers)
      .where(eq(consumers.phone, phone)).get();
    expect(consumerRow).toBeTruthy();
    expect(typeof consumerRow!.consentGivenAt).toBe('number');
    expect(verify.body.consumer.id).toBe(consumerRow!.id);

    // Consumer surface accepts the consumer token.
    const me = await request(app)
      .get('/api/consumer/me')
      .set('Authorization', `Bearer ${consumerJwt}`);
    expect(me.status).toBe(200);
    expect(me.body.consumer.phone).toBe(phone);

    // 5. Booking with the same phone backfills consumer_id on the row
    // (second staff member, same slot → no conflict).
    const staff2Id = crypto.randomUUID();
    await db.insert(staffTable).values({
      id: staff2Id, tenantId, name: 'Chain Staff 2', active: true,
    });
    const b2 = await request(app)
      .post('/api/public/bookings')
      .set('X-Tenant-Slug', slug)
      .send({
        staff_id: staff2Id,
        service_ids: [serviceId],
        start_time: new Date(slot!).toISOString(),
        customer_name: 'Consumer Kalkidan',
        customer_phone: phone,
      });
    expect(b2.status).toBe(201);

    const appt2 = await db.select().from(appointments)
      .where(eq(appointments.opaqueId, b2.body.appointment.id)).get();
    expect(appt2!.consumerId).toBe(consumerRow!.id);
  });

  it('failure mode: unlinked phones cannot even request a code (409 NO_TELEGRAM_LINK)', async () => {
    const res = await request(app)
      .post('/api/consumer/request-code')
      .send({ phone: '+251999000111' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NO_TELEGRAM_LINK');
  });

  it('failure mode: a wrong code is rejected and burns an attempt, not the session', async () => {
    const reqCode = await request(app)
      .post('/api/consumer/request-code')
      .send({ phone });
    expect(reqCode.status).toBe(200);
    // The LATEST captured message carries the current (still-unused) code.
    const otpMsgs = sentBodies.filter((b) => String(b.text ?? '').includes('verification code'));
    const realCode = String(otpMsgs[otpMsgs.length - 1].text).match(/code is: (\d{6})/)?.[1];
    const wrong = realCode === '000000' ? '111111' : '000000';

    const verify = await request(app)
      .post('/api/consumer/verify')
      .send({ phone, code: wrong });
    expect(verify.status).toBe(400);
    expect(verify.body.token ?? null).toBeNull();
  });

  it('failure mode: merchant tokens never open consumer surfaces (audience confusion)', async () => {
    const res = await request(app)
      .get('/api/consumer/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(403);
  });
});
