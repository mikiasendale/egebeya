/**
 * T4.9 — anonymous registration-step beacons.
 *
 * POST /api/auth/events/reg-step records pre-register steps bound to a
 * cookie-id (NULL tenant) so abandonment before POST /register becomes
 * measurable — the beacons never carry identity and never block the flow.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';

import { db } from '../../src/db';
import { activationEvents } from '../../src/db/schema';
import { mountApp } from './chain-helpers';
import type { App } from './chain-helpers';

describe('T4.9 anonymous reg-step beacons', () => {
  let app: App;

  beforeAll(async () => {
    app = await mountApp();
  });

  it('records an anonymous step with the cookie id', async () => {
    const anonId = `anon-${Date.now()}-x9f2`;
    const res = await request(app)
      .post('/api/auth/events/reg-step')
      .send({ step: 'reg_step_viewed', anonId });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const rows = await db.select().from(activationEvents)
      .where(eq(activationEvents.event, 'reg_step_viewed')).all();
    const mine = rows.filter((r) => (r.meta as any)?.anonymousId === anonId);
    expect(mine.length).toBeGreaterThanOrEqual(1);
    expect(mine[0].tenantId).toBeNull();
  });

  it('accepts each canonical step name', async () => {
    for (const step of ['slug_checked', 'reg_details_submitted']) {
      const res = await request(app)
        .post('/api/auth/events/reg-step')
        .send({ step, anonId: 'anon-11111111-aaaa' });
      expect(res.status).toBe(200);
    }
  });

  it('rejects unknown steps and missing anonId', async () => {
    const unknown = await request(app)
      .post('/api/auth/events/reg-step')
      .send({ step: 'not_a_step', anonId: 'anon-11111111-aaaa' });
    expect(unknown.status).toBe(400);

    const noId = await request(app)
      .post('/api/auth/events/reg-step')
      .send({ step: 'reg_step_viewed' });
    expect(noId.status).toBe(400);
  });
});
