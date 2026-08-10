import { db } from '../../src/db';
import { tenantSubscriptions, plans } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export async function grantProTrial(tenantId: string, now = Date.now()): Promise<{ granted: boolean; trialEndsAt: number }> {
  const proPlan = await db.select().from(plans).where(eq(plans.name, 'pro')).get();
  if (!proPlan) throw new Error('Pro plan is not configured');

  const existing = await db.select().from(tenantSubscriptions)
    .where(eq(tenantSubscriptions.tenantId, tenantId)).get();

  const alreadyProTrial = !!existing && existing.planId === proPlan.id && existing.status === 'trial';
  const trialEndsAt = now + 14 * 24 * 3600 * 1000;

  if (alreadyProTrial) {
    return { granted: false, trialEndsAt: existing.trialEndsAt };
  }

  const values = { planId: proPlan.id, status: 'trial', trialEndsAt, startsAt: now };
  if (existing) {
    await db.update(tenantSubscriptions).set(values).where(eq(tenantSubscriptions.tenantId, tenantId));
  } else {
    await db.insert(tenantSubscriptions).values({ id: crypto.randomUUID(), tenantId, ...values });
  }

  return { granted: true, trialEndsAt };
}
