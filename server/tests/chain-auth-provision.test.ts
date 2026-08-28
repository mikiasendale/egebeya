/**
 * CHAIN 4 (P2.3): register → provision → page + services + staff + hours.
 *
 *   POST /api/auth/register (auth.ts → tenants/users/tenantSubscriptions)
 *     → POST /api/tenant/provision (tenant.ts → siteTemplates.buildTemplatePage)
 *       → pages.content = valid block doc, services seeded from the category
 *         pack, owner-as-first-staff + availability, business-hours rows,
 *         settings.onboarding.generatedAt stamped, site_generated event fired.
 *
 * Failure modes: register refuses a missing consent (400); re-provision is
 * idempotent (no duplicate artifacts).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';

import { db } from '../../src/db';
import {
  tenants, users, pages, services, staff, staffAvailability,
  tenantBusinessHours, activationEvents,
} from '../../src/db/schema';
import { mountApp, deleteTenantCascade } from './chain-helpers';
import type { App } from './chain-helpers';

const PASSWORD = 'Xk9#mQv2$Lp8@Wz3';

describe('CHAIN: register → provision → site artifacts', () => {
  let app: App;
  let tenantId: string;
  let token: string;
  const phone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  const email = `chain-prov-${crypto.randomUUID().slice(0, 8)}@egebeya.test`;

  beforeAll(async () => {
    app = await mountApp();
  });

  afterAll(async () => {
    if (tenantId) await deleteTenantCascade(tenantId);
  });

  it('happy path: register creates the tenant, provision materializes the full site', async () => {
    // 1. Register through real HTTP.
    const reg = await request(app)
      .post('/api/auth/register')
      .send({
        phone,
        password: PASSWORD,
        consent: true,
        businessName: 'Chain Provision Salon',
        category: 'Salon',
        email,
      });
    expect(reg.status).toBe(200);
    expect(reg.body.tenantId).toBeTruthy();
    expect(reg.body.user.role).toBe('owner');
    tenantId = reg.body.tenantId;

    // DB side effects of registration: tenant (unlisted) + owner + trial sub.
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    expect(tenant!.isListed).toBe(false);
    const owner = await db.select().from(users).where(eq(users.tenantId, tenantId)).get();
    expect(owner!.role).toBe('owner');

    // Log in through real HTTP (cookie session model) — the access token
    // arrives as an httpOnly cookie (see server/tests/helpers.ts).
    const login = await request(app)
      .post('/api/auth/login')
      .send({ phone, password: PASSWORD });
    expect(login.status).toBe(200);
    const authCookie = String((login.headers['set-cookie'] as any)?.find((c: string) => c.startsWith('accessToken=')) ?? '');
    const tokenMatch = authCookie.match(/accessToken=([^;]+)/);
    expect(tokenMatch).toBeTruthy();
    token = tokenMatch![1];

    // 2. Provision through real HTTP.
    const prov = await request(app)
      .post('/api/tenant/provision')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessName: 'Chain Provision Salon', category: 'Salon' });
    expect(prov.status).toBe(200);
    expect(prov.body.provisioned).toBe(true);
    expect(prov.body.steps).toEqual({ page: true, services: true, staff: true, hours: true });

    // 3. DB side effects — page content is a valid template block doc.
    const page = await db.select().from(pages).where(eq(pages.tenantId, tenantId)).get();
    expect(page).toBeTruthy();
    const content: any = page!.content;
    expect(content.version).toBeTruthy();
    expect(Array.isArray(content.content)).toBe(true);
    expect(content.content.length).toBeGreaterThan(0);
    expect(content.content[0].type).toBe('hero');

    // 4. Services seeded from the Salon pack (3 defaults).
    const svcRows = await db.select().from(services).where(eq(services.tenantId, tenantId)).all();
    expect(svcRows.length).toBe(3);

    // 5. Owner-as-first-staff + availability + hours.
    const staffRows = await db.select().from(staff).where(eq(staff.tenantId, tenantId)).all();
    expect(staffRows.length).toBe(1);
    expect(staffRows[0].userId).toBe(owner!.id);
    expect(staffRows[0].title).toBe('Owner');
    const avail = await db.select().from(staffAvailability)
      .where(eq(staffAvailability.staffId, staffRows[0].id)).all();
    expect(avail.length).toBe(6); // Mon–Sat 09:00–18:00

    const hours = await db.select().from(tenantBusinessHours)
      .where(eq(tenantBusinessHours.tenantId, tenantId)).all();
    expect(hours.length).toBe(7); // + Sunday closed
    expect(hours.find((h) => h.dayOfWeek === 0)?.isClosed).toBe(true);

    // 6. onboarding.generatedAt stamped + site_generated event fired once.
    const after = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    const onboarding = (after!.settings as any)?.onboarding ?? {};
    expect(typeof onboarding.generatedAt).toBe('number');
    expect(onboarding.siteGeneratedTracked).toBe(true);
    const events = await db.select().from(activationEvents)
      .where(eq(activationEvents.tenantId, tenantId)).all();
    expect(events.filter((e) => e.event === 'site_generated').length).toBe(1);
  });

  it('failure mode: register refuses to proceed without consent', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
        password: PASSWORD,
        consent: false,
        businessName: 'No Consent PLC',
      });
    expect(res.status).toBe(400);
    expect(String(res.body.error)).toMatch(/Privacy Policy|consent/i);
  });

  it('failure mode: re-provision is idempotent — no duplicate artifacts', async () => {
    const prov2 = await request(app)
      .post('/api/tenant/provision')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessName: 'Chain Provision Salon', category: 'Salon' });
    expect(prov2.status).toBe(200);
    expect(prov2.body.provisioned).toBe(false);
    expect(prov2.body.steps).toEqual({ page: false, services: false, staff: false, hours: false });

    const svcRows = await db.select().from(services).where(eq(services.tenantId, tenantId)).all();
    expect(svcRows.length).toBe(3); // still exactly the pack defaults
    const events = await db.select().from(activationEvents)
      .where(eq(activationEvents.tenantId, tenantId)).all();
    expect(events.filter((e) => e.event === 'site_generated').length).toBe(1);
  });
});
