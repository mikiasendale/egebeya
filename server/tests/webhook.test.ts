/**
 * Payment webhook security tests — forgeries + replay/idempotency.
 *
 * Mounts the exact same `express.json({ verify: ... })` raw-body capture
 * that production uses, so HMAC verification runs against the actual
 * bytes Chapa would sign (not against a re-serialised `req.body`).
 *
 * The webhook secret is fixed at the test fallback so we can compute
 * signatures deterministically.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import { getWebhookSecret } from '../../server/lib/chapa';
import {
  tenants,
  users,
  services,
  staff,
  appointments,
  payments,
  tenantBusinessHours,
  processedWebhookEvents,
} from '../../src/db/schema';

// Mirror server.ts: capture the raw body buffer for HMAC verification.
const app = express();
app.use(express.json({
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf;
  },
}));
app.use('/api', apiRoutes);

// Force the test-mode secret fallback so signatures are deterministic.
const WEBHOOK_SECRET = (() => {
  try { return getWebhookSecret(); } catch { return 'CyNDCzoXF7JsaPig6GErkdT0'; }
})();

function sign(rawBody: string, secret: string = WEBHOOK_SECRET): string {
  return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

interface PostOptions {
  body: any;
  signatureHeader?: string;
  headerName?: 'x-chapa-signature' | 'chapa-signature';
  rawOverride?: Buffer | string;
}

/**
 * Helper: send a JSON body with a properly HMAC-signed Chapa header.
 *
 * `signatureHeader` semantics:
 *   - omitted / undefined → caller did not opt into a header (used by
 *     the "no signature at all" tests, where we want to send ZERO
 *     signature headers).
 *   - non-empty string        → that exact string is sent as the value
 *     (used by the forged-signature tests, where we want an obviously
 *     wrong HMAC value to assert rejection).
 *   - empty string ('') → the header field is omitted entirely.
 *
 * For all other tests (the "valid signature" ones), the helper computes
 * the correct HMAC over the bytes the request body will hold and sends
 * it on whichever header name the caller asked for.
 *
 * Implementation note: we send the body as a UTF-8 STRING, not a Buffer.
 * supertest's `.send(buffer)` with Content-Type:application/json actually
 * JSON-encodes the Buffer on the wire (Node's JSON.stringify on a Buffer
 * triggers `Buffer.prototype.toJSON()` → {type:'Buffer', data:[...]}), so
 * the bytes that hit the server are NOT the original Buffer payload.
 * Sending a string passes through unchanged.
 */
function postWebhook(opts: PostOptions) {
  let bodyStr: string;
  if (opts.rawOverride !== undefined) {
    bodyStr = typeof opts.rawOverride === 'string'
      ? opts.rawOverride
      : opts.rawOverride.toString('utf8');
  } else {
    bodyStr = JSON.stringify(opts.body);
  }

  // The signature must be over the bytes the provider actually signed.
  const validSignature = sign(bodyStr);

  let req = request(app).post('/api/payments/webhook');

  if (opts.signatureHeader === '') {
    // Caller opted out of any signature header.
  } else if (opts.signatureHeader !== undefined) {
    req = req.set(opts.headerName || 'x-chapa-signature', opts.signatureHeader);
  } else {
    // Default: send a freshly-computed valid HMAC on the chosen header.
    req = req.set(opts.headerName || 'x-chapa-signature', validSignature);
  }
  return req.set('Content-Type', 'application/json').send(bodyStr);
}

