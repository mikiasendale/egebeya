import { Request, Response, NextFunction } from 'express';
import { db } from '../../src/db';
import { tenantSubscriptions, plans, staff } from '../../src/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Check that the tenant has not exceeded the plan limit for the given resource.
 *
 * Usage: router.post('/staff', requirePlanLimit('staff'), handler)
 */
export function requirePlanLimit(resource: 'staff') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { tenantId } = (req as any).user;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized — no tenant context' });
    }

    let subscription: any;
    let plan: any;
    try {
      subscription = await db.select().from(tenantSubscriptions)
        .where(eq(tenantSubscriptions.tenantId, tenantId))
        .get();

      if (!subscription) {
        return res.status(403).json({ error: 'No active subscription. Complete setup first.' });
      }

      plan = subscription.planId
        ? await db.select().from(plans).where(eq(plans.id, subscription.planId)).get()
        : null;

      if (!plan) {
        return res.status(403).json({ error: 'Subscription plan not found.' });
      }

      if (resource === 'staff') {
        const currentStaff = await db.select().from(staff)
          .where(eq(staff.tenantId, tenantId))
          .all();
        if (currentStaff.length >= plan.maxStaff) {
          return res.status(403).json({
            error: `Staff limit reached for your plan (max ${plan.maxStaff}). Upgrade to add more staff.`,
          });
        }
      }

      // Attach to request for downstream handlers
      (req as any).plan = plan;
      (req as any).subscription = subscription;
      next();
    } catch (error) {
      console.error('planLimits middleware error:', error);
      res.status(500).json({ error: 'Failed to check plan limits' });
    }
  };
}

/**
 * Resolve the tenant's active subscription + plan and attach them to the
 * request (`req.plan`, `req.subscription`). Used by route handlers that need
 * to inspect plan features (e.g. custom domains). Does NOT enforce staff-count
 * limits — use requirePlanLimit('staff') for that.
 */
export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  const { tenantId } = (req as any).user;
  if (!tenantId) {
    return res.status(401).json({ error: 'Unauthorized — no tenant context' });
  }

  try {
    const subscription = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId))
      .get();

    if (!subscription) {
      return res.status(403).json({ error: 'No active subscription. Complete setup first.' });
    }

    const plan = subscription.planId
      ? await db.select().from(plans).where(eq(plans.id, subscription.planId)).get()
      : null;

    if (!plan) {
      return res.status(403).json({ error: 'Subscription plan not found.' });
    }

    (req as any).plan = plan;
    (req as any).subscription = subscription;
    next();
  } catch (error) {
    console.error('requireActiveSubscription error:', error);
    res.status(500).json({ error: 'Failed to load subscription' });
  }
}