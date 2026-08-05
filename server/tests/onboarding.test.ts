/**
 * Self-Service Onboarding (Feature A) — end-to-end wizard flow.
 *
 * Covers the full journey:
 *   1. Register an owner via POST /api/auth/register.
 *   2. Fresh tenants start UNLISTED (settings.onboarding_completed=false,
 *      is_listed=false) so nothing leaks before the owner publishes.
 *   3. Complete the wizard steps the SetupWizard frontend drives: create a
 *      service, invite staff + default availability, save business hours,
 *      then POST /api/tenant/onboarding/complete with `listPublicly: true`.
 *   4. Assert the site is LIVE (GET /api/public/page returns the seeded Puck
 *      document) AND listed in /discover.
 *   5. A second tenant that finishes WITHOUT the public-listing toggle stays
 *      off /discover (opt-in is explicit).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants, users, services, staff, staffAvailability, tenantBusinessHours,
  pages, tenantSubscriptions,
} from '../../src/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { cookieValue } from './helpers';
import crypto from 'crypto';

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

function randomPhone(): string {
  return `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
}

async function registerOwner(businessName: string, slug: string): Promise<{ token: string; tenantId: string; slug: string }> {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Onboarding Owner',
    phone: randomPhone(),
    password: 'securePass123',
    businessName,
    slug,
    email: `onboarding-${slug}@egebeya.test`,
    consent: true,
  });
  expect(res.status).toBe(200);
  const token = cookieValue(res, 'accessToken');
  expect(token).toBeTruthy();
  return { token: `Bearer ${token}`, tenantId: res.body.tenant.id, slug };
}

async function runWizardSteps(token: string, opts: { staff?: boolean } = {}) {
  const { staff: includeStaff = true } = opts;

  // Service creation (required by the wizard).
  const sres = await request(app).post('/api/tenant/services')
    .set('Authorization', token)
    .send({ name: 'Signature Haircut', durationMinutes: 45, price: 60000 });
  expect(sres.status).toBe(201);

  if (includeStaff) {
    const staffRes = await request(app).post('/api/tenant/staff')
      .set('Authorization', token)
      .send({ name: 'Sara M.', title: 'Senior Stylist' });
    expect(staffRes.status).toBe(201);
    const availRes = await request(app).put(`/api/tenant/staff/${staffRes.body.id}/availability`)
      .set('Authorization', token)
      .send({ availability: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: '09:00', endTime: '17:00' })) });
    expect(availRes.status).toBe(200);
  }

  // Business hours.
  const hres = await request(app).put('/api/tenant/business-hours')
    .set('Authorization', token)
    .send({
      hours: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek,
        openTime: dayOfWeek === 0 ? null : '09:00',
        closeTime: dayOfWeek === 0 ? null : '17:00',
        isClosed: dayOfWeek === 0,
      })),
    });
  expect(hres.status).toBe(200);
}

describe('Self-service onboarding', () => {
  let listedTenantId: string;
  let listedToken: string;
  let listedSlug: string;
  let unlistedTenantId: string;
  let unlistedToken: string;
  let unlistedSlug: string;

  beforeAll(async () => {
    listedSlug = `onb-list-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
    unlistedSlug = `onb-unlist-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  });

  afterAll(async () => {
    for (const tenantId of [listedTenantId, unlistedTenantId]) {
      if (!tenantId) continue;
      const staffIds = (await db.select({ id: staff.id }).from(staff)
        .where(eq(staff.tenantId, tenantId)).all()).map((s) => s.id);
      if (staffIds.length) {
        await db.delete(staffAvailability).where(inArray(staffAvailability.staffId, staffIds));
      }
      await db.delete(pages).where(eq(pages.tenantId, tenantId));
      await db.delete(tenantBusinessHours).where(eq(tenantBusinessHours.tenantId, tenantId));
      await db.delete(staff).where(eq(staff.tenantId, tenantId));
      await db.delete(services).where(eq(services.tenantId, tenantId));
      await db.delete(users).where(eq(users.tenantId, tenantId));
      await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId));
      await db.delete(tenants).where(eq(tenants.id, tenantId));
    }
  });

  it('registers a new tenant that is NOT yet listed on /discover', async () => {
    const reg = await registerOwner('Onboarding Listed Biz', listedSlug);
    listedTenantId = reg.tenantId;
    listedToken = reg.token;

    // A fresh registration must not surface publicly before the owner opts in.
    const discover = await request(app).get('/api/public/discover?limit=100');
    const slugs = (discover.body || []).map((t: any) => t.slug);
    expect(slugs).not.toContain(listedSlug);

    const settings = await request(app).get('/api/tenant/settings').set('Authorization', listedToken);
    expect(settings.status).toBe(200);
    expect(settings.body.onboarding_completed).toBe(false);
  });

  it('completes the wizard and publishes the site publicly', async () => {
    // The wizard steps the SetupWizard component drives.
    await runWizardSteps(listedToken);

    const complete = await request(app).post('/api/tenant/onboarding/complete')
      .set('Authorization', listedToken)
      .send({
        listPublicly: true,
        category: 'salon',
        city: 'Addis Ababa',
        description: 'Premium haircare in the heart of Addis Ababa.',
      });
    expect(complete.status).toBe(200);
    expect(complete.body.success).toBe(true);
    expect(complete.body.slug).toBe(listedSlug);

    // 1) onboarding flag persisted
    const settings = await request(app).get('/api/tenant/settings').set('Authorization', listedToken);
    expect(settings.status).toBe(200);
    expect(settings.body.onboarding_completed).toBe(true);

    // 2) site is LIVE — the public page resolves the slug and carries the
    //    seeded Puck document (Hero + BookingForm) with the About description.
    const page = await request(app).get('/api/public/page').set('X-Tenant-Slug', listedSlug);
    expect(page.status).toBe(200);
    expect(page.body.tenant?.slug).toBe(listedSlug);
    expect(page.body.tenant?.description).toContain('Addis Ababa');
    const blocks = (page.body.page?.content?.content || []).map((b: any) => b.type);
    expect(blocks).toContain('Hero');
    expect(blocks).toContain('BookingForm');

    // 3) listed in /discover with category + city + name filters applied
    const discover = await request(app).get('/api/public/discover?category=salon&city=Addis+Ababa&q=Onboarding');
    expect(discover.status).toBe(200);
    const slugs = (discover.body || []).map((t: any) => t.slug);
    expect(slugs).toContain(listedSlug);
  });

  it('keeps a tenant OFF /discover when the public-listing toggle is not opted in', async () => {
    const reg = await registerOwner('Onboarding Private Biz', unlistedSlug);
    unlistedTenantId = reg.tenantId;
    unlistedToken = reg.token;

    await runWizardSteps(unlistedToken, { staff: false });

    const complete = await request(app).post('/api/tenant/onboarding/complete')
      .set('Authorization', unlistedToken)
      .send({ listPublicly: false, category: 'clinic' });
    expect(complete.status).toBe(200);

    // onboarding_completed is set — the owner finished the wizard.
    const settings = await request(app).get('/api/tenant/settings').set('Authorization', unlistedToken);
    expect(settings.body.onboarding_completed).toBe(true);

    // ...but the tenant must NOT appear in the public directory.
    const discover = await request(app).get('/api/public/discover?limit=100');
    const slugs = (discover.body || []).map((t: any) => t.slug);
    expect(slugs).not.toContain(unlistedSlug);

    // The site is still live (page resolves) even though it is unlisted.
    const page = await request(app).get('/api/public/page').set('X-Tenant-Slug', unlistedSlug);
    expect(page.status).toBe(200);
  });
});
