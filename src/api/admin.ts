import { Router } from 'express';
import { db } from '../db';
import {
  tenants, users, tenantSubscriptions, plans, appointments,
} from '../db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

/**
 * Auth gate: only JWTs that identify a superadmin may proceed.
 *
 * Layout note: we mount this as `router.use((req,res,next) => ...)` so EVERY
 * endpoint under /api/admin is gated the same way and a future endpoint can't
 * accidentally leak outside the superadmin filter.
 *
 * The `is_superadmin` flag is on the users table (NOT the JWT) — we verify
 * the JWT's `userId`, then look up the user fresh on every request so revoking
 * superadmin status takes effect immediately rather than after the token's
 * 15-min lifetime.
 */
router.use(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (!payload?.userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const user = await db.select().from(users).where(eq(users.id, payload.userId)).get();
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    // The flag could have been removed since the JWT was issued; check the
    // DB row, not the token claim, every single time.
    if (!(user as any).isSuperadmin) {
      return res.status(403).json({ error: 'Forbidden — superadmin only' });
    }
    // Stamp the resolved user onto the request for downstream handlers.
    (req as any).user = {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      name: user.name,
      email: user.email,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

/**
 * GET /api/admin/stats
 * Platform-wide counts surfaced at the top of /admin.
 */
router.get('/stats', async (_req, res) => {
  try {
    const tenantRow = await db.select({ n: sql<number>`count(*)`.as('n') }).from(tenants).get();
    const bookingRow = await db.select({ n: sql<number>`count(*)`.as('n') }).from(appointments).get();
    const suspendedRow = await db
      .select({ n: sql<number>`count(*)`.as('n') })
      .from(tenants)
      .where(eq(tenants.isSuspended, true))
      .get();
    res.json({
      tenants: Number(tenantRow?.n ?? 0),
      bookings: Number(bookingRow?.n ?? 0),
      suspended: Number(suspendedRow?.n ?? 0),
    });
  } catch (error) {
    console.error('admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch platform stats' });
  }
});

/**
 * GET /api/admin/tenants
 * List every tenant alongside their plan+subscription status and suspension
 * state. Sorted newest-first so a superadmin triages just-onboarded tenants
 * first if any start misbehaving.
 */
router.get('/tenants', async (_req, res) => {
  try {
    const list = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        category: tenants.category,
        isListed: tenants.isListed,
        isSuspended: tenants.isSuspended,
        createdAt: tenants.createdAt,
        planId: tenantSubscriptions.planId,
        planName: plans.name,
        subStatus: tenantSubscriptions.status,
        trialEndsAt: tenantSubscriptions.trialEndsAt,
        endsAt: tenantSubscriptions.endsAt,
      })
      .from(tenants)
      .leftJoin(tenantSubscriptions, eq(tenantSubscriptions.tenantId, tenants.id))
      .leftJoin(plans, eq(plans.id, tenantSubscriptions.planId))
      .orderBy(desc(tenants.createdAt))
      .all();
    res.json(list);
  } catch (error) {
    console.error('admin tenants error:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

/**
 * PUT /api/admin/tenants/:id/suspend
 * Suspend a tenant — blocks their public site, booking ingest, and any
 * tenant-owner route handler that hits the tenant-resolution middleware.
 * Idempotent: suspending an already-suspended tenant is a no-op success.
 */
router.put('/tenants/:id/suspend', async (req, res) => {
  const id = String(req.params.id || '');
  try {
    const existing = await db.select({ id: tenants.id, isSuspended: tenants.isSuspended })
      .from(tenants).where(eq(tenants.id, id)).get();
    if (!existing) return res.status(404).json({ error: 'Tenant not found' });
    if (existing.isSuspended) {
      return res.json({ success: true, id, isSuspended: true, already: true });
    }
    await db.update(tenants).set({ isSuspended: true }).where(eq(tenants.id, id));
    res.json({ success: true, id, isSuspended: true });
  } catch (error) {
    console.error('admin suspend error:', error);
    res.status(500).json({ error: 'Failed to suspend tenant' });
  }
});

/**
 * PUT /api/admin/tenants/:id/reactivate
 * Reverse of /suspend. Also idempotent.
 */
router.put('/tenants/:id/reactivate', async (req, res) => {
  const id = String(req.params.id || '');
  try {
    const existing = await db.select({ id: tenants.id, isSuspended: tenants.isSuspended })
      .from(tenants).where(eq(tenants.id, id)).get();
    if (!existing) return res.status(404).json({ error: 'Tenant not found' });
    if (!existing.isSuspended) {
      return res.json({ success: true, id, isSuspended: false, already: true });
    }
    await db.update(tenants).set({ isSuspended: false }).where(eq(tenants.id, id));
    res.json({ success: true, id, isSuspended: false });
  } catch (error) {
    console.error('admin reactivate error:', error);
    res.status(500).json({ error: 'Failed to reactivate tenant' });
  }
});

export default router;
