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
import { nonceCsp } from '../../server/middleware/nonceCsp';

const router = Router();

const TEMPLATE_DIR = path.join(process.cwd(), 'server', 'templates', 'pro-starter-vanilla');

router.use(requireAuth({ roles: ['owner'] }));
router.use(csrfProtection);
router.use(tenantWriteLimiter);
router.use(nonceCsp);

export async function requireProPlan(req: any, res: any) {
  const { tenantId } = (req as any).user;
  const subscription = await db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId)).get();
  if (!subscription) {
    res.status(403).json({ error: 'No active subscription. Complete setup first.', code: 'PLAN_REQUIRED' });
    return null;
  }
  if (subscription.status !== 'active' && subscription.status !== 'trial') {
    res.status(403).json({ error: 'An active subscription is required.', code: 'PLAN_REQUIRED' });
    return null;
  }
  const plan = subscription.planId ? await db.select().from(plans).where(eq(plans.id, subscription.planId)).get() : null;
  if (!plan || (plan.name ?? '').toLowerCase() !== 'pro') {
    res.status(403).json({ error: 'The code editor is available on the Pro plan only.', code: 'PLAN_REQUIRED' });
    return null;
  }
  if (subscription.status === 'trial' && typeof subscription.trialEndsAt === 'number' && subscription.trialEndsAt <= Date.now()) {
    res.status(403).json({ error: 'Your Pro trial has expired. Renew to keep using the code editor.', code: 'TRIAL_EXPIRED' });
    return null;
  }
  if (subscription.status === 'active' && typeof subscription.endsAt === 'number' && subscription.endsAt <= Date.now()) {
    if (subscription.endsAt + GRACE_PERIOD_MS > Date.now()) {
      res.locals.plan = { state: 'grace', renewRequired: true, endsAt: subscription.endsAt };
      return plan;
    }
    res.status(403).json({ error: 'Your Pro subscription has expired. Renew to keep using Pro features.', code: 'PLAN_EXPIRED' });
    return null;
  }
  return plan;
}

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

router.post('/pro-site/init', async (req, res) => {
  try {
    const plan = await requireProPlan(req, res);
    if (!plan) return;
    const existing = await db.select({ id: proSiteFiles.id }).from(proSiteFiles).where(eq(proSiteFiles.tenantId, (req as any).user.tenantId)).all();
    if (existing.length > 0) {
      return res.json({ success: true, seeded: false, count: existing.length });
    }
    if (!fs.existsSync(TEMPLATE_DIR)) {
      return res.status(500).json({ error: 'Starter template not found on the server.' });
    }
    const files = readTemplateFiles();
    const now = Date.now();
    const rows = Object.entries(files).map(([filePath, content]) => ({ id: crypto.randomUUID(), tenantId: (req as any).user.tenantId, filePath, content, updatedAt: now }));
    if (rows.length > 0) {
      await db.insert(proSiteFiles).values(rows);
    }
    res.json({ success: true, seeded: true, count: rows.length });
  } catch (error) {
    console.error('Pro-site init error:', error);
    res.status(500).json({ error: 'Failed to initialise pro site' });
  }
});

router.get('/pro-site/files', async (req, res) => {
  try {
    const plan = await requireProPlan(req, res);
    if (!plan) return;
    const rows = await db.select().from(proSiteFiles).where(eq(proSiteFiles.tenantId, (req as any).user.tenantId)).all();
    const out: Record<string, string> = {};
    for (const r of rows) out[r.filePath] = r.content;
    res.json(out);
  } catch (error) {
    console.error('Pro-site fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch pro site files' });
  }
});

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
    const validated = entries.filter(([p, c]) => typeof p === 'string' && p.trim().length > 0 && typeof c === 'string');
    if (validated.length === 0) {
      return res.status(400).json({ error: 'No valid files provided' });
    }
    const now = Date.now();
    const rows = validated.map(([filePath, content]) => ({ id: crypto.randomUUID(), tenantId, filePath, content, updatedAt: now }));
    await db.insert(proSiteFiles).values(rows).onConflictDoUpdate({ target: [proSiteFiles.tenantId, proSiteFiles.filePath], set: { content: sql`excluded.content`, updatedAt: now } });
    res.json({ success: true, count: validated.length });
  } catch (error) {
    console.error('Pro-site upsert error:', error);
    res.status(500).json({ error: 'Failed to save pro site files' });
  }
});

export default router;
