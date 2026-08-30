/**
 * CHAIN 18 (P3): Telegram webhook → secret verify → chat link.
 *
 *   POST /api/telegram/webhook (telegram.ts → telegram.verifyWebhookSecret
 *   timing-safe compare → telegram.linkChat upsert)
 *     → valid secret + /start<opaqueId> → chat linked to the booking's
 *       normalized phone, consent stamped, security event logged
 *     → invalid secret → 401 + security_events row, nothing linked
 *     → bare /start (no payload) → acked, linked:false, audit event.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';

import { db } from '../../src/db';
import { appointments, telegramLinks, securityEvents } from '../../src/db/schema';
import {
  mountApp, makeOwner, seedBusiness, deleteTenantCascade, nextSlotInAddisToday,
} from './chain-helpers';
import type { App } from './chain-helpers';

describe('CHAIN: telegram webhook → secret → link', () => {
  let app: App;
  let tenantId: string;
  let staffId: string;
  let serviceId: string;
  let opaqueId: string;
  const chatId = '77000333';
  const phone = '+251922114455';
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET as string;

  beforeAll(async () => {
    app = await mountApp();
    const owner = await makeOwner({ category: 'salon', isListed: true });
    tenantId = owner.tenantId;
    const biz = await seedBusiness(tenantId, { durationMinutes: 30, priceCents: 15000 });
    staffId = biz.staffId;
    serviceId = biz.serviceId;

    const slot = nextSlotInAddisToday();
    expect(slot).toBeTruthy();
    const res = await request(app)
      .post('/api/public/bookings')
      .set('X-Tenant-Slug', owner.slug)
      .send({
        staff_id: staffId,
        service_ids: [serviceId],
        start_time: new Date(slot!).toISOString(),
        customer_name: 'Secret Selam',
        customer_phone: phone,
      });
    expect(res.status).toBe(201);
    opaqueId = res.body.appointment.id;
  });

  afterAll(async () => {
    await db.delete(telegramLinks).where(eq(telegramLinks.chatId, chatId)).catch(() => {});
    await db.delete(securityEvents).where(eq(securityEvents.tenantId, tenantId)).catch(() => {});
    await deleteTenantCascade(tenantId);
  });

  it('happy path: valid secret + /start<opaqueId> links the chat to the phone', async () => {
    const res = await request(app)
      .post('/api/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', secret)
      .send({ message: { chat: { id: chatId }, text: `/start ${opaqueId}` } });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.linked).toBe(true);

    // DB side effect: consent-stamped link row.
    const link = await db.select().from(telegramLinks)
      .where(eq(telegramLinks.chatId, chatId)).get();
    expect(link).toBeTruthy();
    expect(link!.phone).toBe(phone); // normalized from the booking
    expect(typeof link!.consentGivenAt).toBe('number');
    expect(link!.tenantId).toBe(tenantId);

    // Audit trail: telegram_chat_linked logged for this tenant.
    const audit = await db.select().from(securityEvents)
      .where(eq(securityEvents.tenantId, tenantId)).all();
    expect(audit.some((e) => e.eventType === 'telegram_chat_linked')).toBe(true);
  });

  it('failure mode: wrong secret → 401 + security_events, nothing linked', async () => {
    const res = await request(app)
      .post('/api/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', 'not-the-real-secret')
      .send({ message: { chat: { id: '77000334' }, text: `/start ${opaqueId}` } });
    expect(res.status).toBe(401);

    const events = await db.select().from(securityEvents)
      .where(eq(securityEvents.eventType, 'webhook_signature_rejected')).all();
    // securityLog pre-stringifies details — parse defensively (shared table).
    const parseDetails = (d: any): any =>
      typeof d === 'string' ? JSON.parse(d) : d;
    const telegramRejects = events.filter(
      (e) => parseDetails(e.details)?.surface === 'telegram_webhook',
    );
    expect(telegramRejects.length).toBeGreaterThanOrEqual(1);

    const stray = await db.select().from(telegramLinks)
      .where(eq(telegramLinks.chatId, '77000334')).get();
    expect(stray ?? null).toBeNull();
  });

  it('failure mode: missing secret → 401', async () => {
    const res = await request(app)
      .post('/api/telegram/webhook')
      .send({ message: { chat: { id: chatId }, text: `/start ${opaqueId}` } });
    expect(res.status).toBe(401);
  });

  it('failure mode: bare /start without a booking reference acks without linking', async () => {
    const res = await request(app)
      .post('/api/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', secret)
      .send({ message: { chat: { id: '77000335' }, text: '/start' } });
    expect(res.status).toBe(200);
    expect(res.body.linked).toBe(false);

    const stray = await db.select().from(telegramLinks)
      .where(eq(telegramLinks.chatId, '77000335')).get();
    expect(stray ?? null).toBeNull();

    // Audit event recorded (telegram_start_no_payload).
    const events = await db.select().from(securityEvents)
      .where(eq(securityEvents.eventType, 'telegram_start_no_payload')).all();
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('sanity: the referenced booking still exists with its phone intact', async () => {
    const appt = await db.select().from(appointments)
      .where(eq(appointments.opaqueId, opaqueId)).get();
    expect(appt).toBeTruthy();
    expect(appt!.customerPhone).toBe(phone);
  });
});
