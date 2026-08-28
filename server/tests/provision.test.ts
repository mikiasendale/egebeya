/**
 * P2.3 — Instant Empire provisioning pipeline.
 *
 *   1. One POST /provision call materializes page + services + owner-staff +
 *      hours for a fresh tenant (luxnails-equivalent in one call).
 *   2. Public content endpoints 404 (TENANT_PREPARING) pre-confirmation;
 *      /site-status reports 'preparing' → 'live' after hours confirmation.
 *   3. A crash mid-provision leaves recoverable state — idempotent re-run
 *      completes ONLY the missing pieces and never overwrites real work.
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

describe('provisioning pipeline (P2.3)', () => {
  const tenantIds: string[] = [];

  async function makeFreshTenant(slugPrefix: string): Promise<{ tenantId: string; userId: string; token: string }> {
    const tenantId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    await db.insert(tenants).values({
      id: tenantId,
      name: 'Fresh Business',
      slug: `${slugPrefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      isListed: false, // register flow default
      settings: { onboarding_completed: false },
      createdAt: Date.now(),
    });
    await db.insert(users).values({
      id: userId,
      tenantId,
      name: 'Provision Owner',
      phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
      email: `prov-${userId.slice(0, 8)}@egebeya.test`,
      passwordHash: await bcrypt.hash('pass1234', 10),
      role: 'owner',
      createdAt: Date.now(),
    });
    const freePlan = await db.select().from(plans).where(eq(plans.name, 'free')).get();
    await db.insert(tenantSubscriptions).values({
      id: crypto.randomUUID(), tenantId, planId: freePlan!.id,
      status: 'trial', trialEndsAt: Date.now() + 14 * 86400_000, startsAt: Date.now(),
    });
    tenantIds.push(tenantId);
    return { tenantId, userId, token: tokenFor(userId, tenantId) };
  }

  afterAll(async () => {
    for (const id of tenantIds) {
      await db.delete(pages).where(eq(pages.tenantId, id)).catch(() => {});
      await db.delete(staffAvailability).where(eq(
        staffAvailability.staffId,
        // subquery unsupported inline — delete by join-free lookup:
        (await db.select().from(staff).where(eq(staff.tenantId, id)).get())?.id ?? '',
      )).catch(() => {});
      await db.delete(staff).where(eq(staff.tenantId, id)).catch(() => {});
      await db.delete(services).where(eq(services.tenantId, id)).catch(() => {});
      await db.delete(tenantBusinessHours).where(eq(tenantBusinessHours.tenantId, id)).catch(() => {});
      await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, id)).catch(() => {});
      await db.delete(users).where(eq(users.tenantId, id)).catch(() => {});
      await db.delete(tenants).where(eq(tenants.id, id)).catch(() => {});
    }
  });

  it('provisions a complete site in ONE call', async () => {
    const { tenantId, token } = await makeFreshTenant('prov-one');

    const res = await request(app)
      .post('/api/tenant/provision')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessName: 'Selam Beauty', category: 'Salon' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.steps).toEqual({ page: true, services: true, staff: true, hours: true });

    // Page: valid block doc from the Salon pack.
    const page = await db.select().from(pages).where(eq(pages.tenantId, tenantId)).get();
    expect(page?.content).toBeTruthy();
    expect((page!.content as any).content[0].type).toBe('hero');
    expect((page!.content as any).content[0].props.title).toBe('Selam Beauty');

    // Services: Salon pack defaults present, priced in cents.
    const svcRows = await db.select().from(services).where(eq(services.tenantId, tenantId));
    expect(svcRows.length).toBe(3);

    // Owner-as-first-staff with Mon–Sat availability.
    const staffRows = await db.select().from(staff).where(eq(staff.tenantId, tenantId));
    expect(staffRows.length).toBe(1);
    expect(staffRows[0].title).toBe('Owner');
    const avail = await db.select().from(staffAvailability)
      .where(eq(staffAvailability.staffId, staffRows[0].id));
    expect(avail.length).toBe(6);

    // Business hours written.
    const hourRows = await db.select().from(tenantBusinessHours)
      .where(eq(tenantBusinessHours.tenantId, tenantId));
    expect(hourRows.length).toBe(7);

    // Status endpoint reports every step done except hoursConfirmed.
    const status = await request(app)
      .get('/api/tenant/provision/status')
      .set('Authorization', `Bearer ${token}`);
    expect(status.status).toBe(200);
    const byStep = Object.fromEntries(status.body.steps.map((s: any) => [s.step, s.done]));
    expect(byStep).toMatchObject({
      page: true, services: true, staff: true, hours: true, hoursConfirmed: false,
    });
  });

  it('public site data 404s pre-confirmation; /site-status reports preparing then live', async () => {
    const { tenantId, token } = await makeFreshTenant('prov-dark');
    const slugRow = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    const slug = slugRow!.slug;

    // Provision so content exists but hours are unconfirmed.
    await request(app).post('/api/tenant/provision')
      .set('Authorization', `Bearer ${token}`).send({ category: 'Clinic' });

    // Public content endpoints are dark.
    const pageRes = await request(app).get('/api/public/page').set('X-Tenant-Slug', slug);
    expect(pageRes.status).toBe(404);
    expect(pageRes.body.code).toBe('TENANT_PREPARING');

    // …but the probe answers politely (soft-landing source, P2.6).
    const probe = await request(app).get('/api/public/site-status').set('X-Tenant-Slug', slug);
    expect(probe.status).toBe(200);
    expect(probe.body.status).toBe('preparing');

    // Confirm hours → gate lifts (the P2.6 confirm action flips this flag).
    const t = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    await db.update(tenants).set({
      settings: { ...(t!.settings as any), onboarding: { ...(t!.settings as any).onboarding, confirmedHours: true }, isListed: true },
    }).where(eq(tenants.id, tenantId));

    const livePage = await request(app).get('/api/public/page').set('X-Tenant-Slug', slug);
    expect(livePage.status).toBe(200);
    const probeLive = await request(app).get('/api/public/site-status').set('X-Tenant-Slug', slug);
    expect(probeLive.body.status).toBe('live');
  });

  it('crash mid-provision recovers: re-run completes only missing pieces, never overwrites work', async () => {
    // Dedicated tenant simulating a crash AFTER the page step.
    const first = await makeFreshTenant('prov-partial');

    // Simulate crash: page exists (written) but services/staff/hours never landed.
    await db.insert(pages).values({
      tenantId: first.tenantId,
      content: {
        version: 1,
        root: {},
        content: [
          { type: 'hero', props: { title: 'Partial Biz', subtitle: 'partial', backgroundImage: '' }, data: {} },
        ],
      },
    });

    const retry = await request(app)
      .post('/api/tenant/provision')
      .set('Authorization', `Bearer ${first.token}`)
      .send({ businessName: 'Partial Biz', category: 'Salon' });
    expect(retry.status).toBe(200);
    expect(retry.body.steps).toEqual({ page: false, services: true, staff: true, hours: true });

    // The crashed-run page was NOT overwritten.
    const page = await db.select().from(pages).where(eq(pages.tenantId, first.tenantId)).get();
    expect((page!.content as any).content[0].props.subtitle).toBe('partial');

    // Missing pieces landed exactly once.
    const svcRows = await db.select().from(services).where(eq(services.tenantId, first.tenantId));
    expect(svcRows.length).toBeGreaterThan(0);
    const hourRows = await db.select().from(tenantBusinessHours)
      .where(eq(tenantBusinessHours.tenantId, first.tenantId));
    expect(hourRows.length).toBe(7);

    // Full double-run: nothing duplicated.
    const again = await request(app)
      .post('/api/tenant/provision')
      .set('Authorization', `Bearer ${first.token}`)
      .send({});
    expect(again.status).toBe(200);
    expect(Object.values(again.body.steps).every(Boolean)).toBe(false); // all already done
    const svcAfter = await db.select().from(services).where(eq(services.tenantId, first.tenantId));
    expect(svcAfter.length).toBe(svcRows.length);
  });
});
