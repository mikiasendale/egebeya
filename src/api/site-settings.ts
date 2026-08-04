import { Router } from 'express';
import { db } from '../db';
import { siteConfig, proSiteFiles, tenants } from '../db/schema';
import { eq } from 'drizzle-orm';
import { requireProPlan } from './pro-site';
import { requireAuth } from './middleware/auth';
import { csrfProtection } from './middleware/csrf';
import { tenantWriteLimiter } from '../../server/middleware/rateLimiter';
import { sanitizePublishedCode } from '../lib/sanitizePublishedCode';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const router = Router();

// Root directory for published Pro builds. Each build lives under
// storage/pro-builds/{tenantId}/{buildId}/.
const BUILDS_ROOT = path.join(process.cwd(), 'storage', 'pro-builds');

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
      return res.json({ tenantId, builderMode: 'puck', publishedCodeHtml: null, activeBuildId: null });
    }

    res.json({
      tenantId: row.tenantId,
      builderMode: row.builderMode,
      publishedCodeHtml: row.publishedCodeHtml ?? null,
      activeBuildId: row.activeBuildId ?? null,
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

/**
 * POST /api/tenant/site/publish — publish the tenant's Code Mode files as a
 * static build.
 *
 * Reads the tenant's current code files from pro_site_files, builds a single
 * HTML document (inlining CSS/JS), sanitizes it SERVER-SIDE, writes the result
 * to storage/pro-builds/{tenantId}/{buildId}/index.html, and atomically
 * updates active_build_id when all files are written. Old build directories are
 * preserved for rollback — the previous active build stays on disk.
 *
 * SECURITY: All script tags, inline event handlers, and javascript: URIs are
 * stripped by DOMPurify. Only iframes whose src origin matches the app's own
 * public domain (PUBLIC_EMBED_DOMAIN or APP_URL) are allowed.
 *
 * Response includes the buildId and the public URL the site can be accessed at.
 */
router.post('/site/publish', async (req: any, res) => {
  try {
    const plan = await requireProPlan(req, res);
    if (!plan) return;

    const tenantId = req.user.tenantId;

    // 1. Gather the tenant's code files from pro_site_files.
    const files = await db.select({ filePath: proSiteFiles.filePath, content: proSiteFiles.content })
      .from(proSiteFiles)
      .where(eq(proSiteFiles.tenantId, tenantId))
      .all();

    if (files.length === 0) {
      return res.status(400).json({ error: 'No code files found. Run /pro-site/init first or save some code.' });
    }

    // 2. Assemble a single index.html from the file map. If the user already
    //    has an index.html in their files, use it; otherwise build from parts.
    const fileMap = new Map(files.map((f) => [f.filePath, f.content]));
    let rawHtml = fileMap.get('index.html') || fileMap.get('/index.html') || '';

    // If there's no explicit index.html, compose one from the available parts.
    if (!rawHtml) {
      const css = fileMap.get('style.css') || fileMap.get('/style.css') || '';
      const js = fileMap.get('script.js') || fileMap.get('/script.js') || '';
      rawHtml = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1.0">' +
        '<title>My Site</title>' +
        (css ? `<style>\n${css}\n</style>` : '') +
        '</head><body>' +
        (js ? `<script>\n${js}\n</script>` : '') +
        '</body></html>';
    } else {
      // If the user's index.html references external style.css/script.js,
      // inline them for standalone serving (no build step means no bundler).
      const cssContent = fileMap.get('style.css') || fileMap.get('/style.css');
      const jsContent = fileMap.get('script.js') || fileMap.get('/script.js');
      if (cssContent && !rawHtml.includes('<style>')) {
        rawHtml = rawHtml.replace('</head>', `<style>\n${cssContent}\n</style>\n</head>`);
      }
      if (jsContent && !rawHtml.includes('<script>')) {
        rawHtml = rawHtml.replace('</body>', `<script>\n${jsContent}\n</script>\n</body>`);
      }
    }

    // 3. Sanitize (server-side, non-negotiable).
    const extraOrigins = [
      process.env.PUBLIC_EMBED_DOMAIN || process.env.APP_URL || '',
      process.env.VITE_APP_URL || '',
    ].filter(Boolean);
    let sanitized: string;
    try {
      sanitized = await sanitizePublishedCode(rawHtml, extraOrigins);
    } catch (sanitizeErr: any) {
      const msg = sanitizeErr?.message || 'Unknown sanitization error';
      console.error('[site-settings] PUBLISH sanitize failed:', sanitizeErr);
      return res.status(400).json({
        error: `Published HTML could not be sanitized: ${msg}`,
        stage: 'sanitization',
      });
    }

    // 4. Write to disk.
    const buildId = crypto.randomUUID();
    const buildDir = path.join(BUILDS_ROOT, tenantId, buildId);
    fs.mkdirSync(buildDir, { recursive: true });
    fs.writeFileSync(path.join(buildDir, 'index.html'), sanitized, 'utf8');

    // 5. Atomically update active_build_id.
    const now = Date.now();
    const existing = await db.select().from(siteConfig)
      .where(eq(siteConfig.tenantId, tenantId))
      .get();

    if (existing) {
      await db.update(siteConfig).set({
        activeBuildId: buildId,
        publishedCodeHtml: sanitized,
        updatedAt: now,
      }).where(eq(siteConfig.tenantId, tenantId));
    } else {
      await db.insert(siteConfig).values({
        tenantId,
        builderMode: 'code',
        publishedCodeHtml: sanitized,
        activeBuildId: buildId,
        updatedAt: now,
      });
    }

    // Determine the public URL for this tenant's site.
    const appUrl = process.env.APP_URL || process.env.PUBLIC_EMBED_DOMAIN || 'http://localhost:3000';
    const tenantRow = await db.select({ slug: tenants.slug })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .get();

    res.json({
      success: true,
      buildId,
      tenantId,
      publicUrl: tenantRow?.slug ? `${appUrl}/${tenantRow.slug}` : null,
      sanitizedSize: sanitized.length,
    });
  } catch (err) {
    console.error('[site-settings] PUBLISH failed:', err);
    res.status(500).json({ error: 'Failed to publish site' });
  }
});

/**
 * GET /api/tenant/site/builds — list all published builds for the tenant.
 *
 * Scans storage/pro-builds/{tenantId}/ for build directories, reads each
 * index.html file's mtime as the build timestamp, and marks the one matching
 * site_config.active_build_id as active. Sorted newest-first.
 *
 * Used by the Code Mode "Deploy history" panel so the owner can see past
 * builds and reactivate an earlier one (rollback).
 */
router.get('/site/builds', async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;
    const tenantBuildsDir = path.join(BUILDS_ROOT, tenantId);

    // Get the current active build id for isActive flagging.
    const config = await db.select({ activeBuildId: siteConfig.activeBuildId })
      .from(siteConfig)
      .where(eq(siteConfig.tenantId, tenantId))
      .get();
    const activeBuildId = config?.activeBuildId ?? null;

    if (!fs.existsSync(tenantBuildsDir)) {
      return res.json({ builds: [] });
    }

    const entries = fs.readdirSync(tenantBuildsDir, { withFileTypes: true });
    const builds = entries
      .filter((e) => e.isDirectory())
      .map((dir) => {
        const buildDir = path.join(tenantBuildsDir, dir.name);
        const indexPath = path.join(buildDir, 'index.html');
        if (!fs.existsSync(indexPath)) return null;
        const stat = fs.statSync(indexPath);
        return {
          buildId: dir.name,
          createdAt: stat.mtimeMs,
          createdAtIso: stat.mtime.toISOString(),
          size: stat.size,
          isActive: dir.name === activeBuildId,
        };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .sort((a, b) => b.createdAt - a.createdAt);

    res.json({ builds, activeBuildId });
  } catch (err) {
    console.error('[site-settings] LIST BUILDS failed:', err);
    res.status(500).json({ error: 'Failed to list builds' });
  }
});

/**
 * POST /api/tenant/site/builds/:buildId/activate — reactivate an older build.
 *
 * Reads the build's index.html from storage/pro-builds/{tenantId}/{buildId}/,
 * updates site_config.active_build_id and published_code_html to point at that
 * build, so the tenant's public URL immediately serves the old build.
 *
 * This is the rollback mechanism: the owner sees a problem with the current
 * live site and clicks "Reactivate" on a previous build in the Deploy history
 * panel.
 */
router.post('/site/builds/:buildId/activate', async (req: any, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { buildId } = req.params;

    // Validate the build exists on disk for this tenant.
    const buildDir = path.join(BUILDS_ROOT, tenantId, buildId);
    const indexPath = path.join(buildDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
      return res.status(404).json({ error: 'Build not found. It may have been removed.' });
    }

    // SECURITY: The build's index.html was already sanitized at publish time,
    // but we re-read it to update published_code_html for the editor preview.
    // We do NOT re-sanitize — the file on disk is the authoritative sanitized
    // copy written by the publish endpoint.
    const html = fs.readFileSync(indexPath, 'utf8');

    const now = Date.now();
    const existing = await db.select().from(siteConfig)
      .where(eq(siteConfig.tenantId, tenantId))
      .get();

    if (existing) {
      await db.update(siteConfig).set({
        activeBuildId: buildId,
        publishedCodeHtml: html,
        updatedAt: now,
      }).where(eq(siteConfig.tenantId, tenantId));
    } else {
      await db.insert(siteConfig).values({
        tenantId,
        builderMode: 'code',
        publishedCodeHtml: html,
        activeBuildId: buildId,
        updatedAt: now,
      });
    }

    const appUrl = process.env.APP_URL || process.env.PUBLIC_EMBED_DOMAIN || 'http://localhost:3000';
    const tenantRow = await db.select({ slug: tenants.slug })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .get();

    res.json({
      success: true,
      buildId,
      tenantId,
      publicUrl: tenantRow?.slug ? `${appUrl}/${tenantRow.slug}` : null,
    });
  } catch (err) {
    console.error('[site-settings] ACTIVATE BUILD failed:', err);
    res.status(500).json({ error: 'Failed to activate build' });
  }
});

export default router;
