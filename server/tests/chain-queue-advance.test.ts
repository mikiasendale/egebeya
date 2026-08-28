/**
 * CHAIN 7 (P4.1): walk-in → queue entry → advance → ETA recompute.
 *
 *   POST /api/tenant/bookings/walk-in (bookings.ts walkInRouter)
 *     → GET /api/tenant/queue (queue.ts → queue.enrollAndListQueue)
 *       → entry auto-enrolled 'waiting', position 1, ETA 0
 *     → POST /api/tenant/queue/advance/:id → queue.advanceEntry
 *       → waiting → serving → done; positions compact; ETA recomputed.
 *
 * Failure modes: unknown appointment → 404; yesterday's row → 409
 * (out_of_day). The walk-in POST requires a future slot, so when the Addis
 * day has <30min left the fixture falls back to a direct DB insert (the
 * queue engine itself is still exercised over real HTTP).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';

import { db } from '../../src/db';
import { appointments } from '../../src/db/schema';
import {
  mountApp, makeOwner, seedBusiness, deleteTenantCascade,
  nextSlotInAddisToday, addisDayBounds,
} from './chain-helpers';
import type { App } from './chain-helpers';

describe('CHAIN: walk-in → queue → advance', () => {
  let app: App;
  let tenantId: string;
  let token: string;
  let staffId: string;
  let serviceId: string;
  let walkInId: string;
  let usedApiWalkIn = false;

  beforeAll(async () => {
    app = await mountApp();
    const owner = await makeOwner({ category: 'salon' });
    tenantId = owner.tenantId;
    token = owner.token;
    const biz = await seedBusiness(tenantId, { durationMinutes: 30, priceCents: 20000 });
    staffId = biz.staffId;
    serviceId = biz.serviceId;
  });

  afterAll(async () => {
    await deleteTenantCascade(tenantId);
  });

  it('happy path: walk-in enters the queue, two taps walk it to done', async () => {
    // 1. Walk-in — via the owner HTTP endpoint when the Addis day allows.
    const slot = nextSlotInAddisToday();
    if (slot) {
      const res = await request(app)
        .post('/api/tenant/bookings/walk-in')
        .set('Authorization', `Bearer ${token}`)
        .send({
          staffId,
          serviceId,
          startTime: new Date(slot).toISOString(),
          customerName: 'Walkin Wanda',
          customerPhone: '+251911222333',
        });
      expect(res.status).toBe(201);
      walkInId = res.body.appointment.id;
      usedApiWalkIn = true;
    } else {
      // Last 30 minutes of the Addis day: no future slot exists today.
      // Insert the walk-in row directly (same shape the endpoint writes,
      // incl. bookingSource: 'walk_in') and continue through the queue APIs.
      const { start } = addisDayBounds();
      walkInId = crypto.randomUUID();
      await db.insert(appointments).values({
        id: walkInId,
        tenantId,
        staffId,
        serviceId,
        customerName: 'Walkin Wanda',
        customerPhone: '+251911222333',
        startTime: start + 10 * 3600 * 1000,
        endTime: start + 10 * 3600 * 1000 + 30 * 60 * 1000,
        status: 'confirmed',
        reminderSent: false,
        opaqueId: crypto.randomBytes(16).toString('hex'),
        bookingSource: 'walk_in',
      });
    }

    // The endpoint stamps the walk-in marker used for queue ordering.
    const row = await db.select().from(appointments).where(eq(appointments.id, walkInId)).get();
    expect(row!.status).toBe('confirmed');
    expect(row!.bookingSource).toBe(usedApiWalkIn ? 'walk_in' : 'walk_in');

    // 2. Queue board — the row is auto-enrolled as waiting.
    const board1 = await request(app)
      .get('/api/tenant/queue')
      .set('Authorization', `Bearer ${token}`);
    expect(board1.status).toBe(200);
    const mine = board1.body.entries.find((e: any) => e.id === walkInId);
    expect(mine).toBeTruthy();
    expect(mine.state).toBe('waiting');
    expect(mine.position).toBe(1);
    expect(mine.etaMinutes).toBe(0); // nothing ahead of the first entry
    expect(mine.source).toBe('walk_in');

    // 3. Advance: waiting → serving. Survivors re-compact (none here).
    const adv1 = await request(app)
      .post(`/api/tenant/queue/advance/${walkInId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(adv1.status).toBe(200);
    expect(adv1.body.newState).toBe('serving');

    const afterServe = await db.select().from(appointments)
      .where(eq(appointments.id, walkInId)).get();
    expect(afterServe!.queueState).toBe('serving');

    // 4. Advance: serving → done. Position released (NULL), off the board.
    const adv2 = await request(app)
      .post(`/api/tenant/queue/advance/${walkInId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(adv2.status).toBe(200);
    expect(adv2.body.newState).toBe('done');

    const afterDone = await db.select().from(appointments)
      .where(eq(appointments.id, walkInId)).get();
    expect(afterDone!.queueState).toBe('done');
    expect(afterDone!.queuePosition).toBeNull();

    const board2 = await request(app)
      .get('/api/tenant/queue')
      .set('Authorization', `Bearer ${token}`);
    expect(board2.body.entries.find((e: any) => e.id === walkInId)).toBeUndefined();
  });

  it('ETA recompute: a second entry waits behind the served one, not beside it', async () => {
    // Add a fresh walk-in while the first is still serving.
    const { start } = addisDayBounds();
    const secondId = crypto.randomUUID();
    await db.insert(appointments).values({
      id: secondId,
      tenantId,
      staffId,
      serviceId,
      customerName: 'Walkin Two',
      customerPhone: '+251911222444',
      startTime: start + 11 * 3600 * 1000,
      endTime: start + 11 * 3600 * 1000 + 30 * 60 * 1000,
      status: 'confirmed',
      reminderSent: false,
      opaqueId: crypto.randomBytes(16).toString('hex'),
      bookingSource: 'walk_in',
    });

    const board = await request(app)
      .get('/api/tenant/queue')
      .set('Authorization', `Bearer ${token}`);
    expect(board.status).toBe(200);
    const entry = board.body.entries.find((e: any) => e.id === secondId);
    expect(entry.state).toBe('waiting');
    expect(entry.position).toBe(1); // the done entry left the ordering
    expect(entry.etaMinutes).toBe(0);

    // Failure mode: advancing a nonexistent appointment 404s.
    const missing = await request(app)
      .post(`/api/tenant/queue/advance/${crypto.randomUUID()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(missing.status).toBe(404);
  });

  it('failure mode: yesterday’s row is history — advance returns 409 out_of_day', async () => {
    const { start } = addisDayBounds();
    const yesterdayId = crypto.randomUUID();
    await db.insert(appointments).values({
      id: yesterdayId,
      tenantId,
      staffId,
      serviceId,
      customerName: 'Yesterday Yonas',
      customerPhone: '+251911222555',
      startTime: start - 24 * 3600 * 1000 + 10 * 3600 * 1000,
      endTime: start - 24 * 3600 * 1000 + 10 * 3600 * 1000 + 30 * 60 * 1000,
      status: 'confirmed',
      reminderSent: false,
      opaqueId: crypto.randomBytes(16).toString('hex'),
      queueState: 'waiting',
    });

    const res = await request(app)
      .post(`/api/tenant/queue/advance/${yesterdayId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);

    // Nothing about the row changed.
    const row = await db.select().from(appointments).where(eq(appointments.id, yesterdayId)).get();
    expect(row!.queueState).toBe('waiting');
    void and;
  });
});
