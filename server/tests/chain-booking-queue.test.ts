/**
 * CHAIN 8 (P4.2): booking → queue entry → booked-floats-above-walk-ins.
 *
 *   POST /api/public/bookings (public.ts → BookingSchema → conflict check →
 *   appointments + customer_stats + queue enroll)
 *     → queue snapshot in the response; DB row carries bookingSource
 *       'online' + a stamped queue position
 *     → a walk-in created afterwards is positioned AFTER the online booking
 *       (queue.ts canonical order: online floats above walk-ins).
 *
 * Failure mode: a past start_time is rejected 422 (assertSlotAllowed) and
 * leaves no appointment row.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';

import { db } from '../../src/db';
import { appointments, customerStats, staff as staffTable } from '../../src/db/schema';
import {
  mountApp, makeOwner, seedBusiness, deleteTenantCascade, nextSlotInAddisToday,
} from './chain-helpers';
import type { App } from './chain-helpers';

describe('CHAIN: public booking → queue → booked floats above walk-ins', () => {
  let app: App;
  let tenantId: string;
  let token: string;
  let slug: string;
  let staffId: string;
  let serviceId: string;
  let walkInId: string;

  beforeAll(async () => {
    app = await mountApp();
    const owner = await makeOwner({ category: 'salon', isListed: true });
    tenantId = owner.tenantId;
    token = owner.token;
    slug = owner.slug;
    const biz = await seedBusiness(tenantId, { durationMinutes: 30, priceCents: 20000 });
    staffId = biz.staffId;
    serviceId = biz.serviceId;
  });

  afterAll(async () => {
    await deleteTenantCascade(tenantId);
  });

  it('happy path: online booking lands in the queue ahead of a later walk-in', async () => {
    const slot = nextSlotInAddisToday();
    expect(slot).toBeTruthy(); // fixture sanity; the Addis day has room

    // 1. Online booking through the public surface.
    const res = await request(app)
      .post('/api/public/bookings')
      .set('X-Tenant-Slug', slug)
      .send({
        staff_id: staffId,
        service_ids: [serviceId],
        start_time: new Date(slot!).toISOString(),
        customer_name: 'Online Obo',
        customer_phone: '+251933445566',
        customer_email: 'obo@egebeya.test',
      });
    expect(res.status).toBe(201);
    expect(res.body.appointment.status).toBe('confirmed');
    expect(res.body.appointment.queue).toBeTruthy();
    expect(res.body.appointment.queue.position).toBe(1);
    const bookingOpaqueId: string = res.body.appointment.id;

    // 2. DB side effects: online marker + queue columns + consumer backfill.
    const row = await db.select().from(appointments)
      .where(eq(appointments.opaqueId, bookingOpaqueId)).get();
    expect(row!.bookingSource).toBe('online');
    expect(row!.queueState).toBe('waiting');
    expect(row!.queuePosition).toBe(1);
    expect(row!.consumerId).toBeTruthy(); // P3.4 backfill ran

    const stats = await db.select().from(customerStats)
      .where(eq(customerStats.tenantId, tenantId)).all();
    expect(stats.find((s) => s.customerPhone === '+251933445566')).toBeTruthy();

    // 3. Walk-in at the SAME slot on a second staff member — the queue's
    // canonical order still floats the online booking above the walk-in
    // (source ordering dominates), and this stays inside the Addis day.
    const staff2Id = crypto.randomUUID();
    await db.insert(staffTable).values({
      id: staff2Id, tenantId, name: 'Chain Staff 2', active: true,
    });
    const res2 = await request(app)
      .post('/api/tenant/bookings/walk-in')
      .set('Authorization', `Bearer ${token}`)
      .send({
        staffId: staff2Id,
        serviceId,
        startTime: new Date(slot!).toISOString(),
        customerName: 'Walkin Wub',
        customerPhone: '+251933445577',
      });
    expect(res2.status).toBe(201);
    walkInId = res2.body.appointment.id;

    // 4. Queue order: online floats above the walk-in.
    const board = await request(app)
      .get('/api/tenant/queue')
      .set('Authorization', `Bearer ${token}`);
    expect(board.status).toBe(200);
    const ids = board.body.entries.map((e: any) => e.id);
    const onlineIdx = ids.indexOf(row!.id);
    const walkIdx = ids.indexOf(walkInId);
    expect(onlineIdx).toBeGreaterThanOrEqual(0);
    expect(walkIdx).toBeGreaterThan(onlineIdx);
    expect(board.body.entries[onlineIdx].source).toBe('online');
    expect(board.body.entries[walkIdx].source).toBe('walk_in');
  });

  it('failure mode: past-time booking is rejected and writes nothing', async () => {
    const before = await db.select().from(appointments)
      .where(eq(appointments.tenantId, tenantId)).all();

    const res = await request(app)
      .post('/api/public/bookings')
      .set('X-Tenant-Slug', slug)
      .send({
        staff_id: staffId,
        service_ids: [serviceId],
        start_time: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        customer_name: 'Time Traveler',
        customer_phone: '+251933445588',
      });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('PAST_DATE');

    const after = await db.select().from(appointments)
      .where(eq(appointments.tenantId, tenantId)).all();
    expect(after.length).toBe(before.length);
  });
});
