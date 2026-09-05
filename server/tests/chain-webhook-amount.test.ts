/**
 * S-10 fix: the webhook asserts the PROVIDER-verified amount against the
 * payment row before applying any status effect.
 *
 *   verify success + amount matches  → proceeds exactly as before
 *   verify success + amount mismatch → 200 idempotent no-op, ZERO side
 *                                      effects, security_events trail,
 *                                      NO processedWebhookEvents marker
 *   verify success + unusable amount → status-only (current behavior)
 *
 * verifyPayment is partially mocked (real chapa lib otherwise) because a
 * live verify call needs real Chapa credentials + network.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';

vi.mock('../../server/lib/chapa', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    verifyPayment: vi.fn(),
  };
});

import { db } from '../../src/db';
import {
  appointments, payments, processedWebhookEvents, securityEvents,
} from '../../src/db/schema';
import { mountApp, signWebhook, deleteTenantCascade } from './chain-helpers';
import { verifyPayment } from '../../server/lib/chapa';
import type { App } from './chain-helpers';

const mockedVerify = verifyPayment as unknown as ReturnType<typeof vi.fn>;

describe('CHAIN: webhook verified-amount assertion (S-10)', () => {
  let app: App;
  let tenantId: string;
  let appointmentId: string;
  let paymentId: string;
  let txRef: string;
  const customerPhone = '+251911777666';
  // payment row: 10000 cents = 100.00 birr
  const amountCents = 10000;

  beforeAll(async () => {
    delete process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    app = await mountApp();
    const { makeOwner, seedBusiness } = await import('./chain-helpers');
    const owner = await makeOwner();
    tenantId = owner.tenantId;
    const biz = await seedBusiness(owner.tenantId, { durationMinutes: 30, priceCents: amountCents });
    staffId = biz.staffId;
    serviceId = biz.serviceId;

    const slotMs = Date.now() + 5 * 24 * 3600 * 1000;
    appointmentId = crypto.randomUUID();
    await db.insert(appointments).values({
      id: appointmentId,
      tenantId,
      customerName: 'Amount Assertions',
      customerPhone,
      staffId,
      serviceId,
      startTime: slotMs,
      endTime: slotMs + 30 * 60 * 1000,
      status: 'pending',
      reminderSent: false,
      opaqueId: crypto.randomBytes(16).toString('hex'),
    });

    txRef = `TX-s10-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    paymentId = crypto.randomUUID();
    await db.insert(payments).values({
      id: paymentId,
      tenantId,
      appointmentId,
      amount: amountCents,
      gateway: 'chapa',
      method: 'telebirr',
      gatewayReference: txRef,
      status: 'pending',
    });
  });

  let staffId: string;
  let serviceId: string;

  afterAll(async () => {
    await deleteTenantCascade(tenantId);
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    await db.delete(processedWebhookEvents).where(eq(processedWebhookEvents.txRef, txRef));
    await db.update(payments).set({ status: 'pending', meta: null }).where(eq(payments.id, paymentId));
    await db.update(appointments).set({ status: 'pending' }).where(eq(appointments.id, appointmentId));
    mockedVerify.mockReset();
  });

  function post(body: any) {
    const bodyStr = JSON.stringify(body);
    return request(app).post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-chapa-signature', signWebhook(bodyStr))
      .send(bodyStr);
  }

  it('matching verified amount (number, birr) → proceeds normally', async () => {
    mockedVerify.mockResolvedValue({
      status: 'success',
      amount: '100.00',
      tx_ref: txRef,
      raw: { status: 'success', data: { amount: 100, status: 'success', tx_ref: txRef } },
    });

    const res = await post({ tx_ref: txRef, status: 'success' });
    expect(res.status).toBe(200);
    expect(res.body.ignored).toBeUndefined();

    const pay = await db.select().from(payments).where(eq(payments.id, paymentId)).get();
    expect(pay!.status).toBe('completed');
    const appt = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).get();
    expect(appt!.status).toBe('confirmed');
    const marker = await db.select().from(processedWebhookEvents).where(eq(processedWebhookEvents.txRef, txRef)).get();
    expect(marker).toBeTruthy();
  });

  it('mismatched verified amount → 200 idempotent no-op, no side effects, no marker, security event', async () => {
    mockedVerify.mockResolvedValue({
      status: 'success',
      amount: '1.00',
      tx_ref: txRef,
      raw: { status: 'success', data: { amount: 1, status: 'success', tx_ref: txRef } },
    });

    const res = await post({ tx_ref: txRef, status: 'success' });
    expect(res.status).toBe(200);
    expect(res.body.ignored).toBe('amount_mismatch');

    const pay = await db.select().from(payments).where(eq(payments.id, paymentId)).get();
    expect(pay!.status).toBe('pending');
    const appt = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).get();
    expect(appt!.status).toBe('pending');
    const markers = await db.select().from(processedWebhookEvents).where(eq(processedWebhookEvents.txRef, txRef)).all();
    expect(markers.length).toBe(0);

    const events = await db.select().from(securityEvents).where(eq(securityEvents.eventType, 'webhook_amount_mismatch')).all();
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('unusable/absent verified amount → current status-only behavior preserved', async () => {
    mockedVerify.mockResolvedValue({
      status: 'success',
      amount: '',
      tx_ref: txRef,
      raw: { status: 'success', data: { amount: null, status: 'success', tx_ref: txRef } },
    });

    const res = await post({ tx_ref: txRef, status: 'success' });
    expect(res.status).toBe(200);
    expect(res.body.ignored).toBeUndefined();

    const pay = await db.select().from(payments).where(eq(payments.id, paymentId)).get();
    expect(pay!.status).toBe('completed');
  });
});
