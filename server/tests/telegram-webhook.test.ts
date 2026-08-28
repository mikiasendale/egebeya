/**
 * P3.2 — Telegram bot channel + webhook tests.
 *
 * Acceptance coverage:
 *   - start (deep-link /start <opaqueId>) links chat to normalized phone
 *   - confirm + reminder dispatches ride the linked channel
 *   - no send attempted to unlinked users (status 'unlinked', zero HTTP)
 *   - secret mismatch → 401 logged to security_events
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';

import { db } from '../../src/db';
import {
  tenants, services as servicesTable, staff, appointments,
  telegramLinks, securityEvents,
} from '../../src/db/schema';
import { eq } from 'drizzle-orm';

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET!;

// ── Outbound Telegram transport spy ─────────────────────────────────────
const sentMessages: Array<{ url: string; body: any }> = [];
vi.mock('../lib/notifications', async (importOriginal) => {
  // Real adapter — but force-register the telegram channel for this suite
  // regardless of module-load ordering.
  const actual = await importOriginal<any>();
  return actual;
});
import { notify } from '../lib/notifications';
import { __setTelegramFetch, ensureTelegramRegistered, buildTelegramDeepLink } from '../lib/telegram';

ensureTelegramRegistered();
__setTelegramFetch(async (url: any, init: any) => {
  sentMessages.push({ url: String(url), body: JSON.parse(init.body) });
  return new Response(JSON.stringify({ ok: true, result: { message_id: 42 } }), { status: 200 });
});

const app = express();
app.use(express.json());
const { default: telegramRoutes } = await import('../../src/api/telegram');
app.use('/api/telegram', telegramRoutes);

describe('Telegram webhook + channel (P3.2)', () => {
  const slug = `tg-${Date.now()}`;
  let tenantId: string;
  let svcId: string;
  let staffId: string;
  let opaqueId: string;
  const CHAT_ID = '555001';
  // Deliberately NON-canonical input form to prove normalization at link time.
  const RAW_PHONE = '0911223344';
  const CANONICAL_PHONE = '+251911223344';

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    svcId = crypto.randomUUID();
    staffId = crypto.randomUUID();
    await db.insert(tenants).values({
      id: tenantId, name: 'TG Salon', slug,
      settings: { defaultLocale: 'am' }, createdAt: Date.now(),
    });
    await db.insert(servicesTable).values({ id: svcId, tenantId, name: 'Cut', durationMinutes: 30, price: 20000, active: true });
    await db.insert(staff).values({ id: staffId, tenantId, name: 'Stylist', active: true });

    opaqueId = crypto.randomBytes(16).toString('hex');
    const start = Date.now() + 2 * 3600 * 1000;
    await db.insert(appointments).values({
      id: crypto.randomUUID(), tenantId,
      customerName: 'TG Customer', customerPhone: RAW_PHONE,
      customerEmail: null, staffId, serviceId: svcId,
      startTime: start, endTime: start + 1800_000,
      status: 'confirmed', reminderSent: false, opaqueId,
    });
  });

  afterAll(async () => {
    await db.delete(appointments).where(eq(appointments.tenantId, tenantId)).catch(() => {});
    await db.delete(telegramLinks).where(eq(telegramLinks.chatId, CHAT_ID)).catch(() => {});
    await db.delete(securityEvents).where(eq(securityEvents.eventType, 'telegram_chat_linked')).catch(() => {});
    await db.delete(securityEvents).where(eq(securityEvents.eventType, 'webhook_signature_rejected')).catch(() => {});
    await db.delete(staff).where(eq(staff.id, staffId)).catch(() => {});
    await db.delete(servicesTable).where(eq(servicesTable.id, svcId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
    __setTelegramFetch(null);
  });

  it('rejects webhook calls with a missing/mismatched secret token → 401 + security_events', async () => {
    const res = await request(app)
      .post('/api/telegram/webhook')
      .send({ message: { text: '/start', chat: { id: CHAT_ID } } });
    expect(res.status).toBe(401);

    const res2 = await request(app)
      .post('/api/telegram/webhook')
      .set('x-telegram-bot-api-secret-token', 'wrong-secret')
      .send({});
    expect(res2.status).toBe(401);

    const evt = await db.select().from(securityEvents)
      .where(eq(securityEvents.eventType, 'webhook_signature_rejected'))
      .all();
    expect(evt.length).toBeGreaterThanOrEqual(1);
  });

  it('links the chat via /start <opaqueId> and normalizes the phone', async () => {
    expect(buildTelegramDeepLink(opaqueId)).toContain(`?start=${opaqueId}`);

    const res = await request(app)
      .post('/api/telegram/webhook')
      .set('x-telegram-bot-api-secret-token', WEBHOOK_SECRET)
      .send({ update_id: 1, message: { text: `/start ${opaqueId}`, chat: { id: CHAT_ID } } });

    expect(res.status).toBe(200);
    expect(res.body.linked).toBe(true);

    const link = await db.select().from(telegramLinks)
      .where(eq(telegramLinks.chatId, CHAT_ID)).get();
    expect(link).toBeTruthy();
    expect(link!.phone).toBe(CANONICAL_PHONE); // normalized via src/lib/phone.ts
    expect(link!.tenantId).toBe(tenantId);
    expect(link!.consentGivenAt).toBeGreaterThan(0);
  });

  it('is idempotent on repeated /start (upsert per chat)', async () => {
    const res = await request(app)
      .post('/api/telegram/webhook')
      .set('x-telegram-bot-api-secret-token', WEBHOOK_SECRET)
      .send({ update_id: 2, message: { text: `/start ${opaqueId}`, chat: { id: CHAT_ID } } });
    expect(res.status).toBe(200);
    expect(res.body.linked).toBe(true);

    const rows = await db.select().from(telegramLinks)
      .where(eq(telegramLinks.chatId, CHAT_ID)).all();
    expect(rows.length).toBe(1);
  });

  it('delivers booking confirmation through the channel when linked', async () => {
    sentMessages.length = 0;
    const outcome = await notify({
      channel: 'telegram',
      template: 'bookingCustomer',
      to: { phone: CANONICAL_PHONE },
      text: 'ቀጠሮዎ ተመዝግቧል',
      tenantId,
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.status).toBe('sent');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].body.chat_id).toBe(CHAT_ID);
  });

  it('NEVER attempts a send to an unlinked phone', async () => {
    sentMessages.length = 0;
    const outcome = await notify({
      channel: 'telegram',
      template: 'bookingCustomer',
      to: { phone: '+251999999999' },
      text: 'should not deliver',
      tenantId,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.status).toBe('unlinked');
    expect(sentMessages.length).toBe(0);
  });

  it('reminder cron dispatches through telegram for linked customers', async () => {
    sentMessages.length = 0;
    const { runOnce } = await import('../cron/sendReminders');

    // Fresh in-window appointment for the LINKED phone.
    const start = Date.now() + 2 * 3600 * 1000 + 10_000;
    const apptId = crypto.randomUUID();
    await db.insert(appointments).values({
      id: apptId, tenantId,
      customerName: 'Linked Customer', customerPhone: CANONICAL_PHONE,
      customerEmail: null, staffId, serviceId: svcId,
      startTime: start, endTime: start + 1800_000,
      status: 'confirmed', reminderSent: false, opaqueId: crypto.randomBytes(16).toString('hex'),
    });

    await runOnce(tenantId);

    const tgCalls = sentMessages.filter((m) => m.body.text.toLowerCase().includes('reminder') || m.url.includes('sendMessage'));
    expect(tgCalls.length).toBeGreaterThanOrEqual(1);

    const after = await db.select().from(appointments).where(eq(appointments.id, apptId)).get();
    expect(after?.reminderSent).toBe(true);

    await db.delete(appointments).where(eq(appointments.id, apptId));
  });
});