describe('Payment webhook security', () => {
  const slug = `webhook-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  let tenantId: string;
  let staffId: string;
  let serviceId: string;
  let appointmentId: string;
  let paymentId: string;
  let txRef: string;
  const customerPhone = '+251911000777';

  beforeAll(async () => {
    if (!process.env.NODE_ENV) process.env.NODE_ENV = 'test';
    // Ensure test-mode is engaged (no live CHAPA_SECRET_KEY).
    delete process.env.CHAPA_SECRET_KEY;
    delete process.env.NODE_ENV; // ensures NODE_ENV !== 'production'
    process.env.NODE_ENV = 'test';

    tenantId = crypto.randomUUID();
    staffId = crypto.randomUUID();
    serviceId = crypto.randomUUID();
    appointmentId = crypto.randomUUID();
    paymentId = crypto.randomUUID();

    const userId = crypto.randomUUID();
    const phone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    const pwHash = await bcrypt.hash('pass1234', 10);

    await db.insert(tenants).values({
      id: tenantId,
      name: 'Webhook Probe',
      slug,
      settings: { require_payment_upfront: false },
      createdAt: Date.now(),
    });
    await db.insert(users).values({
      id: userId,
      tenantId,
      name: 'Webhook Owner',
      phone,
      email: `webhook-${slug}@egebeya.test`,
      passwordHash: pwHash,
      role: 'owner',
      createdAt: Date.now(),
    });
    await db.insert(services).values({
      id: serviceId,
      tenantId,
      name: 'Webhook Service',
      durationMinutes: 30,
      price: 10000,
      active: true,
    });
    await db.insert(staff).values({
      id: staffId,
      tenantId,
      name: 'Webhook Staff',
      active: true,
    });
    for (let d = 0; d <= 6; d++) {
      await db.insert(tenantBusinessHours).values({
        id: crypto.randomUUID(),
        tenantId,
        dayOfWeek: d,
        openTime: '09:00',
        closeTime: '17:00',
        isClosed: false,
      });
    }

    const futureSlot = new Date(Date.now() + 6 * 24 * 3600 * 1000);
    const slotMs = Date.UTC(
      futureSlot.getUTCFullYear(),
      futureSlot.getUTCMonth(),
      futureSlot.getUTCDate(),
      11, 0, 0, 0,
    );
    await db.insert(appointments).values({
      id: appointmentId,
      tenantId,
      customerName: 'Webhook Customer',
      customerPhone,
      staffId,
      serviceId,
      startTime: slotMs,
      endTime: slotMs + 30 * 60 * 1000,
      status: 'pending',
    });

    txRef = `TX-webhook-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
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
    await db.delete(processedWebhookEvents).where(eq(processedWebhookEvents.txRef, txRef));
    await db.delete(payments).where(eq(payments.id, paymentId));
    await db.delete(appointments).where(eq(appointments.id, appointmentId));
    await db.delete(tenantBusinessHours).where(eq(tenantBusinessHours.tenantId, tenantId));
    await db.delete(services).where(eq(services.tenantId, tenantId));
    await db.delete(staff).where(eq(staff.tenantId, tenantId));
    await db.delete(users).where(eq(users.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  beforeEach(async () => {
    // Wipe any processed_webhook_events rows from the previous test so the
    // duplicate-detection logic in the next it() isn't poisoned.
    await db.delete(processedWebhookEvents)
      .where(eq(processedWebhookEvents.txRef, txRef));
    // Reset payment + appointment status so each replay scenario starts
    // from the same baseline.
    await db.update(payments)
      .set({ status: 'pending', meta: null })
      .where(eq(payments.id, paymentId));
    await db.update(appointments)
      .set({ status: 'pending' })
      .where(eq(appointments.id, appointmentId));
  });

  // ----------------- Part A: signature verification -----------------

  describe('Signature verification', () => {
    it('rejects a forged webhook with no signature header (401)', async () => {
      // signatureHeader === '' is the explicit "send no header at all"
      // sentinel; the default behaviour of postWebhook() would otherwise
      // attach a valid HMAC signature.
      const res = await postWebhook({
        body: { tx_ref: txRef, status: 'success' },
        signatureHeader: '',
      });
      // Header omitted entirely; the handler should treat this as a forged
      // drop-payload and refuse to process.
      expect(res.status).toBe(401);
      expect(String(res.body.error || '').toLowerCase()).toMatch(/signature/);
    });

    it('rejects a forged webhook with a non-blank garbage signature (401)', async () => {
      const res = await postWebhook({
        body: { tx_ref: txRef, status: 'success' },
        signatureHeader: '0000000000000000000000000000000000000000000000000000000000000000',
      });
      expect(res.status).toBe(401);
    });

    it('rejects when the signature was computed against different bytes (403/401)', async () => {
      // Compute the signature against the ORIGINAL body, but actually
      // send a different tampered body. The HMAC will not match the
      // actual body bytes that hit the server.
      const originalBody = JSON.stringify({ tx_ref: txRef, status: 'success' });
      const tamperedBody = JSON.stringify({
        tx_ref: txRef, status: 'failed', tampered: true,
      });
      const signature = sign(originalBody);

      const res = await request(app)
        .post('/api/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-chapa-signature', signature)
        .send(tamperedBody);

      // Either 401 (handler prefers 401) or 403 are both acceptable as
      // long as the payment is NOT mutated.
      expect([401, 403]).toContain(res.status);

      const after = await db.select().from(payments)
        .where(eq(payments.id, paymentId)).get();
      expect(after?.status).toBe('pending');
    });

    it('accepts a valid signature on x-chapa-signature (200)', async () => {
      const res = await postWebhook({
        body: { tx_ref: txRef, status: 'success', reference: `ref-${Date.now()}` },
        headerName: 'x-chapa-signature',
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('accepts a valid signature on the alternate chapa-signature header (200)', async () => {
      const res = await postWebhook({
        body: { tx_ref: txRef, status: 'success', reference: `ref-alt-${Date.now()}` },
        headerName: 'chapa-signature',
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects webhook payload missing tx_ref (400)', async () => {
      const res = await postWebhook({
        body: { status: 'completed' },
      });
    expect(res.status).toBe(400);
    expect(String(res.body.error || '')).toMatch(/tx_ref/i);
  });

    it('does NOT mutate state when signature is bad', async () => {
      await postWebhook({
        body: { tx_ref: txRef, status: 'success', reference: `must-not-apply-${Date.now()}` },
        signatureHeader: 'deadbeef'.repeat(8),
      });
      const payment = await db.select().from(payments)
        .where(eq(payments.id, paymentId)).get();
      const appt = await db.select().from(appointments)
        .where(eq(appointments.id, appointmentId)).get();
      expect(payment?.status).toBe('pending');
      expect(appt?.status).toBe('pending');
    });
  });

  // ----------------- Part A: idempotency on replay -----------------

  describe('Replay / idempotency', () => {
    it('a duplicated webhook delivery only mutates state once', async () => {
      const tx = txRef;
      const eventRef = `dup-ref-${Date.now()}`;
      const body = { tx_ref: tx, status: 'success', reference: eventRef };

      // First delivery: should mutate payment → completed AND appointment
      // → confirmed, AND insert a processed_webhook_events row.
      const first = await postWebhook({ body });
      expect(first.status).toBe(200);
      expect(first.body.success).toBe(true);

      const paymentAfterFirst = await db.select().from(payments)
        .where(eq(payments.id, paymentId)).get();
      expect(paymentAfterFirst?.status).toBe('completed');
      const apptAfterFirst = await db.select().from(appointments)
        .where(eq(appointments.id, appointmentId)).get();
      expect(apptAfterFirst?.status).toBe('confirmed');

      const eventsAfterFirst = await db.select().from(processedWebhookEvents)
        .where(eq(processedWebhookEvents.txRef, tx)).all();
      expect(eventsAfterFirst.length).toBe(1);

      // Second delivery: the SAME event_id (we re-send the SAME reference
      // and tx_ref, which the handler hashes to the same id). Must NOT
      // mutate payment / appointment; must NOT add a second row.
      const second = await postWebhook({ body });
      expect(second.status).toBe(200);
      expect(second.body.duplicate).toBe(true);

      const paymentAfterSecond = await db.select().from(payments)
        .where(eq(payments.id, paymentId)).get();
      expect(paymentAfterSecond?.status).toBe('completed');
      const apptAfterSecond = await db.select().from(appointments)
        .where(eq(appointments.id, appointmentId)).get();
      expect(apptAfterSecond?.status).toBe('confirmed');

      const eventsAfterSecond = await db.select().from(processedWebhookEvents)
        .where(eq(processedWebhookEvents.txRef, tx)).all();
      expect(eventsAfterSecond.length).toBe(1);

      // Third delivery with a different `reference` is a logically-new event
      // from Chapa's POV — should be accepted and produce a second row.
      const thirdBody = { tx_ref: tx, status: 'success', reference: eventRef + '-v2' };
      const third = await postWebhook({ body: thirdBody });
      expect(third.status).toBe(200);
      expect(third.body.success).toBe(true);

      const eventsAfterThird = await db.select().from(processedWebhookEvents)
        .where(eq(processedWebhookEvents.txRef, tx)).all();
      expect(eventsAfterThird.length).toBe(2);
    });

    it('a duplicate (same event_id) does not change the appointment status back to cancelled', async () => {
      const tx = txRef;
      const eventRef = `dup-ref-cancel-${Date.now()}`;
      // First: success → confirms appointment.
      const a = await postWebhook({
        body: { tx_ref: tx, status: 'success', reference: eventRef },
      });
      expect(a.status).toBe(200);
      expect(a.body.success).toBe(true);

      // Now a forged-looking failed webhook claiming the SAME eventRef
      // arrives. Has to be signed, but the handler should still treat it
      // as a duplicate and not re-process it (so it can't flip confirmed
      // → cancelled).
      const forgery = await postWebhook({
        body: { tx_ref: tx, status: 'failed', reference: eventRef },
      });
      expect(forgery.status).toBe(200);
      expect(forgery.body.duplicate).toBe(true);

      const appt = await db.select().from(appointments)
        .where(eq(appointments.id, appointmentId)).get();
      // The original 'success' event already confirmed it. The duplicate
      // 'failed' event is keyed to the SAME event_id and should be ignored.
      expect(appt?.status).toBe('confirmed');
    });
  });
});
