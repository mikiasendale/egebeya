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
import { eq, and, gte } from 'drizzle-orm';

import { db } from '../../src/db';
import { tenants, activationEvents, appointments, tenantBusinessHours } from '../../src/db/schema';
import { computeQuietHoursFillRate } from '../lib/analytics';
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

    // 5. Funnel aggregation. GET /api/admin/funnel buckets by the server
    //    clock's CURRENT and PAST weeks only, so a booking made 2 days out
    //    legitimately falls outside that coverage near the week boundary
    //    (e.g. a Saturday run books into next Monday). The HTTP funnel below
    //    is therefore checked structurally, and the deterministic contract is
    //    asserted by pinning `now` to the booking's own week through the SAME
    //    code path the endpoint calls (admin.ts → computeQuietHoursFillRate)
    //    over the SAME real rows just created.
    const apptRows = await db.select({
      tenantId: appointments.tenantId,
      startTime: appointments.startTime,
      status: appointments.status,
    }).from(appointments)
      .where(and(
        eq(appointments.tenantId, tenantId),
        gte(appointments.startTime, Date.now() - 7 * 24 * 3600 * 1000),
      ))
      .all();
    expect(apptRows.length).toBe(2);

    const tenantRow = await db.select({ settings: tenants.settings })
      .from(tenants).where(eq(tenants.id, tenantId)).get();
    const openDays = new Set<number>();
    for (const h of await db.select({
      dayOfWeek: tenantBusinessHours.dayOfWeek,
      isClosed: tenantBusinessHours.isClosed,
    }).from(tenantBusinessHours).where(eq(tenantBusinessHours.tenantId, tenantId)).all()) {
      if (!h.isClosed) openDays.add(h.dayOfWeek);
    }

    const bookingWeekMid = (
      Math.min(...apptRows.map((a) => a.startTime)) +
      Math.max(...apptRows.map((a) => a.startTime))
    ) / 2;
    const pinned = computeQuietHoursFillRate({
      tenants: [{ id: tenantId, settings: (tenantRow?.settings as Record<string, unknown>) ?? null }],
      appointments: apptRows,
      staffCounts: { [tenantId]: 1 },
      openDaysByTenant: openDays.size === 0 ? {} : { [tenantId]: openDays },
      weeks: 1,
      now: bookingWeekMid,
    });
    expect(pinned).not.toBeNull();
    expect(pinned!.length).toBe(1);
    const week = pinned![0];
    // Only the 10:30 Addis booking sits inside the 10:00–12:00 window.
    expect(week.inWindowBookings).toBe(1);
    expect(week.inWindowSlots).toBeGreaterThan(week.inWindowBookings);
    expect(week.rate).toBeGreaterThan(0);
    expect(week.rate).toBeLessThanOrEqual(1);

    // HTTP funnel: well-formed rows over the server-clock window (the current
    // partial week may or may not contain the future bookings — that is what
    // the pinned aggregation above pins down deterministically).
    const funnel = await request(app)
      .get('/api/admin/funnel?weeks=2')
      .set('Authorization', `Bearer ${superToken}`);
    expect(funnel.status).toBe(200);
    const qh = funnel.body.quietHoursFillRate;
    expect(qh).toBeTruthy(); // null only when NO tenant ever enabled the flag
    expect(Array.isArray(qh)).toBe(true);
    expect(qh.length).toBe(2);
    for (const row of qh as Array<{ inWindowSlots: number; rate: number | null }>) {
      expect(row.inWindowSlots).toBeGreaterThan(0);
      expect(row.rate).not.toBeNull();
      expect(row.rate!).toBeGreaterThanOrEqual(0);
      expect(row.rate!).toBeLessThanOrEqual(1);
    }
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
