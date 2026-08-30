/**
 * CHAIN 9 (P4.3): consumer queue status → polling → done.
 *
 *   POST /api/public/bookings → opaqueId + queue position
 *     → GET /api/public/queue-status/:opaqueId (queue.ts publicRouter →
 *       queue.enrollAndListQueue) → waiting, position, ETA, initials only
 *     → POST /api/tenant/queue/advance/:id → serving → "your turn"
 *     → advance again → done → gentle close, position null.
 *
 * Failure modes: unknown opaqueId → 404; cancelled booking → 404.
 * Privacy: the customer's raw name never appears on the public surface.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';

import { db } from '../../src/db';
import { appointments, staff as staffTable } from '../../src/db/schema';
import {
  mountApp, makeOwner, seedBusiness, deleteTenantCascade, nextSlotInAddisToday,
} from './chain-helpers';
import type { App } from './chain-helpers';

describe('CHAIN: consumer queue status → polling → done', () => {
  let app: App;
  let tenantId: string;
  let token: string;
  let slug: string;
  let staffId: string;
  let serviceId: string;
  let opaqueId: string;
  const customerName = 'Polling Penda';
  const customerPhone = '+251944556677';

  beforeAll(async () => {
    app = await mountApp();
    const owner = await makeOwner({ category: 'salon', isListed: true });
    tenantId = owner.tenantId;
    token = owner.token;
    slug = owner.slug;
    const biz = await seedBusiness(tenantId, { durationMinutes: 30, priceCents: 15000 });
    staffId = biz.staffId;
    serviceId = biz.serviceId;

    const slot = nextSlotInAddisToday();
    expect(slot).toBeTruthy();
    const res = await request(app)
      .post('/api/public/bookings')
      .set('X-Tenant-Slug', slug)
      .send({
        staff_id: staffId,
        service_ids: [serviceId],
        start_time: new Date(slot!).toISOString(),
        customer_name: customerName,
        customer_phone: customerPhone,
      });
    expect(res.status).toBe(201);
    opaqueId = res.body.appointment.id;
  });

  afterAll(async () => {
    await deleteTenantCascade(tenantId);
  });

  it('happy path: waiting → serving → done with position/ETA transitions', async () => {
    // 1. Waiting: position + ETA exposed, name reduced to initials.
    const waiting = await request(app)
      .get(`/api/public/queue-status/${opaqueId}`);
    expect(waiting.status).toBe(200);
    expect(waiting.body.state).toBe('waiting');
    expect(waiting.body.position).toBe(1);
    expect(waiting.body.etaMinutes).toBe(0);
    expect(waiting.body.initials).toBe('PP');
    expect(JSON.stringify(waiting.body)).not.toContain(customerName); // privacy rule

    // 2. Owner advances: waiting → serving.
    const row = await db.select().from(appointments)
      .where(eq(appointments.opaqueId, opaqueId)).get();
    const adv1 = await request(app)
      .post(`/api/tenant/queue/advance/${row!.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(adv1.status).toBe(200);
    expect(adv1.body.newState).toBe('serving');

    const serving = await request(app)
      .get(`/api/public/queue-status/${opaqueId}`);
    expect(serving.status).toBe(200);
    expect(serving.body.state).toBe('serving');
    expect(serving.body.position).toBeNull(); // no longer counting down

    // 3. Second advance: serving → done.
    const adv2 = await request(app)
      .post(`/api/tenant/queue/advance/${row!.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(adv2.status).toBe(200);
    expect(adv2.body.newState).toBe('done');

    const done = await request(app)
      .get(`/api/public/queue-status/${opaqueId}`);
    expect(done.status).toBe(200);
    expect(done.body.state).toBe('done');
    expect(done.body.position).toBeNull();

    // 4. DB side effect: done leaves the ordering (position NULL).
    const finalRow = await db.select().from(appointments)
      .where(eq(appointments.opaqueId, opaqueId)).get();
    expect(finalRow!.queueState).toBe('done');
    expect(finalRow!.queuePosition).toBeNull();
  });

  it('failure mode: unknown opaqueId returns 404', async () => {
    const res = await request(app)
      .get('/api/public/queue-status/deadbeefdeadbeefdeadbeefdeadbeef');
    expect(res.status).toBe(404);
  });

  it('failure mode: cancelled bookings disappear from the status board', async () => {
    // A second booking on a DIFFERENT staff member (same slot, no conflict),
    // then cancelled by its owner (phone-verified).
    const staff2Id = crypto.randomUUID();
    await db.insert(staffTable).values({
      id: staff2Id, tenantId, name: 'Chain Staff 2', active: true,
    });
    const slot2 = nextSlotInAddisToday();
    expect(slot2).toBeTruthy();
    const res = await request(app)
      .post('/api/public/bookings')
      .set('X-Tenant-Slug', slug)
      .send({
        staff_id: staff2Id,
        service_ids: [serviceId],
        start_time: new Date(slot2!).toISOString(),
        customer_name: 'Cancel Cedo',
        customer_phone: '+251944556688',
      });
    expect(res.status).toBe(201);
    const cancelId = res.body.appointment.id;

    const cancel = await request(app)
      .post(`/api/public/bookings/${cancelId}/cancel`)
      .set('X-Tenant-Slug', slug)
      .send({ customer_phone: '+251944556688' });
    expect(cancel.status).toBe(200);

    const status = await request(app)
      .get(`/api/public/queue-status/${cancelId}`);
    expect(status.status).toBe(404);
  });
});
