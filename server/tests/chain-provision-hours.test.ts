/**
 * CHAIN 5 (P2.4/P2.6): provision → status → confirm-hours → site live.
 *
 *   register → POST /api/tenant/provision
 *     → GET /api/tenant/provision/status → generationComplete: true,
 *       confirmedHours: false
 *     → public gate still DARK: GET /api/public/page → 404 TENANT_PREPARING
 *     → POST /api/tenant/provision/confirm-hours (hours_confirmed event)
 *     → status flips confirmedHours: true → public page serves the
 *       provisioned content (public.ts hours-confirmation gate opens).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';

import { db } from '../../src/db';
import { tenants, activationEvents } from '../../src/db/schema';
import { mountApp, deleteTenantCascade } from './chain-helpers';
import type { App } from './chain-helpers';

const PASSWORD = 'Xk9#mQv2$Lp8@Wz3';

describe('CHAIN: provision → status → confirm-hours → site live', () => {
  let app: App;
  let tenantId: string;
  let token: string;
  let slug: string;
  const phone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;

  beforeAll(async () => {
    app = await mountApp();

    // Register + login + provision through real HTTP.
    const reg = await request(app)
      .post('/api/auth/register')
      .send({
        phone,
        password: PASSWORD,
        consent: true,
        businessName: 'Chain Hours Salon',
        category: 'Salon',
      });
    expect(reg.status).toBe(200);
    tenantId = reg.body.tenantId;
    slug = reg.body.tenant.slug;

    const login = await request(app)
      .post('/api/auth/login')
      .send({ phone, password: PASSWORD });
    token = String((login.headers['set-cookie'] as any)?.find((c: string) => c.startsWith('accessToken=')) ?? '')
      .match(/accessToken=([^;]+)/)?.[1] ?? '';
    expect(token).toBeTruthy();

    const prov = await request(app)
      .post('/api/tenant/provision')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'Salon' });
    expect(prov.status).toBe(200);
  });

  afterAll(async () => {
    if (tenantId) await deleteTenantCascade(tenantId);
  });

  it('happy path: generation complete but site stays dark until hours are confirmed', async () => {
    // 1. Status: generation done, hours NOT confirmed.
    const before = await request(app)
      .get('/api/tenant/provision/status')
      .set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);
    expect(before.body.generationComplete).toBe(true);
    expect(before.body.confirmedHours).toBe(false);
    expect(before.body.sitePublic).toBe(false);
    const hoursStep = before.body.steps.find((s: any) => s.step === 'hoursConfirmed');
    expect(hoursStep.done).toBe(false);

    // 2. Public gate is DARK — content endpoints 404 with TENANT_PREPARING.
    const dark = await request(app)
      .get('/api/public/page')
      .set('X-Tenant-Slug', slug);
    expect(dark.status).toBe(404);
    expect(dark.body.code).toBe('TENANT_PREPARING');

    // 3. Confirm hours — the one-time human gate.
    const confirm = await request(app)
      .post('/api/tenant/provision/confirm-hours')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(confirm.status).toBe(200);
    expect(confirm.body.confirmedHours).toBe(true);
    expect(confirm.body.already).toBe(false);

    // 4. Status flips; the public gate opens on confirmedHours alone.
    // (sitePublic additionally requires the owner's is-listed toggle, which
    // register leaves false — the gate in public.ts is the contract here.)
    const after = await request(app)
      .get('/api/tenant/provision/status')
      .set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(200);
    expect(after.body.confirmedHours).toBe(true);
    expect(after.body.sitePublic).toBe(false); // isListed still false

    const live = await request(app)
      .get('/api/public/page')
      .set('X-Tenant-Slug', slug);
    expect(live.status).toBe(200);
    expect(live.body.page).toBeTruthy(); // provisioned content, not a 404
    expect(live.body.tenant.slug).toBe(slug);

    // 5. DB side effect: exactly one hours_confirmed event.
    const events = await db.select().from(activationEvents)
      .where(eq(activationEvents.tenantId, tenantId)).all();
    expect(events.filter((e) => e.event === 'hours_confirmed').length).toBe(1);
  });

  it('failure mode: confirm-hours is idempotent — the event fires exactly once', async () => {
    const again = await request(app)
      .post('/api/tenant/provision/confirm-hours')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(again.status).toBe(200);
    expect(again.body.already).toBe(true);
    expect(again.body.confirmedHours).toBe(true);

    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    expect((tenant!.settings as any).onboarding.confirmedHoursAt).toBeTruthy();
    const events = await db.select().from(activationEvents)
      .where(eq(activationEvents.tenantId, tenantId)).all();
    expect(events.filter((e) => e.event === 'hours_confirmed').length).toBe(1);
  });
});
