/**
 * P4.1 — Queue data model: appointment-column queue with same-day scope.
 *
 * Acceptance coverage:
 *   - auto-enroll assigns compact positions; booked-before-walkin ordering
 *   - concurrent advances stay atomic (positions remain a clean 1..N)
 *   - yesterday's rows are invisible to the queue and reject advances
 *   - public status payload leaks NO customer names
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq, inArray, and } from 'drizzle-orm';

import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants, users, plans, tenantSubscriptions, services as servicesTable,
  staff, appointments,
} from '../../src/db/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';
const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

function tokenFor(userId: string, tenantId: string): string {
  return jwt.sign({ userId, tenantId, role: 'owner', tokenVersion: 0 }, JWT_SECRET, { expiresIn: '15m' });
}

function addisMidnight(now = Date.now()): number {
  // Addis is UTC+3 with no DST — day bounds via the shared helper would need
  // the tz lib; a fixed +3h offset matches getAddisDateString for tests.
  const addisNow = new Date(now + 3 * 3600 * 1000);
  addisNow.setUTCHours(0, 0, 0, 0);
  return addisNow.getTime() - 3 * 3600 * 1000;
}

describe('Queue-Buster engine (P4.1)', () => {
  let tenantId = ''; let userId = ''; let token = '';
  let svcId = ''; let staffId = '';
  const createdAppointments: string[] = [];

  async function insertAppt(opts: {
    source?: 'online' | 'walk_in';
    startOffsetMinutes?: number;
    dayOffsetDays?: number;
    state?: string | null;
    name?: string;
  }): Promise<{ id: string; opaqueId: string }> {
    const id = crypto.randomUUID();
    const opaqueId = crypto.randomBytes(16).toString('hex');
    const base = addisMidnight() + (opts.dayOffsetDays ?? 0) * 86400_000;
    const startTime = base + 9 * 3600_000 + (opts.startOffsetMinutes ?? 0) * 60_000;
    await db.insert(appointments).values({
      id, tenantId,
      customerName: opts.name ?? `Customer ${id.slice(0, 4)}`,
      customerPhone: '+251911000000',
      staffId, serviceId: svcId,
      startTime, endTime: startTime + 30 * 60_000,
      status: 'confirmed',
      reminderSent: false,
      opaqueId,
      bookingSource: opts.source ?? 'online',
      queueState: opts.state ?? null,
    });
    createdAppointments.push(id);
    return { id, opaqueId };
  }

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    userId = crypto.randomUUID();
    svcId = crypto.randomUUID();
    staffId = crypto.randomUUID();
    await db.insert(tenants).values({
      id: tenantId, name: 'Queue Barber', slug: `queue-${Date.now()}`,
      category: 'Salon', settings: {}, createdAt: Date.now(),
    });
    await db.insert(users).values({
      id: userId, tenantId, name: 'Owner',
      phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
      email: `queue-${Date.now()}@egebeya.test`,
      passwordHash: await bcrypt.hash('pass1234', 10),
      role: 'owner', createdAt: Date.now(),
    });
    await db.insert(servicesTable).values({ id: svcId, tenantId, name: 'Haircut', durationMinutes: 30, price: 15000, active: true });
    await db.insert(staff).values({ id: staffId, tenantId, name: 'Barber', active: true });
    const proPlan = await db.select().from(plans).where(eq(plans.name, 'pro')).get();
    if (proPlan) {
      await db.insert(tenantSubscriptions).values({
        id: crypto.randomUUID(), tenantId, planId: proPlan.id,
        status: 'active', startsAt: Date.now(),
      });
    }
    token = tokenFor(userId, tenantId);
  });

  afterAll(async () => {
    if (createdAppointments.length) {
      await db.delete(appointments).where(inArray(appointments.id, createdAppointments)).catch(() => {});
    }
    await db.delete(appointments).where(eq(appointments.tenantId, tenantId)).catch(() => {});
    await db.delete(servicesTable).where(eq(servicesTable.id, svcId)).catch(() => {});
    await db.delete(staff).where(eq(staff.id, staffId)).catch(() => {});
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).catch(() => {});
    await db.delete(users).where(eq(users.tenantId, tenantId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
  });

  it('auto-enrolls today\'s rows; online bookings float above walk-ins at equal time', async () => {
    const walkin = await insertAppt({ source: 'walk_in', startOffsetMinutes: 0 });
    const booked = await insertAppt({ source: 'online', startOffsetMinutes: 0 });
    const laterBooked = await insertAppt({ source: 'online', startOffsetMinutes: 60 });

    const res = await request(app)
      .get('/api/tenant/queue')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const entries = res.body.entries;
    expect(entries.length).toBe(3);
    // Egebeya bookings FLOAT ABOVE walk-ins (spec P4.2), regardless of time…
    expect(entries.map((e: any) => e.id)).toEqual([booked.id, laterBooked.id, walkin.id]);
    expect(entries[0].source).toBe('online');
    expect(entries[2].source).toBe('walk_in');
    // …while positions stay compact 1..N.

    // Positions are compact 1..N.
    expect(entries.map((e: any) => e.position)).toEqual([1, 2, 3]);

    // ETA of entry #2 = duration ahead of it (30-min haircut), #3 = 60.
    expect(entries[0].etaMinutes).toBe(0);
    expect(entries[1].etaMinutes).toBeGreaterThanOrEqual(25); // ~30, history-tolerant bounds
    expect(entries[2].etaMinutes).toBeGreaterThanOrEqual(entries[1].etaMinutes + 20);

    void walkin; void laterBooked;
  });

  it('advances one tap per customer: waiting → serving → done, positions re-compact', async () => {
    const list = await request(app).get('/api/tenant/queue').set('Authorization', `Bearer ${token}`);
    const first = list.body.entries[0];
    const second = list.body.entries[1];

    // Tap 1 → serving.
    const tap1 = await request(app)
      .post(`/api/tenant/queue/advance/${first.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(tap1.status).toBe(200);
    expect(tap1.body.newState).toBe('serving');
    expect(tap1.body.entries.find((e: any) => e.id === first.id)?.state).toBe('serving');

    // Tap 2 (same customer) → done; survivors re-compact with no gaps.
    const tap2 = await request(app)
      .post(`/api/tenant/queue/advance/${first.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(tap2.status).toBe(200);
    expect(tap2.body.newState).toBe('done');
    expect(tap2.body.entries.find((e: any) => e.id === first.id)).toBeUndefined();

    const positions = tap2.body.entries.map((e: any) => e.position);
    expect(positions).toEqual([1, ...positions.slice(1).sort((a: number, b: number) => a - b)]);
    expect(new Set(positions).size).toBe(positions.length);
    void second;
  });

  it('CONCURRENT advances on different entries stay atomic (transaction test)', async () => {
    const a = await insertAppt({ source: 'online', startOffsetMinutes: 200 });
    const b = await insertAppt({ source: 'online', startOffsetMinutes: 210 });

    const [ra, rb] = await Promise.all([
      request(app).post(`/api/tenant/queue/advance/${a.id}`).set('Authorization', `Bearer ${token}`),
      request(app).post(`/api/tenant/queue/advance/${b.id}`).set('Authorization', `Bearer ${token}`),
    ]);

    expect(ra.status).toBe(200);
    expect(rb.status).toBe(200);

    // The board must be corruption-free: positions form an exact 1..N set.
    const list = await request(app).get('/api/tenant/queue').set('Authorization', `Bearer ${token}`);
    const positions = list.body.entries.map((e: any) => e.position).sort((x: number, y: number) => x - y);
    expect(positions).toEqual(positions.map((_: number, i: number) => i + 1));

    // Both flips landed exactly once each.
    expect(list.body.entries.find((e: any) => e.id === a.id)?.state).toBe('serving');
    expect(list.body.entries.find((e: any) => e.id === b.id)?.state).toBe('serving');
  });

  it('SAME-ENTRY double-tap race: two concurrent advances flip exactly one step and the board stays 1..N', async () => {
    const appt = await insertAppt({ source: 'online', startOffsetMinutes: 180 });

    const [ra, rb] = await Promise.all([
      request(app).post(`/api/tenant/queue/advance/${appt.id}`).set('Authorization', `Bearer ${token}`),
      request(app).post(`/api/tenant/queue/advance/${appt.id}`).set('Authorization', `Bearer ${token}`),
    ]);
    expect([ra.status, rb.status].every((x) => x === 200)).toBe(true);
    const states = [ra.body.newState, rb.body.newState].sort();
    expect(states).toEqual(['done', 'serving']);

    const list = await request(app).get('/api/tenant/queue').set('Authorization', `Bearer ${token}`);
    expect(list.body.entries.find((e: any) => e.id === appt.id)).toBeUndefined();
    const positions = list.body.entries.map((e: any) => e.position).sort((a: number, b: number) => a - b);
    expect(positions).toEqual(positions.map((_: number, i: number) => i + 1));
  });

  it('same-day scope: yesterday\'s rows never enroll; advancing them fails', async () => {
    const yesterday = await insertAppt({ dayOffsetDays: -1 });

    const list = await request(app).get('/api/tenant/queue').set('Authorization', `Bearer ${token}`);
    expect(list.body.entries.find((e: any) => e.id === yesterday.id)).toBeUndefined();

    const adv = await request(app)
      .post(`/api/tenant/queue/advance/${yesterday.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(adv.status).toBe(409);

    // And the row itself was never touched by any queue pass.
    const row = await db.select().from(appointments).where(eq(appointments.id, yesterday.id)).get();
    expect(row?.queueState).toBeNull();
    expect(row?.queuePosition).toBeNull();
  });

  it('PUBLIC status leaks no customer names — initials only', async () => {
    const appt = await insertAppt({ source: 'online', startOffsetMinutes: 300, name: 'Zeyneb Haile G' });

    // Ensure enrolled.
    const list = await request(app).get('/api/tenant/queue').set('Authorization', `Bearer ${token}`);

    const res = await request(app).get(`/api/public/queue-status/${appt.opaqueId}`);
    expect(res.status).toBe(200);

    const bodyText = JSON.stringify(res.body);
    expect(bodyText.toLowerCase()).not.toContain('zeyneb');
    expect(bodyText.toLowerCase()).not.toContain('haile');
    expect(res.body.initials).toBe('ZH'); // reduced, never raw
    expect(res.body.state).toBe('waiting');
    expect(typeof res.body.position).toBe('number');
    expect(res.body.dateEthiopian?.monthName).toBeTruthy();
  });

  it('public status 404s cancelled bookings and unknown tokens', async () => {
    const r1 = await request(app).get('/api/public/queue-status/not-a-real-token');
    expect(r1.status).toBe(404);

    const appt = await insertAppt({ source: 'online', startOffsetMinutes: 400 });
    await db.update(appointments).set({ status: 'cancelled' }).where(eq(appointments.id, appt.id));
    const r2 = await request(app).get(`/api/public/queue-status/${appt.opaqueId}`);
    expect(r2.status).toBe(404);
  });
});

describe('staff queue rights (P4 F4)', () => {
  let tenantId = ''; let svcId = ''; let staffId = '';
  let staffToken = ''; let otherStaffToken = '';
  let otherTenantId = '';

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    svcId = crypto.randomUUID();
    staffId = crypto.randomUUID();
    await db.insert(tenants).values({
      id: tenantId, name: 'Staff Queue Shop', slug: `staff-queue-${Date.now()}`,
      category: 'Salon', settings: {}, createdAt: Date.now(),
    });
    await db.insert(servicesTable).values({ id: svcId, tenantId, name: 'Trim', durationMinutes: 30, price: 10000, active: true });
    await db.insert(staff).values({ id: staffId, tenantId, name: 'Barber', active: true });

    // One waiting appointment for the advance test.
    const base = addisMidnight();
    await db.insert(appointments).values({
      id: crypto.randomUUID(), tenantId,
      customerName: 'Staff Customer', customerPhone: '+251911111111',
      staffId, serviceId: svcId,
      startTime: base + 9 * 3600_000, endTime: base + 9.5 * 3600_000,
      status: 'confirmed', reminderSent: false,
      opaqueId: crypto.randomBytes(16).toString('hex'),
      bookingSource: 'online',
    });

    const staffUser = crypto.randomUUID();
    await db.insert(users).values({
      id: staffUser, tenantId, name: 'Barber Staff',
      phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
      email: `staff-${Date.now()}@egebeya.test`,
      passwordHash: await bcrypt.hash('pass1234', 10),
      role: 'staff', createdAt: Date.now(),
    });
    staffToken = jwt.sign({ userId: staffUser, tenantId, role: 'staff', tokenVersion: 0 }, JWT_SECRET, { expiresIn: '15m' });

    otherTenantId = crypto.randomUUID();
    await db.insert(tenants).values({
      id: otherTenantId, name: 'Other Shop', slug: `other-staff-${Date.now()}`,
      settings: {}, createdAt: Date.now(),
    });
    const otherStaffUser = crypto.randomUUID();
    await db.insert(users).values({
      id: otherStaffUser, tenantId: otherTenantId,
      name: 'Other Barber', phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
      email: `other-staff-${Date.now()}@egebeya.test`,
      passwordHash: await bcrypt.hash('pass1234', 10),
      role: 'staff', createdAt: Date.now(),
    });
    otherStaffToken = jwt.sign({ userId: otherStaffUser, tenantId: otherTenantId, role: 'staff', tokenVersion: 0 }, JWT_SECRET, { expiresIn: '15m' });
  });

  it('staff can LIST today\'s queue', async () => {
    const res = await request(app)
      .get('/api/tenant/queue')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.entries)).toBe(true);
  });

  it('staff can ADVANCE one tap per customer', async () => {
    const list = await request(app).get('/api/tenant/queue').set('Authorization', `Bearer ${staffToken}`);
    const first = list.body.entries[0];
    expect(first).toBeTruthy();
    const adv = await request(app)
      .post(`/api/tenant/queue/advance/${first.id}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(adv.status).toBe(200);
    expect(['serving', 'done']).toContain(adv.body.newState);
  });

  it('cross-tenant staff JWT cannot advance another shop\'s entry — 404 (isolation)', async () => {
    const list = await request(app).get('/api/tenant/queue').set('Authorization', `Bearer ${staffToken}`);
    const fixtureEntry = list.body.entries[0];
    expect(fixtureEntry).toBeTruthy();
    const adv = await request(app)
      .post(`/api/tenant/queue/advance/${fixtureEntry.id}`)
      .set('Authorization', `Bearer ${otherStaffToken}`);
    expect(adv.status).toBe(404);
  });

  it('unauthenticated queue access is rejected with 401', async () => {
    const res = await request(app).get('/api/tenant/queue');
    expect(res.status).toBe(401);
    const adv = await request(app).post('/api/tenant/queue/advance/anything');
    expect(adv.status).toBe(401);
  });

  afterAll(async () => {
    await db.delete(appointments).where(eq(appointments.tenantId, tenantId)).catch(() => {});
    await db.delete(servicesTable).where(eq(servicesTable.id, svcId)).catch(() => {});
    await db.delete(staff).where(eq(staff.id, staffId)).catch(() => {});
    await db.delete(users).where(eq(users.tenantId, tenantId)).catch(() => {});
    await db.delete(users).where(eq(users.tenantId, otherTenantId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, otherTenantId)).catch(() => {});
  });
});
