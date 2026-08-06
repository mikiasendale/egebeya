/**
 * Local Buying Intent — public signal capture + Pro-merchant alert feed.
 *
 *   POST /api/public/intent  — anonymized buying-intent signal (rate-limited
 *                              to 1/min/IP). Fired fire-and-forget from
 *                              /discover when a visitor searches or clicks.
 *   GET  /api/tenant/alerts  — recent demand pulses for the authenticated
 *                              Pro tenant (Market Pulse widget).
 */
import { Router } from 'express';
import { db } from '../db';
import { searchIntent, proAlerts, tenants, tenantSubscriptions, plans } from '../db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import crypto from 'crypto';
import { z } from 'zod';
import { requireAuth } from './middleware/auth';
import { csrfProtection } from './middleware/csrf';
import { intentLimiter } from '../../server/middleware/rateLimiter';

const router = Router();

/**
 * POST /api/public/intent
 *
 * Record one anonymized buying-intent signal. `action` is 'view' (browsing the
 * directory) or 'search' (filtered by category/city/query or clicked a card).
 * No PII — just category + city + action. Rate-limited to 1/min/IP to keep
 * the table from being spammed.
 *
 * Validated loosely: unknown categories/cities are stored as-is (they drive
 * aggregation), but the payload shape is enforced.
 */
const IntentSchema = z.object({
  category: z.string().max(64).optional(),
  city: z.string().max(128).optional(),
  action: z.enum(['view', 'search']),
});

router.post('/intent', intentLimiter, async (req, res) => {
  try {
    const parsed = IntentSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(422).json({ error: 'Invalid intent payload', details: parsed.error.issues });
    }

    const { category, city, action } = parsed.data;
    await db.insert(searchIntent).values({
      id: crypto.randomUUID(),
      category: category?.trim() || null,
      city: city?.trim() || null,
      action,
      createdAt: Date.now(),
    });

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Intent record error:', error);
    res.status(500).json({ error: 'Failed to record intent' });
  }
});

/**
 * GET /api/tenant/alerts
 *
 * Returns recent demand-pulse alerts for the authenticated tenant, newest
 * first. Used by the Market Pulse widget. Includes only alerts created in the
 * last 7 days so the widget stays fresh. Owner-only.
 */
router.get('/alerts', requireAuth({ roles: ['owner'] }), csrfProtection, async (req, res) => {
  const { tenantId } = (req as any).user;
  try {
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const rows = await db.select({
      id: proAlerts.id,
      category: proAlerts.category,
      city: proAlerts.city,
      actionCount: proAlerts.actionCount,
      message: proAlerts.message,
      createdAt: proAlerts.createdAt,
    })
      .from(proAlerts)
      .where(and(eq(proAlerts.tenantId, tenantId), gte(proAlerts.createdAt, since)))
      .orderBy(desc(proAlerts.createdAt))
      .all();

    res.json(rows);
  } catch (error) {
    console.error('Alerts fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

export default router;
