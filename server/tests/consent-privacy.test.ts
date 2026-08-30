/**
 * P3.7 — consent & privacy baseline tests.
 *
 * Acceptance coverage:
 *   - booking-time opt-in capture stamps marketing_opt_in_given_at; absent
 *     field never downgrades an existing opt-in
 *   - telegram link always carries a consent timestamp (P3.2 storage rule)
 *   - data-deletion request round-trip: record + ack + security_events
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';

import { db } from '../../src/db';
import {
  tenants, users, services as servicesTable, staff, appointments,
  customerStats, telegramLinks, dataDeletionRequests, securityEvents,
} from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const app = express();
app.use(express.json());
const { default: apiRoutes } = await import('../../src/api');
app.use('/api', apiRoutes);

describe('Consent & privacy baseline (P3.7)', () => {
  const slug = `consent-${Date.now()}`;
  let tenantId: string;
  let svcId: string;
  let staffId: string;

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    svcId = crypto.randomUUID();
    staffId = crypto.randomUUID();
    await db.insert(tenants).values({
      id: tenantId, name: 'Consent Salon', slug,
      settings: {}, createdAt: Date.now(),
    });
    await db.insert(users).values({
      id: crypto.randomUUID(), tenantId, name: 'Owner',
      phone: `+2519${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
      email: `${slug}@egebeya.test`,
      passwordHash: await bcrypt.hash('Str0ng-Passw0rd!', 8),
      role: 'owner', createdAt: Date.now(),
    });
    await db.insert(servicesTable).values({ id: svcId, tenantId, name: 'Mani', durationMinutes: 45, price: 25000, active: true });
    await db.insert(staff).values({ id: staffId, tenantId, name: 'Nail Tech', active: true });
  });

  afterAll(async () => {
    await db.delete(appointments).where(eq(appointments.tenantId, tenantId)).catch(() => {});
    await db.delete(customerStats).where(eq(customerStats.tenantId, tenantId)).catch(() => {});
    await db.delete(dataDeletionRequests).where(eq(dataDeletionRequests.phone, '+251977889900')).catch(() => {});
    await db.delete(securityEvents).where(eq(securityEvents.eventType, 'data_deletion_request')).catch(() => {});
    await db.delete(staff).where(eq(staff.id, staffId)).catch(() => {});
    await db.delete(servicesTable).where(eq(servicesTable.id, svcId)).catch(() => {});
    await db.delete(users).where(eq(users.tenantId, tenantId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
  });

  let bookingCounter = 0;
  async function book(phone: string, marketingOptIn?: boolean): Promise<any> {
    // Each booking takes a distinct slot so same-staff conflicts (409) never
    // mask the consent assertions.
    const start = new Date(Date.now() + 72 * 3600 * 1000 + bookingCounter * 3600 * 1000);
    bookingCounter += 1;
    start.setUTCMinutes(0, 0, 0);
    const body: Record<string, unknown> = {
      staff_id: staffId,
      service_ids: [svcId],
      start_time: start.toISOString(),
      customer_name: `C ${phone.slice(-4)}`,
      customer_phone: phone,
    };
    if (marketingOptIn !== undefined) body.marketing_opt_in = marketingOptIn;
    return request(app).post('/api/public/bookings').set('X-Tenant-Slug', slug).send(body);
  }

  it('explicit marketing_opt_in=true is captured with a consent timestamp', async () => {
    const res = await book('+251977112200', true);
    expect(res.status).toBe(201);
  });

  it('absent opt-in never silently downgrades an existing consent', async () => {
    // Second booking from the same phone WITHOUT the field.
    const res = await book('+251977112200');
    expect(res.status).toBe(201);

    const stats = await db.select().from(customerStats)
      .where(eq(customerStats.customerPhone, '+251977112200')).get();
    expect(stats?.marketingOptIn).toBe(true); // preserved
    expect((stats as any)?.marketingOptInGivenAt).toBeGreaterThan(0);
  });

  it('new customers default to opted-OUT with null timestamp when no field sent', async () => {
    const res = await book('+251977334400');
    expect(res.status).toBe(201);
    await new Promise((r) => setTimeout(r, 100));

    const stats = await db.select().from(customerStats)
      .where(eq(customerStats.customerPhone, '+251977334400')).get();
    expect(stats?.marketingOptIn).toBe(false);
    expect((stats as any)?.marketingOptInGivenAt).toBeNull();
  });

  it('telegram_links rows cannot exist without a consent timestamp', async () => {
    // The column is NOT NULL — attempt a bare insert and expect rejection.
    let rejected = false;
    try {
      await db.insert(telegramLinks).values({
        chatId: 'no-consent-test',
        phone: '+251911223300',
        tenantId: null,
      } as any);
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
  });

  it('data-deletion round-trip: records request, acks, logs security event', async () => {
    const res = await request(app)
      .post('/api/consumer/data-deletion')
      .send({ phone: '+251977889900' });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.requestId).toBeTruthy();
    expect(res.body.ackAm).toBeTruthy(); // Amharic-first ack
    expect(res.body.ackEn).toBeTruthy();

    const row = await db.select().from(dataDeletionRequests)
      .where(eq(dataDeletionRequests.id, res.body.requestId)).get();
    expect(row?.status).toBe('requested');
    expect(row?.phone).toBe('+251977889900'); // normalized
    expect(row!.requestedAt).toBeGreaterThan(0);

    const evt = await db.select().from(securityEvents)
      .where(eq(securityEvents.eventType, 'data_deletion_request')).all();
    expect(evt.length).toBeGreaterThanOrEqual(1);
  });

  it('deletion endpoint rejects malformed phones', async () => {
    const res = await request(app)
      .post('/api/consumer/data-deletion')
      .send({ phone: 'not-a-phone' });
    expect(res.status).toBe(400);
  });
});
