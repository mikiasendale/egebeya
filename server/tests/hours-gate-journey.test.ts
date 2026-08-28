/**
 * P2.4/P2.6 reopen — the REAL owner journey, end to end at the API level:
 *
 *   provision → site dark (preparing) → owner saves hours via
 *   PUT /business-hours (the Settings save) → client fires
 *   POST /provision/confirm-hours → /site-status flips preparing → live
 *   and generationComplete/confirmedHours report the right phases.
 *
 * Server-side fixture style mirrors provision.test.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';

import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants, users, plans, tenantSubscriptions, pages, services, staff,
  staffAvailability, tenantBusinessHours,
} from '../../src/db/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

function tokenFor(userId: string, tenantId: string): string {
  return jwt.sign({ userId, tenantId, role: 'owner', tokenVersion: 0 }, JWT_SECRET, { expiresIn: '15m' });
}

describe('hours-confirmation journey (P2.6 B2 integration)', () => {
  let tenantId = '';
  let userId = '';
  let token = '';
  let slug = '';

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    userId = crypto.randomUUID();
    slug = `journey-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(tenants).values({
      id: tenantId, name: 'Journey Salon', slug,
      isListed: false,
      settings: { onboarding_completed: false },
      createdAt: Date.now(),
    });
    await db.insert(users).values({
      id: userId, tenantId, name: 'Journey Owner',
      phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
      email: `journey-${userId.slice(0, 8)}@egebeya.test`,
      passwordHash: await bcrypt.hash('pass1234', 10),
      role: 'owner',
      createdAt: Date.now(),
    });
    const freePlan = await db.select().from(plans).where(eq(plans.name, 'free')).get();
    await db.insert(tenantSubscriptions).values({
      id: crypto.randomUUID(), tenantId, planId: freePlan!.id,
      status: 'trial', trialEndsAt: Date.now() + 14 * 86400_000, startsAt: Date.now(),
    });
    token = tokenFor(userId, tenantId);
  });

  afterAll(async () => {
    await db.delete(pages).where(eq(pages.tenantId, tenantId)).catch(() => {});
    const staffRow = await db.select().from(staff).where(eq(staff.tenantId, tenantId)).get();
    if (staffRow) {
      await db.delete(staffAvailability).where(eq(staffAvailability.staffId, staffRow.id)).catch(() => {});
    }
    await db.delete(staff).where(eq(staff.tenantId, tenantId)).catch(() => {});
    await db.delete(services).where(eq(services.tenantId, tenantId)).catch(() => {});
    await db.delete(tenantBusinessHours).where(eq(tenantBusinessHours.tenantId, tenantId)).catch(() => {});
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).catch(() => {});
    await db.delete(users).where(eq(users.tenantId, tenantId)).catch(() => {});
    await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
  });

  async function siteStatus(): Promise<string> {
    const res = await request(app)
      .get('/api/public/site-status')
      .set('X-Tenant-Slug', slug);
    expect(res.status).toBe(200);
    return res.body.status;
  }

  async function provisionStatus(): Promise<any> {
    const res = await request(app)
      .get('/api/tenant/provision/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    return res.body;
  }

  it('provision → dark site → save hours → confirm → live', async () => {
    // 1. Provision (the signup "generation").
    const prov = await request(app)
      .post('/api/tenant/provision')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessName: 'Journey Salon', category: 'Salon' });
    expect(prov.status).toBe(200);

    // 2. Signup just finished: generation COMPLETE, hours UNCONFIRMED
    //    (the exact A1 contract), and the public URL is still DARK.
    let status = await provisionStatus();
    expect(status.generationComplete).toBe(true);
    expect(status.confirmedHours).toBe(false);
    expect(await siteStatus()).toBe('preparing');

    // 3. Owner saves hours in Settings (PUT /business-hours alone does NOT
    //    open the site — the gate is the explicit confirm act).
    const put = await request(app)
      .put('/api/tenant/business-hours')
      .set('Authorization', `Bearer ${token}`)
      .send({
        hours: [
          { dayOfWeek: 0, openTime: null, closeTime: null, isClosed: true },
          ...[1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openTime: '09:30', closeTime: '18:30', isClosed: false })),
        ],
      });
    expect([200, 201]).toContain(put.status);
    expect(await siteStatus()).toBe('preparing'); // STILL dark

    // 4. The client's confirmation call (Settings fires this after PUT).
    const confirm = await request(app)
      .post('/api/tenant/provision/confirm-hours')
      .set('Authorization', `Bearer ${token}`);
    expect(confirm.status).toBe(200);
    expect(confirm.body.success).toBe(true);

    // 5. The gate opens.
    expect(await siteStatus()).toBe('live');
    status = await provisionStatus();
    expect(status.confirmedHours).toBe(true);
    expect(status.generationComplete).toBe(true);
    expect(status.sitePublic).toBe(false); // isListed=false until owner lists
  });

  it('confirm-hours is idempotent — repeat saves stay live and report already=true', async () => {
    const again = await request(app)
      .post('/api/tenant/provision/confirm-hours')
      .set('Authorization', `Bearer ${token}`);
    expect(again.status).toBe(200);
    expect(again.body.already).toBe(true);
    expect(await siteStatus()).toBe('live');
  });
});
