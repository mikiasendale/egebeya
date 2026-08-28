/**
 * CHAIN 17 (P1/P3): Chapa webhook → HMAC verify → idempotency.
 *
 *   POST /api/payments/webhook (payments.ts → chapa.getWebhookSecret →
 *   timing-safe HMAC → processedWebhookEvents UNIQUE guard → transactional
 *   side effects)
 *     → valid signature: appointment confirmed + subscription activated
 *     → invalid signature: 401 + security_events row, ZERO side effects
 *     → duplicate eventId: { duplicate: true }, no second side effect.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { eq, and, inArray } from 'drizzle-orm';

import { db } from '../../src/db';
import {
  tenants, users, services, staff, tenantBusinessHours, appointments,
  payments, processedWebhookEvents, securityEvents, invoices,
  tenantSubscriptions,
} from '../../src/db/schema';
import { mountApp, signWebhook, deleteTenantCascade } from './chain-helpers';
import type { App } from './chain-helpers';

describe('CHAIN: Chapa webhook → HMAC → idempotency', () => {
  let app: App;
  let tenantId: string;
  let staffId: string;
  let serviceId: string;
  let appointmentId: string;
  let paymentId: string;
  let txRef: string;
  const customerPhone = '+251911999888';

  // No CHAPA_SECRET_KEY → verifyPayment falls back to the declared status
  // (webhook.test.ts pattern); the HMAC layer under test stays real.
  let savedSecretKey: string | undefined;

  beforeAll(async () => {
    savedSecretKey = process.env.CHAPA_SECRET_KEY;
    delete process.env.CHAPA_SECRET_KEY;
    delete process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    app = await mountApp();
    const owner = await makeOwnerSeed();
    tenantId = owner.tenantId;
    staffId = owner.staffId;
    serviceId = owner.serviceId;

    const slotMs = Date.now() + 6 * 24 * 3600 * 1000;
    appointmentId = crypto.randomUUID();
    await db.insert(appointments).values({
      id: appointmentId,
      tenantId,
      customerName: 'Webhook Winta',
      customerPhone,
      staffId,
      serviceId,
      startTime: slotMs,
      endTime: slotMs + 30 * 60 * 1000,
      status: 'pending',
      reminderSent: false,
      opaqueId: crypto.randomBytes(16).toString('hex'),
    });

    txRef = `TX-chain17-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    paymentId = crypto.randomUUID();
    await db.insert(payments).values({
      id: paymentId,
      tenantId,
      appointmentId,
      amount: 10000,
      gateway: 'chapa',
      method: 'telebirr',
      gatewayReference: txRef,
      status: 'pending',
    });
  });

  afterAll(async () => {
    await deleteTenantCascade(tenantId);
    if (savedSecretKey !== undefined) process.env.CHAPA_SECRET_KEY = savedSecretKey;
  });

  beforeEach(async () => {
    await db.delete(processedWebhookEvents).where(eq(processedWebhookEvents.txRef, txRef));
    await db.update(payments).set({ status: 'pending', meta: null })
      .where(eq(payments.id, paymentId));
    await db.update(appointments).set({ status: 'pending' })
      .where(eq(appointments.id, appointmentId));
  });

  function post(body: any, signature?: string) {
    const bodyStr = JSON.stringify(body);
    const req = request(app).post('/api/payments/webhook')
      .set('Content-Type', 'application/json');
    if (signature !== undefined) req.set('x-chapa-signature', signature);
    return req.send(bodyStr);
  }

  it('happy path: valid HMAC processes the charge end-to-end', async () => {
    const res = await post({ tx_ref: txRef, status: 'success' }, signWebhook(JSON.stringify({ tx_ref: txRef, status: 'success' })));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const appt = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).get();
    expect(appt!.status).toBe('confirmed');
    const pay = await db.select().from(payments).where(eq(payments.id, paymentId)).get();
    expect(pay!.status).toBe('completed');

    const marker = await db.select().from(processedWebhookEvents)
      .where(eq(processedWebhookEvents.txRef, txRef)).get();
    expect(marker).toBeTruthy();
    expect(marker!.action).toBe('completed');
  });

  it('failure mode: an invalid signature is a 401 forgery with a security_events row and NO side effects', async () => {
    const forged = signWebhook(JSON.stringify({ tx_ref: txRef, status: 'success' }) + 'tampered');
    const res = await post({ tx_ref: txRef, status: 'success' }, forged);
    expect(res.status).toBe(401);

    const events = await db.select().from(securityEvents)
      .where(eq(securityEvents.eventType, 'webhook_signature_rejected')).all();
    // securityLog pre-stringifies details, so drizzle's json mode hands back
    // a JSON string — parse defensively before filtering (shared table).
    const parseDetails = (d: any): any =>
      typeof d === 'string' ? JSON.parse(d) : d;
    const invalidSig = events.filter(
      (e) => parseDetails(e.details)?.reason === 'invalid signature',
    );
    expect(invalidSig.length).toBeGreaterThanOrEqual(1);

    // No side effects anywhere.
    const appt = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).get();
    expect(appt!.status).toBe('pending');
    const pay = await db.select().from(payments).where(eq(payments.id, paymentId)).get();
    expect(pay!.status).toBe('pending');
    const markers = await db.select().from(processedWebhookEvents)
      .where(eq(processedWebhookEvents.txRef, txRef)).all();
    expect(markers.length).toBe(0);
  });

  it('failure mode: a missing signature is rejected the same way', async () => {
    const res = await post({ tx_ref: txRef, status: 'success' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Missing webhook signature/);
  });

  it('failure mode: duplicate eventId short-circuits with no second side effect', async () => {
    const body = { tx_ref: txRef, status: 'success' };

    const first = await post(body, signWebhook(JSON.stringify(body)));
    expect(first.status).toBe(200);
    expect(first.body.duplicate ?? false).toBe(false);

    const apptAfterFirst = (await db.select().from(appointments)
      .where(eq(appointments.id, appointmentId)).get())!.status;
    expect(apptAfterFirst).toBe('confirmed');

    // Reset only the payment (not the marker) to prove the guard blocks.
    await db.update(payments).set({ status: 'pending' }).where(eq(payments.id, paymentId));
    await db.update(appointments).set({ status: 'pending' }).where(eq(appointments.id, appointmentId));

    const replay = await post(body, signWebhook(JSON.stringify(body)));
    expect(replay.status).toBe(200);
    expect(replay.body.duplicate).toBe(true);

    // Replay did NOT reprocess: statuses stay as the baseline reset left them.
    const payAfter = await db.select().from(payments).where(eq(payments.id, paymentId)).get();
    expect(payAfter!.status).toBe('pending');
    const apptAfter = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).get();
    expect(apptAfter!.status).toBe('pending');
  });

  // Local seed helper shared by this file only.
  async function makeOwnerSeed(): Promise<{ tenantId: string; staffId: string; serviceId: string }> {
    const owner = await (await import('./chain-helpers')).makeOwner();
    const biz = await (await import('./chain-helpers')).seedBusiness(owner.tenantId, { durationMinutes: 30, priceCents: 10000 });
    void tenants; void users; void services; void staff; void tenantBusinessHours;
    void tenantSubscriptions; void invoices; void inArray; void and;
    return { tenantId: owner.tenantId, staffId: biz.staffId, serviceId: biz.serviceId };
  }
});
