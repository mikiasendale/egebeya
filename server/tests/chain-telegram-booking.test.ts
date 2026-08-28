/**
 * CHAIN 12 (P3.2): booking → Telegram link → reminder send.
 *
 *   POST /api/telegram/webhook /start<opaqueId> (telegram.ts → telegram.linkChat)
 *     → telegram_links row stamped with consent
 *     → POST /api/public/bookings → notifications.notify({channel:'telegram'})
 *       → sendMessage to the linked chat → notification_log row
 *         channel='telegram', status='sent'.
 *
 * Failure mode: an UNLINKED phone resolves to status 'unlinked' with NO
 * provider call (the bot cannot initiate contact).
 *
 * Transport uses the lib's official __setTelegramFetch test seam (captures
 * the API call instead of hitting api.telegram.org).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';

import { db } from '../../src/db';
import { telegramLinks, notificationLog, staff as staffTable } from '../../src/db/schema';
import {
  mountApp, makeOwner, seedBusiness, deleteTenantCascade, deleteOtpAndLink,
  waitFor, nextSlotInAddisToday,
} from './chain-helpers';
import type { App } from './chain-helpers';

describe('CHAIN: booking → telegram link → reminder send', () => {
  let app: App;
  let tenantId: string;
  let slug: string;
  let staffId: string;
  let serviceId: string;
  const chatId = '55000111';
  const phone = '+251977889900';
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET as string;
  const sentBodies: any[] = [];

  beforeAll(async () => {
    app = await mountApp();
    const owner = await makeOwner({ category: 'salon', isListed: true });
    tenantId = owner.tenantId;
    slug = owner.slug;
    const biz = await seedBusiness(tenantId, { durationMinutes: 30, priceCents: 15000 });
    staffId = biz.staffId;
    serviceId = biz.serviceId;

    // Official test seam: capture the Telegram API call.
    const lib = await import('../../server/lib/telegram');
    lib.ensureTelegramRegistered();
    lib.__setTelegramFetch((async (_url: string, init?: any) => {
      sentBodies.push(JSON.parse(init?.body ?? '{}'));
      return {
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 42 } }),
        text: async () => '',
      } as any;
    }) as any);
  });

  afterAll(async () => {
    const lib = await import('../../server/lib/telegram');
    lib.__setTelegramFetch(null);
    await deleteOtpAndLink(phone, chatId);
    await deleteTenantCascade(tenantId);
  });

  it('happy path: /start links the chat; the booking notice lands as sent', async () => {
    // 1. Booking #1 while UNLINKED — its notice must record 'unlinked'.
    const slot = nextSlotInAddisToday();
    expect(slot).toBeTruthy();
    const b1 = await request(app)
      .post('/api/public/bookings')
      .set('X-Tenant-Slug', slug)
      .send({
        staff_id: staffId,
        service_ids: [serviceId],
        start_time: new Date(slot!).toISOString(),
        customer_name: 'Tg Link Tamru',
        customer_phone: phone,
      });
    expect(b1.status).toBe(201);
    expect(b1.body.appointment.telegramDeepLink).toContain('t.me/');

    const unlinkedRow = await waitFor(() =>
      db.select().from(notificationLog).where(and(
        eq(notificationLog.tenantId, tenantId),
        eq(notificationLog.channel, 'telegram'),
        eq(notificationLog.status, 'unlinked'),
      )).get());
    expect(unlinkedRow).toBeTruthy(); // unlinked phone → no provider call

    // 2. The customer taps the deep link: Telegram pushes /start<opaqueId>.
    const start = await request(app)
      .post('/api/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', secret)
      .send({
        message: { chat: { id: chatId }, text: `/start ${b1.body.appointment.id}` },
      });
    expect(start.status).toBe(200);
    expect(start.body.linked).toBe(true);

    const link = await db.select().from(telegramLinks)
      .where(eq(telegramLinks.chatId, chatId)).get();
    expect(link!.phone).toBe(phone);
    expect(typeof link!.consentGivenAt).toBe('number'); // P3.7 consent stamp
    expect(link!.tenantId).toBe(tenantId);

    // 3. Booking #2 while LINKED (second staff member, same slot) — the
    // notice now dispatches to the linked chat.
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
        customer_name: 'Tg Link Tamru',
        customer_phone: phone,
      });
    expect(b2.status).toBe(201);

    const sentRow = await waitFor(() =>
      db.select().from(notificationLog).where(and(
        eq(notificationLog.tenantId, tenantId),
        eq(notificationLog.channel, 'telegram'),
        eq(notificationLog.status, 'sent'),
      )).get());
    expect(sentRow).toBeTruthy();
    expect(sentRow!.refType).toBe('appointment');
    expect(sentRow!.refId).toBeTruthy();

    // 4. The provider actually received the linked chat id.
    expect(sentBodies.length).toBeGreaterThan(0);
    expect(sentBodies.some((b) => b.chat_id === chatId)).toBe(true);
  });

  it('failure mode: unknown deep-link reference is acked without linking', async () => {
    const res = await request(app)
      .post('/api/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', secret)
      .send({
        message: { chat: { id: '55000112' }, text: `/start ${crypto.randomBytes(16).toString('hex')}` },
      });
    expect(res.status).toBe(200);
    expect(res.body.linked).toBe(false);

    const stray = await db.select().from(telegramLinks)
      .where(eq(telegramLinks.chatId, '55000112')).get();
    expect(stray ?? null).toBeNull(); // nothing linked on a bad reference
  });
});
