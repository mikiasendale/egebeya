/**
 * CHAIN 6 (P2): settings save hours → tenant_business_hours rewrite.
 *
 *   PUT /api/tenant/business-hours (tenant.ts → tenantBusinessHours table)
 *     → full replace: delete-then-insert, closed days store NULL times.
 *
 * VERIFIED AGAINST CODE (ground rule 1): the handler does NOT auto-fire
 * POST /provision/confirm-hours — the plan doc claims it does, but
 * src/api/tenant.ts:306-333 contains no such call. This test pins the REAL
 * contract: saving hours never flips onboarding.confirmedHours; only the
 * explicit confirm-hours endpoint does.
 *
 * Failure modes: empty hours array → 400 with the rows untouched.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';

import { db } from '../../src/db';
import { tenantBusinessHours } from '../../src/db/schema';
import { mountApp, makeOwner, deleteTenantCascade } from './chain-helpers';
import type { App } from './chain-helpers';

describe('CHAIN: settings save hours → business-hours rewrite (no auto-confirm)', () => {
  let app: App;
  let tenantId: string;
  let token: string;

  beforeAll(async () => {
    app = await mountApp();
    const owner = await makeOwner({ settings: { onboarding: { generatedAt: 1 } } });
    tenantId = owner.tenantId;
    token = owner.token;

    // Seed template hours (what provision would have written).
    await db.insert(tenantBusinessHours).values(
      [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        id: crypto.randomUUID(),
        tenantId,
        dayOfWeek,
        openTime: '09:00',
        closeTime: '18:00',
        isClosed: false,
      })),
    ).catch(() => {});
  });

  afterAll(async () => {
    await deleteTenantCascade(tenantId);
  });

  it('happy path: PUT /business-hours fully replaces the rows', async () => {
    const res = await request(app)
      .put('/api/tenant/business-hours')
      .set('Authorization', `Bearer ${token}`)
      .send({
        hours: [
          { dayOfWeek: 1, openTime: '08:30', closeTime: '17:30', isClosed: false },
          { dayOfWeek: 2, openTime: '08:30', closeTime: '17:30', isClosed: false },
          { dayOfWeek: 0, openTime: null, closeTime: null, isClosed: true },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const rows = await db.select().from(tenantBusinessHours)
      .where(eq(tenantBusinessHours.tenantId, tenantId)).all();
    expect(rows.length).toBe(3); // full replace, not merge

    const monday = rows.find((r) => r.dayOfWeek === 1);
    expect(monday!.openTime).toBe('08:30');
    expect(monday!.closeTime).toBe('17:30');
    const sunday = rows.find((r) => r.dayOfWeek === 0);
    expect(sunday!.isClosed).toBe(true);
    expect(sunday!.openTime).toBeNull(); // closed days store NULL times
  });

  it('verified contract: saving hours does NOT auto-confirm (only the explicit endpoint does)', async () => {
    const status = await request(app)
      .get('/api/tenant/provision/status')
      .set('Authorization', `Bearer ${token}`);
    expect(status.status).toBe(200);
    expect(status.body.confirmedHours).toBe(false); // hours exist, gate still dark

    const confirm = await request(app)
      .post('/api/tenant/provision/confirm-hours')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(confirm.status).toBe(200);
    expect(confirm.body.confirmedHours).toBe(true);

    const statusAfter = await request(app)
      .get('/api/tenant/provision/status')
      .set('Authorization', `Bearer ${token}`);
    expect(statusAfter.body.confirmedHours).toBe(true);
  });

  it('failure mode: empty hours array is rejected and existing rows survive', async () => {
    const before = await db.select().from(tenantBusinessHours)
      .where(eq(tenantBusinessHours.tenantId, tenantId)).all();

    const res = await request(app)
      .put('/api/tenant/business-hours')
      .set('Authorization', `Bearer ${token}`)
      .send({ hours: [] });
    expect(res.status).toBe(400);

    const after = await db.select().from(tenantBusinessHours)
      .where(eq(tenantBusinessHours.tenantId, tenantId)).all();
    expect(after.length).toBe(before.length); // no destructive wipe
  });
});
