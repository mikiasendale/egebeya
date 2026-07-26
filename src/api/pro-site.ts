import { Router } from 'express';
import { db } from '../db';
import { proSiteFiles, tenantSubscriptions, plans } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

// Resolver for the starter template directory on disk. Defined once and
// memoised so repeated /init calls don't re-stat the filesystem.
const TEMPLATE_DIR = path.join(process.cwd(), 'server', 'templates', 'pro-starter');

// Mirror of the owner-only auth guard used by tenant.ts. Pro-site files are
// tenant-scoped and only the owner/admin should be able to read, write, or
// initialise them — a staff account has no reason to touch raw source.
router.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.role !== 'owner') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    (req as any).user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

/**
 * Enforce that the caller's tenant is currently on the Pro plan. We tolerate a
 * `trial` subscription status so the seeded test tenant (which is on a trial
 * subscription) can still access the editor — only the plan name matters.
 *
 * Returns the plan row on success; sends a 403 response and returns null on
 * failure. Callers should early-return on a null result.
 */
async function requireProPlan(req: any, res: any) {
  const { tenantId } = (req as any).user;
  const subscription = await db.select().from(tenantSubscriptions)
    .where(eq(tenantSubscriptions.tenantId, tenantId)).get();
  if (!subscription) {
    res.status(403).json({ error: 'No active subscription. Complete setup first.' });
    return null;
  }
  const plan = subscription.planId
    ? await db.select().from(plans).where(eq(plans.id, subscription.planId)).get()
    : null;
  if (!plan || plan.name !== 'Pro') {
    res.status(403).json({ error: 'The code editor is available on the Pro plan only.' });
    return null;
  }
  return plan;
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
    for (const [filePath, content] of validated) {
      const existing = await db.select({ id: proSiteFiles.id })
        .from(proSiteFiles)
        .where(and(eq(proSiteFiles.tenantId, tenantId), eq(proSiteFiles.filePath, filePath)))
        .get();
      if (existing) {
        await db.update(proSiteFiles)
          .set({ content, updatedAt: now })
          .where(eq(proSiteFiles.id, existing.id));
      } else {
        await db.insert(proSiteFiles).values({
          id: crypto.randomUUID(),
          tenantId,
          filePath,
          content,
          updatedAt: now,
        });
      }
    }
    res.json({ success: true, count: validated.length });
  } catch (error) {
    console.error('Pro-site upsert error:', error);
    res.status(500).json({ error: 'Failed to save pro site files' });
  }
});

export default router;
