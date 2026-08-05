/**
 * WP1.1 / WP1.4 — structured instant-site generator.
 *
 * POST /api/tenant/generate-site (owner + CSRF) persists a deterministic
 * Puck document to pages.content, template selected by tenants.category and
 * populated from real rows (services, staff count, settings.city,
 * settings.social_*). Free tenants only ever receive the single-screen
 * FREE_TIER_BLOCK_SET — no multi-page/blog blocks.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import { tenants, users, services, staff, pages } from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { FREE_TIER_BLOCK_SET } from '../../src/api/site-generator';

const JWT_SECRET = process.env.JWT_SECRET as string;

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api', apiRoutes);

function tokenFor(userId: string, tenantId: string, role = 'owner'): string {
  return jwt.sign({ userId, tenantId, role, tokenVersion: 0 }, JWT_SECRET, { expiresIn: '15m' });
}

const blockTypes = (content: any): string[] => (content?.content ?? []).map((b: any) => b.type);

describe('Instant structured site generator', () => {
  const salonSlug = `salon-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  const clinicSlug = `clinic-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  let salonTenantId: string;
  let clinicTenantId: string;
  let ownerUserId: string;
  let staffUserId: string;
  let ownerToken: string;
  let staffToken: string;

  beforeAll(async () => {
    salonTenantId = crypto.randomUUID();
    clinicTenantId = crypto.randomUUID();
    ownerUserId = crypto.randomUUID();
    staffUserId = crypto.randomUUID();

    const phone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    const staffPhone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;

    await db.insert(tenants).values({
      id: salonTenantId,
      name: 'Zema Salon',
      slug: salonSlug,
      category: 'salon',
      settings: {
        city: 'Addis Ababa',
        social_telegram: 'https://t.me/zema',
        require_payment_upfront: false,
      },
      createdAt: Date.now(),
    });
    await db.insert(tenants).values({
      id: clinicTenantId,
      name: 'Selam Clinic',
      slug: clinicSlug,
      category: 'clinic',
      settings: { city: 'Bole', require_payment_upfront: false },
      createdAt: Date.now(),
    });
    await db.insert(users).values({
      id: ownerUserId,
      tenantId: salonTenantId,
      name: 'Zema Owner',
      phone,
      email: `${salonSlug}@egebeya.test`,
      passwordHash: await bcrypt.hash('pass1234', 10),
      role: 'owner',
      createdAt: Date.now(),
    });
    await db.insert(users).values({
      id: staffUserId,
      tenantId: salonTenantId,
      name: 'Zema Staff',
      phone: staffPhone,
      email: `${salonSlug}-staff@egebeya.test`,
      passwordHash: await bcrypt.hash('pass1234', 10),
      role: 'staff',
      createdAt: Date.now(),
    });

    const svc1 = crypto.randomUUID();
    const svc2 = crypto.randomUUID();
    const stf1 = crypto.randomUUID();
    const stf2 = crypto.randomUUID();
    await db.insert(services).values([
      { id: svc1, tenantId: salonTenantId, name: 'Haircut', durationMinutes: 30, price: 15000, active: true },
      { id: svc2, tenantId: salonTenantId, name: 'Braiding', durationMinutes: 60, price: 40000, active: true },
    ]);
    await db.insert(staff).values([
      { id: stf1, tenantId: salonTenantId, name: 'Aster', title: 'Stylist', active: true },
      { id: stf2, tenantId: salonTenantId, name: 'Meron', title: 'Braid specialist', active: true },
    ]);

    ownerToken = tokenFor(ownerUserId, salonTenantId, 'owner');
    staffToken = tokenFor(staffUserId, salonTenantId, 'staff');
  });

  afterAll(async () => {
    for (const tid of [salonTenantId, clinicTenantId]) {
      await db.delete(pages).where(eq(pages.tenantId, tid));
      await db.delete(services).where(eq(services.tenantId, tid));
      await db.delete(staff).where(eq(staff.tenantId, tid));
    }
    await db.delete(users).where(and(eq(users.tenantId, salonTenantId)));
    await db.delete(tenants).where(and(eq(tenants.id, salonTenantId)));
    await db.delete(tenants).where(eq(tenants.id, clinicTenantId));
  });

  it('persists a single-screen doc with the free-tier block set, hero from tenant name', async () => {
    const res = await request(app)
      .post('/api/tenant/generate-site')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const types = blockTypes(res.body.content);
    // FREE_TIER_BLOCK_SET plus the conditional SocialLinks row (salon has a
    // Telegram handle) — never a multi-page/blog block.
    expect(types).toEqual([...FREE_TIER_BLOCK_SET, 'SocialLinks']);

    const hero = res.body.content.content.find((b: any) => b.type === 'Hero');
    expect(hero.props.title).toBe('Zema Salon');
    expect(hero.props.subtitle).toContain('chair');

    const about = res.body.content.content.find((b: any) => b.type === 'About');
    expect(String(about.props.content)).toContain('2'); // staff count populated

    const contact = res.body.content.content.find((b: any) => b.type === 'Contact');
    expect(contact.props.address).toBe('Addis Ababa'); // settings.city → Contact

    // And it was persisted to pages.content.
    const row = await db.select().from(pages).where(eq(pages.tenantId, salonTenantId)).get();
    expect(blockTypes(row?.content)).toEqual(types);
  });

  it('selects the template by tenants.category', async () => {
    const clinic = await request(app)
      .post('/api/tenant/generate-site')
      .set('Authorization', `Bearer ${tokenFor(ownerUserId, clinicTenantId, 'owner')}`)
      .send({});
    expect(clinic.status).toBe(200);
    const clinicHero = clinic.body.content.content.find((b: any) => b.type === 'Hero');
    const salonRes = await request(app)
      .post('/api/tenant/generate-site')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    const salonHero = salonRes.body.content.content.find((b: any) => b.type === 'Hero');

    expect(clinicHero.props.subtitle).toContain('consultation');
    expect(salonHero.props.subtitle).toContain('chair');
    expect(clinicHero.props.subtitle).not.toBe(salonHero.props.subtitle);
    // Clinic tenant has no social handles → no SocialLinks row.
    expect(blockTypes(clinic.body.content)).toEqual([...FREE_TIER_BLOCK_SET]);
  });

  it('is idempotent — a second call returns the identical document', async () => {
    const first = await request(app)
      .post('/api/tenant/generate-site')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    const second = await request(app)
      .post('/api/tenant/generate-site')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.content).toEqual(first.body.content);
  });

  it('rejects unauthenticated callers with 401', async () => {
    const res = await request(app).post('/api/tenant/generate-site').send({});
    expect(res.status).toBe(401);
  });

  it('rejects a cookie-authenticated request with a missing CSRF header with 403', async () => {
    // Bearer token authenticates, but a csrf_token cookie present without the
    // matching X-CSRF-Token header must be refused.
    const res = await request(app)
      .post('/api/tenant/generate-site')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Cookie', ['csrf_token=stale-csrf-value'])
      .send({});
    expect(res.status).toBe(403);
  });

  it('rejects staff-role callers with 403', async () => {
    const res = await request(app)
      .post('/api/tenant/generate-site')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({});
    expect(res.status).toBe(403);
  });
});
