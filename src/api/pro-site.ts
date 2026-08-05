import { Router } from 'express';
import { db } from '../db';
import { proSiteFiles, tenantSubscriptions, plans } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { requireAuth } from './middleware/auth';
import { csrfProtection } from './middleware/csrf';
import { tenantWriteLimiter } from '../../server/middleware/rateLimiter';
import { GRACE_PERIOD_MS } from '../../server/lib/billing';

const router = Router();

// Resolver for the starter template directory on disk. Defined once and
// memoised so repeated /init calls don't re-stat the filesystem.
const TEMPLATE_DIR = path.join(process.cwd(), 'server', 'templates', 'pro-starter-vanilla');

// Owner-only auth gate (cookie or Bearer) + CSRF + write throttling.
router.use(requireAuth({ roles: ['owner'] }));
router.use(csrfProtection);
router.use(tenantWriteLimiter);

/**
 * Enforce that the caller's tenant is currently on the Pro plan. A `trial`
 * status is tolerated, but an EXPIRED trial or any non-Pro plan is rejected.
 *
 * Check order:
 *   1. no subscription          → 403 PLAN_REQUIRED
 *   2. status not active/trial  → 403 PLAN_REQUIRED
 *   3. plan is not Pro          → 403 PLAN_REQUIRED
 *   4. trial lapsed             → 403 TRIAL_EXPIRED
 */
export async function requireProPlan(req: any, res: any) {
  const { tenantId } = (req as any).user;
  const subscription = await db.select().from(tenantSubscriptions)
    .where(eq(tenantSubscriptions.tenantId, tenantId)).get();
  if (!subscription) {
    res.status(403).json({ error: 'No active subscription. Complete setup first.', code: 'PLAN_REQUIRED' });
    return null;
  }
  if (subscription.status !== 'active' && subscription.status !== 'trial') {
    res.status(403).json({ error: 'An active subscription is required.', code: 'PLAN_REQUIRED' });
    return null;
  }
  const plan = subscription.planId
    ? await db.select().from(plans).where(eq(plans.id, subscription.planId)).get()
    : null;
  if (!plan || (plan.name ?? '').toLowerCase() !== 'pro') {
    res.status(403).json({ error: 'The code editor is available on the Pro plan only.', code: 'PLAN_REQUIRED' });
    return null;
  }
  if (
    subscription.status === 'trial' &&
    typeof subscription.trialEndsAt === 'number' &&
    subscription.trialEndsAt <= Date.now()
  ) {
    res.status(403).json({ error: 'Your Pro trial has expired. Renew to keep using the code editor.', code: 'TRIAL_EXPIRED' });
    return null;
  }

  // Grace period for PAID Pro subscriptions: when `endsAt` has lapsed but we
  // are still within the 5-day grace window, access is granted (the frontend
  // shows a "Renew" banner). Past the grace window the subscription is
  // treated as expired and the gate denies access.
  if (
    subscription.status === 'active' &&
    typeof subscription.endsAt === 'number' &&
    subscription.endsAt <= Date.now()
  ) {
    if (subscription.endsAt + GRACE_PERIOD_MS > Date.now()) {
      res.locals.plan = { state: 'grace', renewRequired: true, endsAt: subscription.endsAt };
      return plan;
    }
    res.status(403).json({
      error: 'Your Pro subscription has expired. Renew to keep using Pro features.',
      code: 'PLAN_EXPIRED',
    });
    return null;
  }

  return plan;
}

/**
 * POST /api/tenant/subscription/upgrade — move the tenant onto the Pro plan
 * with a fresh 14-day trial. Idempotent.
 *
 * SECURITY: this is a DEV/TEST-ONLY trial path. There is no payment
 * verification, so it MUST NOT be reachable in production under any
 * circumstance — including ENABLE_TEST_ENDPOINTS=true in production. The
 * mount condition explicitly rejects production so a misconfigured operator
 * cannot accidentally expose a free-Pro upgrade on a live deployment.
 *
 * In non-production environments the endpoint stays mounted so dev and
 * vitest suites can exercise the trial path. Real production billing must
 * route through the Chapa payment gateway (webhook-driven) before granting
 * Pro.
 */
if (process.env.NODE_ENV !== 'production') {
  router.post('/subscription/upgrade', async (req, res) => {
    const { tenantId } = (req as any).user;
    try {
      const allPlans = await db.select().from(plans).all();
      const proPlan = allPlans.find((p) => (p.name ?? '').toLowerCase() === 'pro');
      if (!proPlan) {
        return res.status(500).json({ error: 'Pro plan is not configured on this platform.' });
      }

      const existing = await db.select().from(tenantSubscriptions)
        .where(eq(tenantSubscriptions.tenantId, tenantId)).get();

      const now = Date.now();
      const trialEndsAt = now + 14 * 24 * 3600 * 1000;

      if (existing) {
        const alreadyProTrial = existing.planId === proPlan.id && existing.status === 'trial';
        if (!alreadyProTrial) {
          await db.update(tenantSubscriptions).set({
            planId: proPlan.id,
            status: 'trial',
            trialEndsAt,
            startsAt: now,
          }).where(eq(tenantSubscriptions.tenantId, tenantId));
        }
      } else {
        await db.insert(tenantSubscriptions).values({
          id: crypto.randomUUID(),
          tenantId,
          planId: proPlan.id,
          status: 'trial',
          trialEndsAt,
          startsAt: now,
        });
      }

      const subscription = await db.select().from(tenantSubscriptions)
        .where(eq(tenantSubscriptions.tenantId, tenantId)).get();
      const plan = subscription?.planId
        ? await db.select().from(plans).where(eq(plans.id, subscription.planId)).get()
        : null;

      res.json({
        success: true,
        unchanged: existing?.planId === proPlan.id && existing.status === 'trial',
        plan,
        subscription,
      });
    } catch (error) {
      console.error('Upgrade error:', error);
      res.status(500).json({ error: 'Failed to upgrade subscription' });
    }
  });
}

