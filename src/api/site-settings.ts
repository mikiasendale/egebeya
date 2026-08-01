import { Router } from 'express';
import { db } from '../db';
import { siteConfig } from '../db/schema';
import { eq } from 'drizzle-orm';
import { requireProPlan } from './pro-site';
import { requireAuth } from './middleware/auth';
import { csrfProtection } from './middleware/csrf';
import { tenantWriteLimiter } from '../../server/middleware/rateLimiter';
import { sanitizePublishedCode } from '../lib/sanitizePublishedCode';

const router = Router();

// Owner-only gate + CSRF + write throttling. tokenVersion is verified so a
// revoked session cannot keep publishing.
router.use(requireAuth({ roles: ['owner'] }));
router.use(csrfProtection);
router.use(tenantWriteLimiter);

// GET /api/tenant/site — fetch builder mode + code HTML
router.get('/site', async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;
    const row = await db.select().from(siteConfig)
      .where(eq(siteConfig.tenantId, tenantId))
      .get();

    if (!row) {
      return res.json({ tenantId, builderMode: 'puck', publishedCodeHtml: null });
    }

    res.json({
      tenantId: row.tenantId,
      builderMode: row.builderMode,
      publishedCodeHtml: row.publishedCodeHtml ?? null,
      updatedAt: row.updatedAt,
    });
  } catch (err) {
    console.error('[site-settings] GET failed:', err);
    res.status(500).json({ error: 'Failed to fetch site config' });
  }
});

// PATCH /api/tenant/site — update builder_mode and/or published_code_html.
//
// SECURITY: published HTML is re-sanitized SERVER-SIDE before persisting
// (DOMPurify via jsdom). The client-side sanitizer is a convenience, not the
// boundary — a malicious/broken client that bypasses it cannot store raw XSS.
router.patch('/site', async (req: any, res) => {
  try {
    const plan = await requireProPlan(req, res);
    if (!plan) return;

    const tenantId = req.user.tenantId;
    const { builderMode, publishedCodeHtml } = req.body;

    if (builderMode !== undefined && builderMode !== 'puck' && builderMode !== 'code') {
      return res.status(400).json({ error: 'builderMode must be "puck" or "code"' });
    }

    let safeHtml: string | null = null;
    if (publishedCodeHtml !== undefined) {
      if (publishedCodeHtml === null) {
        safeHtml = null;
      } else if (typeof publishedCodeHtml === 'string') {
        try {
          safeHtml = await sanitizePublishedCode(publishedCodeHtml);
        } catch (sanitizeErr) {
          console.error('[site-settings] sanitize failed, refusing to store raw HTML:', sanitizeErr);
          return res.status(400).json({ error: 'Published HTML could not be sanitized.' });
        }
      } else {
        return res.status(400).json({ error: 'publishedCodeHtml must be a string or null' });
      }
    }

    const now = Date.now();
    const existing = await db.select().from(siteConfig)
      .where(eq(siteConfig.tenantId, tenantId))
      .get();

    if (existing) {
      const updates: Record<string, any> = { updatedAt: now };
      if (builderMode !== undefined) updates.builderMode = builderMode;
      if (publishedCodeHtml !== undefined) updates.publishedCodeHtml = safeHtml;
      await db.update(siteConfig).set(updates)
        .where(eq(siteConfig.tenantId, tenantId));
    } else {
      await db.insert(siteConfig).values({
        tenantId,
        builderMode: builderMode ?? 'puck',
        publishedCodeHtml: publishedCodeHtml !== undefined ? safeHtml : null,
        updatedAt: now,
      });
    }

    const updated = await db.select().from(siteConfig)
      .where(eq(siteConfig.tenantId, tenantId))
      .get();

    res.json({
      tenantId: updated!.tenantId,
      builderMode: updated!.builderMode,
      publishedCodeHtml: updated!.publishedCodeHtml ?? null,
      updatedAt: updated!.updatedAt,
    });
  } catch (err) {
    console.error('[site-settings] PATCH failed:', err);
    res.status(500).json({ error: 'Failed to update site config' });
  }
});

export default router;
