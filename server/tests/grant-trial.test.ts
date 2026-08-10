import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../src/db';
import { tenants, plans, tenantSubscriptions } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { grantProTrial } from '../../server/lib/trial';

describe('grantProTrial helper / CLI behavior', () => {
  let tenantId: string;
  let freePlanId: string;
  let proPlanId: string;

  beforeAll(async () => {
    freePlanId = (await db.select().from(plans).where(eq(plans.name, 'free')).get())!.id;
    proPlanId = (await db.select().from(plans).where(eq(plans.name, 'pro')).get())!.id;
    tenantId = crypto.randomUUID();
    await db.insert(tenants).values({
      id: tenantId,
      name: 'Grant Trial Salon',
      slug: `grant-trial-${Date.now()}`,
      createdAt: Date.now(),
    });
    await db.insert(tenantSubscriptions).values({
      id: crypto.randomUUID(),
      tenantId,
      planId: freePlanId,
      status: 'active',
      startsAt: Date.now(),
    });
  });

  afterAll(async () => {
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).run();
    await db.delete(tenants).where(eq(tenants.id, tenantId)).run();
  });

  it('grants a fresh Pro trial when the tenant is on Free', async () => {
    const result = await grantProTrial(tenantId);
    expect(result.granted).toBe(true);
    const sub = await db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    expect(sub!.planId).toBe(proPlanId);
    expect(sub!.status).toBe('trial');
    expect(typeof sub!.trialEndsAt).toBe('number');
    expect(sub!.trialEndsAt).toBeGreaterThan(Date.now());
  });

  it('is idempotent — a second call does not change the trial end time', async () => {
    const first = await db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    const endsAt = first!.trialEndsAt;
    const result = await grantProTrial(tenantId);
    expect(result.granted).toBe(false);
    const second = await db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    expect(second!.trialEndsAt).toBe(endsAt);
  });

  it('overwrites an existing expired/active non-trial Pro subscription to a fresh trial', async () => {
    await db.update(tenantSubscriptions).set({ status: 'expired', endsAt: Date.now() - 1000 }).where(eq(tenantSubscriptions.tenantId, tenantId));
    const result = await grantProTrial(tenantId);
    expect(result.granted).toBe(true);
    const sub = await db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    expect(sub!.status).toBe('trial');
    expect(sub!.planId).toBe(proPlanId);
  });
});
