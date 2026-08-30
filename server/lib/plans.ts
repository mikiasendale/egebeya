/**
 * Canonical plan-row helpers.
 *
 * The published Pro gate and the Chapa checkout both resolve the 'pro' plan
 * row to make subscription state concrete (id match, not name-only). On a
 * fresh or ignored-migration database that row can be missing, which used to
 * surface as a 500 "Pro plan is not configured" on checkout and a thrown
 * error from grantProTrial. These helpers self-heal: they return the row if
 * it exists, otherwise they create it from the canonical values below and
 * return that. Idempotent and safe to call on every request/boot.
 */
import crypto from 'crypto';
import { db } from '../../src/db';
import { plans } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { PRO_PLAN_PRICE_BIRR } from './billing';

export interface CanonicalPlan {
  id: string;
  name: 'free' | 'pro';
  price: number; // ETB cents
  maxStaff: number;
  customDomainAllowed: boolean;
}

export const FREE_MAX_STAFF = 2;
export const PRO_MAX_STAFF = 10;

export async function getOrCreatePlan(name: 'free' | 'pro'): Promise<CanonicalPlan> {
  const existing = await db.select().from(plans).where(eq(plans.name, name)).get();
  if (existing) return existing as CanonicalPlan;

  const isPro = name === 'pro';
  const row: CanonicalPlan = {
    id: crypto.randomUUID(),
    name,
    price: isPro ? Number(PRO_PLAN_PRICE_BIRR) * 100 : 0,
    maxStaff: isPro ? PRO_MAX_STAFF : FREE_MAX_STAFF,
    customDomainAllowed: isPro,
  };
  await db.insert(plans).values(row);
  return row;
}

export const getOrCreateFreePlan = () => getOrCreatePlan('free');
export const getOrCreateProPlan = () => getOrCreatePlan('pro');