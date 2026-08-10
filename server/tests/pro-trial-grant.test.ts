import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../src/db';
import { tenants, users, plans, tenantSubscriptions } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { grantProTrial } from '../../server/lib/trial';

describe('Pro trial grant path replaces removed upgrade route', () => {
  let tenantId: string;
  let freePlanId: string;
  let proPlanId: string;

  beforeAll(async () => {
    freePlanId = (await db.select().from(plans).where(eq(plans.name, 'free')).get())!.id;
    proPlanId = (await db.select().from(plans).where(eq(plans.name, 'pro')).get())!.id;
    tenantId = crypto.randomUUID();
    const phone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    await db.insert(tenants).values({ id: tenantId, name: 'Grant Pro', slug: `grant-pro-${Date.now()}`, createdAt: Date.now() });
    await db.insert(users).values({ id: crypto.randomUUID(), tenantId, name: 'Owner', phone, email: `grant-pro-${Date.now()}@egebeya.test`, passwordHash: await bcrypt.hash('pass1234', 10), role: 'owner', createdAt: Date.now() });
    await db.insert(tenantSubscriptions).values({ id: crypto.randomUUID(), tenantId, planId: freePlanId, status: 'active', startsAt: Date.now() });
  });

  afterAll(async () => {
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).run();
    await db.delete(users).where(eq(users.tenantId, tenantId)).run();
    await db.delete(tenants).where(eq(tenants.id, tenantId)).run();
  });

  it('starts Free, then transitions to Pro trial via grantProTrial', async () => {
    const before = await db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    expect(before!.planId).toBe(freePlanId);
    expect(before!.status).toBe('active');

    const result = await grantProTrial(tenantId);
    expect(result.granted).toBe(true);

    const after = await db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).get();
    expect(after!.planId).toBe(proPlanId);
    expect(after!.status).toBe('trial');
    expect(typeof after!.trialEndsAt).toBe('number');
    expect(after!.trialEndsAt).toBeGreaterThan(Date.now());
  });
});