/**
 * Read every file under TEMPLATE_DIR (recursively) into a { path: content }
 * map. Skips directories. Relative paths are normalised to forward slashes
 * so they match what the WebContainer/Sandpack file map expects.
 */
function readTemplateFiles(): Record<string, string> {
  const out: Record<string, string> = {};
  function walk(dir: string, base: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const rel = base ? `${base}/${e.name}` : e.name;
      if (e.isDirectory()) {
        walk(full, rel);
      } else {
        out[rel.replace(/\\/g, '/')] = fs.readFileSync(full, 'utf8');
      }
    }
  }
  walk(TEMPLATE_DIR, '');
  return out;
}

// POST /api/tenant/pro-site/init
// Seeds the authenticated tenant's pro_site_files from the starter template.
// Idempotent: if the tenant already has any rows, no-op (returns 200) so it
// never clobbers user edits — this is safe to call on a Pro upgrade or
// manually for testing.
router.post('/pro-site/init', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const plan = await requireProPlan(req, res);
    if (!plan) return;

    const existing = await db.select({ id: proSiteFiles.id })
      .from(proSiteFiles)
      .where(eq(proSiteFiles.tenantId, tenantId))
      .all();
    if (existing.length > 0) {
      return res.json({ success: true, seeded: false, count: existing.length });
    }

    if (!fs.existsSync(TEMPLATE_DIR)) {
      return res.status(500).json({ error: 'Starter template not found on the server.' });
    }
    const files = readTemplateFiles();
    const now = Date.now();
    const rows = Object.entries(files).map(([filePath, content]) => ({
      id: crypto.randomUUID(),
      tenantId,
      filePath,
      content,
      updatedAt: now,
    }));
    if (rows.length > 0) {
      await db.insert(proSiteFiles).values(rows);
    }
    res.json({ success: true, seeded: true, count: rows.length });
  } catch (error) {
    console.error('Pro-site init error:', error);
    res.status(500).json({ error: 'Failed to initialise pro site' });
  }
});

// GET /api/tenant/pro-site/files
// Returns the tenant's files as a { path: content } map.
router.get('/pro-site/files', async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const plan = await requireProPlan(req, res);
    if (!plan) return;

    const rows = await db.select().from(proSiteFiles)
      .where(eq(proSiteFiles.tenantId, tenantId)).all();
    const out: Record<string, string> = {};
    for (const r of rows) out[r.filePath] = r.content;
    res.json(out);
  } catch (error) {
    console.error('Pro-site fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch pro site files' });
  }
});

// PUT /api/tenant/pro-site/files
// Accepts a { path: content } map and upserts each entry into pro_site_files
// for the authenticated tenant. Missing rows are inserted; existing rows are
// updated in place. The unique (tenantId, filePath) index guarantees a single
// row per path so the upsert resolves to a clean update.
router.put('/pro-site/files', async (req, res) => {
  const { tenantId } = (req as any).user;
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Body must be a { path: content } object' });
  }

  try {
    const plan = await requireProPlan(req, res);
    if (!plan) return;

    const entries = Object.entries(body) as [string, string][];
    // Reject obviously bad values up front to keep the row store clean.
    const validated = entries.filter(
      ([p, c]) => typeof p === 'string' && p.trim().length > 0 && typeof c === 'string',
    );
    if (validated.length === 0) {
      return res.status(400).json({ error: 'No valid files provided' });
    }

    const now = Date.now();
    // Batch upsert in a SINGLE statement (N+1 elimination): the unique
    // (tenant_id, file_path) index lets one INSERT ... ON CONFLICT DO UPDATE
    // handle both new rows (insert) and existing rows (update) without a
    // per-file SELECT → UPDATE/INSERT round trip.
    const rows = validated.map(([filePath, content]) => ({
      id: crypto.randomUUID(),
      tenantId,
      filePath,
      content,
      updatedAt: now,
    }));

    await db.insert(proSiteFiles)
      .values(rows)
      .onConflictDoUpdate({
        target: [proSiteFiles.tenantId, proSiteFiles.filePath],
        set: { content: sql`excluded.content`, updatedAt: now },
      });

    res.json({ success: true, count: validated.length });
  } catch (error) {
    console.error('Pro-site upsert error:', error);
    res.status(500).json({ error: 'Failed to save pro site files' });
  }
});

export default router;
