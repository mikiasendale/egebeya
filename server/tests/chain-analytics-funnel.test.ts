/**
 * CHAIN 15 (P3.5): event tracking → funnel → north-star.
 *
 *   The lifecycle events fire through their REAL production triggers:
 *     site_generated   ← POST /api/tenant/provision
 *     hours_confirmed  ← POST /api/tenant/provision/confirm-hours
 *     site_shared      ← POST /api/tenant/events/site-shared
 *     first_booking    ← POST /api/public/bookings (first confirmed booking)
 *     first_invoice_paid ← checkout + signed webhook (payments.ts)
 *   Then GET /api/admin/funnel (admin.ts → analytics.aggregateWeeklyFunnel
 *   + funnelConversion + computeNorthStar) reports them.
 *
 * Failure mode: a non-superadmin token is refused (403) on admin surfaces.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

vi.mock('../../server/lib/chapa', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/lib/chapa')>();
  return {
    ...actual,
    createCheckout: vi.fn(async (opts: any) => ({
      checkoutUrl: 'https://checkout.chapa.co/sandbox/pay/' + opts.txRef,
      txRef: opts.txRef,
      raw: { status: 'success' },
    })),
    verifyPayment: vi.fn(async () => ({ status: 'success', amount: '1000', tx_ref: '', raw: {} })),
  };
});

import request from 'supertest';
import { eq, and } from 'drizzle-orm';

import { db } from '../../src/db';
import { activationEvents, appointments } from '../../src/db/schema';
import {
  mountApp, makeSuperadmin, makeOwner, seedBusiness, deleteTenantCascade,
  deliverWebhook, nextSlotInAddisToday,
} from './chain-helpers';
import type { App } from './chain-helpers';

const PASSWORD = 'Xk9#mQv2$Lp8@Wz3';

describe('CHAIN: event tracking → funnel → north-star', () => {
  let app: App;
  let superToken: string;
  let ownerToken: string;
  let tenantId: string;
  let slug: string;
  let staffId: string;
  let serviceId: string;
  const phone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;

  beforeAll(async () => {
    app = await mountApp();
    superToken = (await makeSuperadmin()).token;
  });

  afterAll(async () => {
    if (tenantId) await deleteTenantCascade(tenantId);
  });

  it('happy path: lifecycle events fire through real endpoints and land in the funnel', async () => {
    // ── Drive every lifecycle stage through its production trigger. ──
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ phone, password: PASSWORD, consent: true, businessName: 'Funnel Salon', category: 'Salon' });
    expect(reg.status).toBe(200);
    tenantId = reg.body.tenantId;
    slug = reg.body.tenant.slug;

    const login = await request(app).post('/api/auth/login').send({ phone, password: PASSWORD });
    ownerToken = String((login.headers['set-cookie'] as any)?.find((c: string) => c.startsWith('accessToken=')) ?? '')
      .match(/accessToken=([^;]+)/)?.[1] ?? '';

    const prov = await request(app)
      .post('/api/tenant/provision')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ category: 'Salon' });
    expect(prov.status).toBe(200);

    const confirm = await request(app)
      .post('/api/tenant/provision/confirm-hours')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    expect(confirm.status).toBe(200);

    const shared = await request(app)
      .post('/api/tenant/events/site-shared')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ via: 'chain-test' });
    expect(shared.status).toBe(200);

    const biz = await seedBusiness(tenantId, { durationMinutes: 30, priceCents: 20000 });
    staffId = biz.staffId;
    serviceId = biz.serviceId;

    const slot = nextSlotInAddisToday();
    expect(slot).toBeTruthy();
    const booking = await request(app)
      .post('/api/public/bookings')
      .set('X-Tenant-Slug', slug)
      .send({
        staff_id: staffId,
        service_ids: [serviceId],
        start_time: new Date(slot!).toISOString(),
        customer_name: 'Funnel Fikir',
        customer_phone: '+251922334455',
      });
    expect(booking.status).toBe(201);

    const checkout = await request(app)
      .post('/api/tenant/subscription/checkout')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ cycle: 30 });
    expect(checkout.status).toBe(200);
    const hook = await deliverWebhook(app, { tx_ref: checkout.body.txRef, status: 'success' });
    expect(hook.status).toBe(200);

    // ── DB: the events exist server-side (analytics.trackEvent wrote them). ──
    const rows = await db.select().from(activationEvents)
      .where(eq(activationEvents.tenantId, tenantId)).all();
    const kinds = new Set(rows.map((r) => r.event));
    for (const expected of ['site_generated', 'hours_confirmed', 'site_shared', 'first_booking', 'first_invoice_paid']) {
      expect(kinds.has(expected)).toBe(true);
    }

    // ── Funnel over HTTP (superadmin). ──
    const funnel = await request(app)
      .get('/api/admin/funnel?weeks=4')
      .set('Authorization', `Bearer ${superToken}`);
    expect(funnel.status).toBe(200);
    expect(Array.isArray(funnel.body.weekly)).toBe(true);
    expect(Array.isArray(funnel.body.northStar)).toBe(true);
    expect(funnel.body.churn).toBeTruthy();

    // Current-week bucket counts our tenant's events.
    const week = funnel.body.weekly[funnel.body.weekly.length - 1];
    expect(week.stages.hoursConfirmed).toBeGreaterThanOrEqual(1);
    expect(week.stages.firstBooking).toBeGreaterThanOrEqual(1);
    expect(week.stages.firstInvoicePaid).toBeGreaterThanOrEqual(1);

    // Conversion object shape (rates may be null on empty cohorts).
    expect(week.conversion).toHaveProperty('generatedToConfirmed');
    expect(week.conversion).toHaveProperty('bookingToPaid');

    // North-star: a per-week object with bookings / billing-active tenants.
    const nsCurrent = funnel.body.northStar[funnel.body.northStar.length - 1];
    expect(nsCurrent.confirmedBookings).toBeGreaterThanOrEqual(1);
    expect(nsCurrent.billingActiveTenants).toBeGreaterThanOrEqual(1);
    expect(nsCurrent.value).toBeCloseTo(nsCurrent.confirmedBookings / nsCurrent.billingActiveTenants, 5);
  });

  it('failure mode: non-superadmin tokens are refused on admin surfaces', async () => {
    const res = await request(app)
      .get('/api/admin/funnel')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(403);

    const anon = await request(app).get('/api/admin/funnel');
    expect([401, 403]).toContain(anon.status);
  });

  it('cleanup sanity: the first_booking event fired exactly once for the tenant', async () => {
    const events = await db.select().from(activationEvents)
      .where(and(eq(activationEvents.tenantId, tenantId), eq(activationEvents.event, 'first_booking'))).all();
    expect(events.length).toBe(1);
    // And the confirmed booking it refers to exists.
    const confirmed = await db.select().from(appointments)
      .where(eq(appointments.tenantId, tenantId)).all();
    expect(confirmed.some((a) => a.status === 'confirmed')).toBe(true);
  });
});
