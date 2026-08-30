/**
 * CHAIN 16 (P5.6): quiet-hours booking → fill-rate event → aggregation.
 *
 *   PUT /api/tenant/quiet-hours (tenant.ts → settings.quiet_hours_discount)
 *     → POST /api/public/bookings inside the window → discount applied,
 *       response carries quietHours, activation event quiet_hours_booking
 *       meta.inWindow=true
 *     → POST /api/public/bookings outside the window → no discount,
 *       meta.inWindow=false
 *     → GET /api/admin/funnel → analytics.computeQuietHoursFillRate returns
 *       weekly rows whose inWindowBookings reflect the in-window ratio.
 *
 * Failure mode: invalid percent (0 / 91 / non-integer) → 400, settings
 * untouched.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq, and } from 'drizzle-orm';

import { db } from '../../src/db';
import { tenants, activationEvents } from '../../src/db/schema';
import {
  mountApp, makeSuperadmin, makeOwner, seedBusiness, deleteTenantCascade,
  futureSlotAtAddisHour,
} from './chain-helpers';
import type { App } from './chain-helpers';

describe('CHAIN: quiet-hours booking → fill-rate aggregation', () => {
  let app: App;
  let superToken: string;
  let ownerToken: string;
  let tenantId: string;
  let slug: string;
  let staffId: string;
  let serviceId: string;

  beforeAll(async () => {
    app = await mountApp();
    superToken = (await makeSuperadmin()).token;
    const owner = await makeOwner({ category: 'salon', isListed: true });
    tenantId = owner.tenantId;
    ownerToken = owner.token;
    slug = owner.slug;
    const biz = await seedBusiness(tenantId, { durationMinutes: 30, priceCents: 20000 });
    staffId = biz.staffId;
    serviceId = biz.serviceId;
  });

  afterAll(async () => {
    await deleteTenantCascade(tenantId);
  });

  async function bookAt(addisHour: number, name: string, phone: string) {
    const slot = futureSlotAtAddisHour(2, addisHour, 30);
    return request(app)
      .post('/api/public/bookings')
      .set('X-Tenant-Slug', slug)
      .send({
        staff_id: staffId,
        service_ids: [serviceId],
        start_time: new Date(slot).toISOString(),
        customer_name: name,
        customer_phone: phone,
      });
  }

  it('happy path: in-window and out-of-window bookings record honest inWindow flags', async () => {
    // 1. Enable quiet hours: Addis 10:00–12:00 at 15%.
    const put = await request(app)
      .put('/api/tenant/quiet-hours')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ enabled: true, startMinute: 600, endMinute: 720, percent: 15 });
    expect(put.status).toBe(200);
    expect(put.body.quietHoursDiscount).toEqual({
      enabled: true, start_minute: 600, end_minute: 720, percent: 15,
    });

    // 2. Booking INSIDE the window (10:30 Addis): discounted + flagged.
    const inside = await bookAt(10, 'Quiet Qondra', '+251911001122');
    expect(inside.status).toBe(201);
    expect(inside.body.appointment.quietHours).toEqual({
      discountEtbCents: Math.floor(20000 * 15 / 100),
      percent: 15,
    });

    // 3. Booking OUTSIDE the window (14:30 Addis): full price, inWindow false.
    const outside = await bookAt(14, 'Busy Beza', '+251911001133');
    expect(outside.status).toBe(201);
    expect(outside.body.appointment.quietHours ?? null).toBeNull();

    // 4. DB: the quiet_hours_booking events carry the honest flags.
    const events = await db.select().from(activationEvents)
      .where(and(
        eq(activationEvents.tenantId, tenantId),
        eq(activationEvents.event, 'quiet_hours_booking'),
      )).all();
    expect(events.length).toBe(2);
    const flags = events.map((e) => (e.meta as any)?.inWindow).sort();
    expect(flags).toEqual([false, true]);

    // 5. Funnel aggregation: fill-rate rows exist with our bookings counted.
    const funnel = await request(app)
      .get('/api/admin/funnel?weeks=2')
      .set('Authorization', `Bearer ${superToken}`);
    expect(funnel.status).toBe(200);
    const qh = funnel.body.quietHoursFillRate;
    expect(qh).toBeTruthy(); // null only when NO tenant ever enabled the flag
    const current = qh[qh.length - 1];
    expect(current.inWindowBookings).toBeGreaterThanOrEqual(1);
    expect(current.inWindowSlots).toBeGreaterThan(current.inWindowBookings);
    expect(current.rate).toBeGreaterThan(0);
    expect(current.rate).toBeLessThanOrEqual(1);
  });

  it('failure mode: invalid window config is rejected and settings stay untouched', async () => {
    const before = (await db.select().from(tenants).where(eq(tenants.id, tenantId)).get())!.settings;

    const badPercent = await request(app)
      .put('/api/tenant/quiet-hours')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ enabled: true, startMinute: 600, endMinute: 720, percent: 95 });
    expect(badPercent.status).toBe(400);

    const badMinute = await request(app)
      .put('/api/tenant/quiet-hours')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ enabled: true, startMinute: -5, endMinute: 720, percent: 15 });
    expect(badMinute.status).toBe(400);

    const after = (await db.select().from(tenants).where(eq(tenants.id, tenantId)).get())!.settings;
    expect(after).toEqual(before); // no partial write
  });
});
