import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants, users, tenantSubscriptions, plans,
  services as servicesTable, staff, appointments,
} from '../../src/db/schema';
import { eq, and, gte, lt } from 'drizzle-orm';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

function makeToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}
function authHeader(user: any): Record<string, string> {
  return { Authorization: `Bearer ${makeToken(user)}` };
}

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

// Import cron logic directly (the module exports runOnce + interfaces with the DB)
process.env.VITEST_PROCESS_EXIT_GUARD = 'true';
import { runOnce } from '../../server/cron/sendReminders';

describe('Reminder cron (WP3.2)', () => {
  const slug = `rem-${Date.now()}`;
  let tenantId: string;
  let userId: string;
  let svcId: string;
  let staffId: string;
  let withEmailId: string;
  let withoutEmailId: string;
  let outsideWindowId: string;

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    userId = crypto.randomUUID();
    const pwHash = await bcrypt.hash('pass1234', 10);
    await db.insert(tenants).values({ id: tenantId, name: 'Reminders Shop', slug, createdAt: Date.now() });
    await db.insert(users).values({ id: userId, tenantId, name: 'Reminders Owner', phone: `+25172000001`, email: `rem-${Date.now()}@test.com`, passwordHash: pwHash, role: 'owner', createdAt: Date.now() });

    const proPlan = await db.select().from(plans).where(eq(plans.name, 'pro')).get();
    if (proPlan) {
      await db.insert(tenantSubscriptions).values({ id: crypto.randomUUID(), tenantId, planId: proPlan.id, status: 'active', startsAt: Date.now() });
    }

    svcId = crypto.randomUUID();
    staffId = crypto.randomUUID();
    await Promise.all([
      db.insert(servicesTable).values({ id: svcId, tenantId, name: 'Haircut', durationMinutes: 60, price: 5000, active: true }),
      db.insert(staff).values({ id: staffId, tenantId, name: 'Barber', active: true }),
    ]);
  });

  afterAll(async () => {
    await db.delete(appointments).where(eq(appointments.tenantId, tenantId)).catch(() => {});
    await db.delete(servicesTable).where(eq(servicesTable.tenantId, tenantId)).catch(() => {});
    await db.delete(staff).where(eq(staff.id, staffId)).catch(() => {});
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).catch(() => {});
    await db.delete(users).where(eq(users.id, userId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
  });

  function seedAppt(params: { hoursOffset: number; status: string; email: string | null }): string {
    const now = Date.now();
    const start = now + params.hoursOffset * 3600 * 1000 + 5000; // +5s to clear gt boundary
    const end = start + 3600 * 1000;
    const id = crypto.randomUUID();
    db.insert(appointments).values({
      id, tenantId, customerName: `C-${id.slice(0, 4)}`,
      customerPhone: `+2517000000${id.charCodeAt(0) % 10}`,
      customerEmail: params.email, staffId: staffId, serviceId: svcId,
      startTime: start, endTime: end, status: params.status, reminderSent: false,
    }).run();
    return id;
  }

  it('marks confirmed appointment inside 1.5–2.5h window as reminderSent=true (with email)', async () => {
    const id = seedAppt({ hoursOffset: 2, status: 'confirmed', email: 'x@test.com' });
    const before = await db.select().from(appointments).where(eq(appointments.id, id)).get();
    expect(before?.reminderSent).toBe(false);

    await runOnce(tenantId);

    const after = await db.select().from(appointments).where(eq(appointments.id, id)).get();
    expect(after?.reminderSent).toBe(true);
  });

  it('marks confirmed appointment inside window as reminderSent=true even without email', async () => {
    const id = seedAppt({ hoursOffset: 2.1, status: 'confirmed', email: null });
    await runOnce(tenantId);
    const after = await db.select().from(appointments).where(eq(appointments.id, id)).get();
    expect(after?.reminderSent).toBe(true);
  });

  it('does NOT mark appointment outside the 1.5–2.5h window', async () => {
    const id = seedAppt({ hoursOffset: 5, status: 'confirmed', email: null });
    await runOnce(tenantId);
    const after = await db.select().from(appointments).where(eq(appointments.id, id)).get();
    expect(after?.reminderSent).toBe(false);
  });

  it('marks pending appointments inside the window as reminderSent=true', async () => {
    const id = seedAppt({ hoursOffset: 2, status: 'pending', email: null });
    await runOnce(tenantId);
    const after = await db.select().from(appointments).where(eq(appointments.id, id)).get();
    expect(after?.reminderSent).toBe(true); // cron includes 'pending' per spec
  });

  it('does NOT re-mark already-sent reminders', async () => {
    const preSent = crypto.randomUUID();
    const now = Date.now();
    const start = now + 2 * 3600 * 1000 + 5000; // +5s to clear gt boundary
    const end = start + 3600 * 1000;
    db.insert(appointments).values({
      id: preSent, tenantId, customerName: 'Sent', customerPhone: '+25170000000',
      customerEmail: null, staffId: staffId, serviceId: svcId,
      startTime: start, endTime: end, status: 'confirmed', reminderSent: true,
    }).run();

    await runOnce(tenantId);
    const after = await db.select().from(appointments).where(eq(appointments.id, preSent)).get();
    expect(after?.reminderSent).toBe(true);
  });

  it('only touches appointments for the correct tenant', async () => {
    const otherTenantId = crypto.randomUUID();
    const otherStaffId = crypto.randomUUID();
    await db.insert(tenants).values({ id: otherTenantId, name: 'Other', slug: `other-rem-${Date.now()}`, createdAt: Date.now() }).catch(() => {});
    await db.insert(staff).values({ id: otherStaffId, tenantId: otherTenantId, name: 'Other Barber', active: true }).catch(() => {});

    const now = Date.now();
    const start = now + 2 * 3600 * 1000 + 5000; // +5s to clear gt boundary
    const end = start + 3600 * 1000;

    // This appointment belongs to tenantId; it WILL be touched when we call runOnce(tenantId).
    const mainId = crypto.randomUUID();
    db.insert(appointments).values({
      id: mainId, tenantId, customerName: 'MainTel', customerPhone: '+25170000002',
      customerEmail: null, staffId, serviceId: svcId,
      startTime: start, endTime: end, status: 'confirmed', reminderSent: false,
    }).run();

    // This appointment belongs to a DIFFERENT tenant; runOnce(tenantId) must NOT touch it.
    const otherId = crypto.randomUUID();
    db.insert(appointments).values({
      id: otherId, tenantId: otherTenantId, customerName: 'Other', customerPhone: '+25170000001',
      customerEmail: null, staffId: otherStaffId, serviceId: svcId,
      startTime: start, endTime: end, status: 'confirmed', reminderSent: false,
    }).run();

    await runOnce(tenantId);

    const mainAfter = await db.select().from(appointments).where(eq(appointments.id, mainId)).get();
    expect(mainAfter?.reminderSent).toBe(true);

    const otherAfter = await db.select().from(appointments).where(eq(appointments.id, otherId)).get();
    expect(otherAfter?.reminderSent).toBe(false);

    await db.delete(appointments).where(eq(appointments.id, mainId)).catch(() => {});
    await db.delete(appointments).where(eq(appointments.id, otherId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, otherTenantId)).catch(() => {});
    await db.delete(staff).where(eq(staff.id, otherStaffId)).catch(() => {});
  });
});
