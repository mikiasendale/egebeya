/**
 * T4.7 — quiet-hours fill-rate stats endpoint.
 *
 * GET /api/tenant/quiet-hours/stats — read-only payoff for the merchant's
 * quiet-hours discount: share of confirmed/completed bookings (30d) that
 * landed inside the discounted window, sourced from the quiet_hours_booking
 * events the public booking flow already records.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';

import { db } from '../../src/db';
import { appointments, activationEvents } from '../../src/db/schema';
import {
  mountApp, makeOwner, seedBusiness, deleteTenantCascade,
} from './chain-helpers';
import type { App } from './chain-helpers';

describe('T4.7 quiet-hours fill-rate stats', () => {
  let app: App;
  let tenantId = '';
  let token = '';
  let staffId = '';
  let serviceId = '';

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  beforeAll(async () => {
    app = await mountApp();
    const owner = await makeOwner({
      category: 'Salon',
      settings: {
        quiet_hours_discount: { enabled: true, start_minute: 780, end_minute: 900, percent: 20 },
      },
    });
    tenantId = owner.tenantId;
    token = owner.token;
    const biz = await seedBusiness(tenantId, { durationMinutes: 30, priceCents: 20000 });
    staffId = biz.staffId;
    serviceId = biz.serviceId;

    // Two confirmed bookings in the window; one quiet_hours_booking event
    // recorded in-window, one out-of-window (the merchant's real mix).
    const apptA = crypto.randomUUID();
    const apptB = crypto.randomUUID();
    await db.insert(appointments).values([
      { id: apptA, tenantId, customerName: 'A', customerPhone: '+251911111111', staffId, serviceId, startTime: now - 5 * DAY, endTime: now - 5 * DAY + 1800_000, status: 'confirmed', reminderSent: false, opaqueId: crypto.randomBytes(16).toString('hex') },
      { id: apptB, tenantId, customerName: 'B', customerPhone: '+251922222222', staffId, serviceId, startTime: now - 3 * DAY, endTime: now - 3 * DAY + 1800_000, status: 'confirmed', reminderSent: false, opaqueId: crypto.randomBytes(16).toString('hex') },
    ]);
    await db.insert(activationEvents).values([
      { id: crypto.randomUUID(), tenantId, event: 'quiet_hours_booking', meta: { appointmentId: apptA, inWindow: true }, createdAt: now - 5 * DAY },
      { id: crypto.randomUUID(), tenantId, event: 'quiet_hours_booking', meta: { appointmentId: apptB, inWindow: false }, createdAt: now - 3 * DAY },
    ]);
  });

  afterAll(async () => {
    await deleteTenantCascade(tenantId);
  });

  it('reports the in-window share of bookings over the trailing window', async () => {
    const res = await request(app)
      .get('/api/tenant/quiet-hours/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.totalBookings).toBe(2);
    expect(res.body.quietBookings).toBe(2);
    expect(res.body.inWindowBookings).toBe(1);
    expect(res.body.rate).toBe(0.5);
  });

  it('is owner-gated', async () => {
    const res = await request(app).get('/api/tenant/quiet-hours/stats');
    expect(res.status).toBe(401);
  });
});
