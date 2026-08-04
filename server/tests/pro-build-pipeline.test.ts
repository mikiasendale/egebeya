/**
 * Pro build pipeline verification.
 *
 * Verifies:
 *   1. POST /api/tenant/pro-site/init seeds the vanilla template files
 *   2. POST /api/tenant/site/publish sanitizes and writes a build to disk
 *   3. Sanitization strips <script>alert(1)</script> and onclick handlers
 *   4. Allowed iframes (matching PUBLIC_EMBED_DOMAIN) are preserved
 *   5. The published build is served via GET /api/public/pro-build
 *   6. The active_build_id pointer is updated correctly
 *   7. Old builds remain on disk for rollback
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';

import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import {
  tenants,
  users,
  tenantSubscriptions,
  plans,
  proSiteFiles,
  siteConfig,
} from '../../src/db/schema';

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

describe('Pro build pipeline', () => {
  const slug = `pro-build-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  const phone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  const email = `pro-build-${Date.now()}@egebeya.test`;

  let tenantId: string;
  let userId: string;
  let ownerToken: string;

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    userId = crypto.randomUUID();

    await db.insert(tenants).values({
      id: tenantId,
      name: 'Pro Build Test',
      slug,
      settings: { require_payment_upfront: false },
      createdAt: Date.now(),
    });

    await db.insert(users).values({
      id: userId,
      tenantId,
      name: 'Pro Build Owner',
      phone,
      email,
      passwordHash: await bcrypt.hash('testPass123', 10),
      role: 'owner',
      createdAt: Date.now(),
    });

    // Upgrade to Pro with a trial
    const proPlan = await db.select().from(plans).where(eq(plans.name, 'pro')).get();
    if (proPlan) {
      await db.insert(tenantSubscriptions).values({
        id: crypto.randomUUID(),
        tenantId,
        planId: proPlan.id,
        status: 'trial',
        trialEndsAt: Date.now() + 14 * 24 * 3600_000,
        startsAt: Date.now(),
      });
    }

    // Create an owner JWT for subsequent authenticated requests.
    ownerToken = require('jsonwebtoken').sign(
      { userId, tenantId, role: 'owner', tokenVersion: 0 },
      JWT_SECRET,
      { expiresIn: '15m' },
    );

    // Clean up any previous build files for this tenant.
    const buildsDir = path.join(process.cwd(), 'storage', 'pro-builds', tenantId);
    if (fs.existsSync(buildsDir)) {
      fs.rmSync(buildsDir, { recursive: true, force: true });
    }
  });

  afterAll(async () => {
    // Clean up DB rows
    await db.delete(proSiteFiles).where(eq(proSiteFiles.tenantId, tenantId));
    await db.delete(siteConfig).where(eq(siteConfig.tenantId, tenantId));
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId));
    await db.delete(users).where(eq(users.id, userId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));

    // Clean up build files
    const buildsDir = path.join(process.cwd(), 'storage', 'pro-builds', tenantId);
    if (fs.existsSync(buildsDir)) {
      fs.rmSync(buildsDir, { recursive: true, force: true });
    }
  });

  function authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${ownerToken}`,
      'Content-Type': 'application/json',
    };
  }

  it('init seeds the vanilla template files from pro-starter-vanilla', async () => {
    const res = await request(app)
      .post('/api/tenant/pro-site/init')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify the seeded files include vanilla template files (not Vite React files).
    const files = await db.select().from(proSiteFiles)
      .where(eq(proSiteFiles.tenantId, tenantId)).all();
    const paths = files.map((f) => f.filePath);
    expect(paths).toContain('index.html');
    expect(paths).toContain('style.css');
    expect(paths).toContain('script.js');

    // Confirm it's NOT the old Vite React starter
    expect(paths).not.toContain('package.json');
    expect(paths).not.toContain('App.js');
  });

  it('publish rejects when Pro plan is not active (missing)', async () => {
    // Temporarily remove the Pro subscription to test the gate.
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId));

    const res = await request(app)
      .post('/api/tenant/site/publish')
      .set(authHeaders());

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_REQUIRED');

    // Restore it for the rest of the test.
    const proPlan = await db.select().from(plans).where(eq(plans.name, 'pro')).get();
    if (proPlan) {
      await db.insert(tenantSubscriptions).values({
        id: crypto.randomUUID(),
        tenantId,
        planId: proPlan.id,
        status: 'trial',
        trialEndsAt: Date.now() + 14 * 24 * 3600_000,
        startsAt: Date.now(),
      });
    }
  });

  it('publish writes sanitized HTML to storage/pro-builds/ and updates active_build_id', async () => {
    // First, update the seeded index.html to include deliberate XSS vectors
    // so we can verify sanitization strips them.
    const maliciousHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>XSS Test</title>
</head>
<body>
  <h1>Safe Content</h1>
  <script>alert(1)</script>
  <p onclick="alert('clicked')">Click me</p>
  <a href="javascript:alert('xss')">Malicious link</a>
  <iframe src="https://evil.com/xss"></iframe>
  <iframe src=""></iframe>
</body>
</html>`;

    await db.update(proSiteFiles)
      .set({ content: maliciousHtml, updatedAt: Date.now() })
      .where(eq(proSiteFiles.tenantId, tenantId));

    const res = await request(app)
      .post('/api/tenant/site/publish')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.buildId).toBe('string');
    expect(res.body.buildId.length).toBeGreaterThan(0);
    expect(res.body.tenantId).toBe(tenantId);

    // Verify active_build_id was set
    const config = await db.select().from(siteConfig)
      .where(eq(siteConfig.tenantId, tenantId)).get();
    expect(config).toBeDefined();
    expect(config!.activeBuildId).toBe(res.body.buildId);

    // Verify build files exist on disk
    const buildPath = path.join(process.cwd(), 'storage', 'pro-builds', tenantId, res.body.buildId, 'index.html');
    expect(fs.existsSync(buildPath)).toBe(true);

    const publishedHtml = fs.readFileSync(buildPath, 'utf8');

    // Verify <script>alert(1)</script> was STRIPPED
    expect(publishedHtml).not.toContain('alert(1)');
    expect(publishedHtml).not.toMatch(/<script>/);

    // Verify onclick handler was STRIPPED
    expect(publishedHtml).not.toContain('onclick');
    expect(publishedHtml).not.toContain('alert(\'clicked\')');

    // Verify javascript: URIs were STRIPPED
    expect(publishedHtml).not.toContain('javascript:');

    // Verify evil iframe had its src stripped
    expect(publishedHtml).not.toContain('evil.com');

    // Verify safe content is preserved
    expect(publishedHtml).toContain('Safe Content');
    expect(publishedHtml).toContain('<h1>Safe Content</h1>');

    // The empty iframe should be preserved (no src to strip)
    expect(publishedHtml).toContain('<iframe');
  });

  it('publish preserves allowed iframe src matching PUBLIC_EMBED_DOMAIN', async () => {
    const embedDomain = process.env.PUBLIC_EMBED_DOMAIN || process.env.APP_URL || 'http://localhost:3000';
    const embedOrigin = new URL(embedDomain).origin;

    const htmlWithSafeIframe = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Iframe Test</title></head>
<body>
  <h1>Widget Test</h1>
  <iframe src="${embedOrigin}/booking-widget" width="100%" height="400"></iframe>
</body>
</html>`;

    await db.update(proSiteFiles)
      .set({ content: htmlWithSafeIframe, updatedAt: Date.now() })
      .where(eq(proSiteFiles.tenantId, tenantId));

    const res = await request(app)
      .post('/api/tenant/site/publish')
      .set(authHeaders());

    expect(res.status).toBe(200);

    const buildPath = path.join(process.cwd(), 'storage', 'pro-builds', tenantId, res.body.buildId, 'index.html');
    const publishedHtml = fs.readFileSync(buildPath, 'utf8');

    // The safe iframe should be preserved (origin matches)
    expect(publishedHtml).toContain(embedOrigin);
    expect(publishedHtml).toContain('booking-widget');
  });

  it('publish creates a second build without removing the first (rollback safety)', async () => {
    const res1 = await request(app)
      .post('/api/tenant/site/publish')
      .set(authHeaders());
    expect(res1.status).toBe(200);
    const buildId1 = res1.body.buildId;

    const res2 = await request(app)
      .post('/api/tenant/site/publish')
      .set(authHeaders());
    expect(res2.status).toBe(200);
    const buildId2 = res2.body.buildId;

    // Both build directories should exist
    const dir1 = path.join(process.cwd(), 'storage', 'pro-builds', tenantId, buildId1);
    const dir2 = path.join(process.cwd(), 'storage', 'pro-builds', tenantId, buildId2);
    expect(fs.existsSync(path.join(dir1, 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(dir2, 'index.html'))).toBe(true);

    // active_build_id should point to the latest build
    const config = await db.select().from(siteConfig)
      .where(eq(siteConfig.tenantId, tenantId)).get();
    expect(config!.activeBuildId).toBe(buildId2);
  });

  it('GET /api/public/pro-build serves the published HTML for the resolved tenant', async () => {
    const res = await request(app)
      .get('/api/public/pro-build')
      .set('X-Tenant-Slug', slug);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    // The last publish was the safe iframe test
    expect(res.text).toContain('Widget Test');
    expect(res.text).toContain('booking-widget');

    // Verify Strict CSP header is present
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect(res.headers['content-security-policy']).toContain('frame-src');
  });

  it('GET /api/public/pro-build returns 404 for a tenant with no build', async () => {
    // Create a new tenant with no build
    const noBuildTenantId = crypto.randomUUID();
    const noBuildSlug = `no-build-${Date.now()}`;
    await db.insert(tenants).values({
      id: noBuildTenantId,
      name: 'No Build',
      slug: noBuildSlug,
      createdAt: Date.now(),
    });

    const res = await request(app)
      .get('/api/public/pro-build')
      .set('X-Tenant-Slug', noBuildSlug);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/No published build/i);

    // Cleanup
    await db.delete(tenants).where(eq(tenants.id, noBuildTenantId));
  });

  // ---- New endpoints: list builds + reactivate (rollback) ----

  it('GET /api/tenant/site/builds lists all builds (newest-first) and marks the active one', async () => {
    const res = await request(app)
      .get('/api/tenant/site/builds')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.builds)).toBe(true);
    expect(res.body.builds.length).toBeGreaterThanOrEqual(3); // at least 3 publishes happened above

    // The newest build should be first.
    const builds = res.body.builds as Array<{ createdAt: number; isActive: boolean }>;
    for (let i = 1; i < builds.length; i++) {
      expect(builds[i - 1].createdAt).toBeGreaterThanOrEqual(builds[i].createdAt);
    }

    // Exactly one build should be marked active.
    const activeCount = builds.filter((b) => b.isActive).length;
    expect(activeCount).toBe(1);
    expect(res.body.activeBuildId).toBeDefined();
  });

  it('POST /api/tenant/site/builds/:buildId/activate reactivates an older build (rollback)', async () => {
    // 1. Capture the current active build id and pick the oldest build to
    //    reactivate (simulating a rollback to an earlier deploy).
    const listRes = await request(app)
      .get('/api/tenant/site/builds')
      .set(authHeaders());

    expect(listRes.status).toBe(200);
    const builds = listRes.body.builds as Array<{
      buildId: string;
      isActive: boolean;
    }>;
    const activeBuild = builds.find((b) => b.isActive);
    const oldestBuild = builds[builds.length - 1]; // sorted newest-first

    expect(oldestBuild.buildId).not.toBe(activeBuild?.buildId);

    // 2. Activate the oldest build.
    const activateRes = await request(app)
      .post(`/api/tenant/site/builds/${oldestBuild.buildId}/activate`)
      .set(authHeaders());

    expect(activateRes.status).toBe(200);
    expect(activateRes.body.success).toBe(true);
    expect(activateRes.body.buildId).toBe(oldestBuild.buildId);

    // 3. Verify active_build_id now points to the old build.
    const config = await db.select().from(siteConfig)
      .where(eq(siteConfig.tenantId, tenantId)).get();
    expect(config!.activeBuildId).toBe(oldestBuild.buildId);

    // 4. Verify the published_code_html corresponds to the old build file.
    const oldBuildPath = path.join(
      process.cwd(), 'storage', 'pro-builds',
      tenantId, oldestBuild.buildId, 'index.html',
    );
    const oldBuildHtml = fs.readFileSync(oldBuildPath, 'utf8');
    expect(config!.publishedCodeHtml).toBe(oldBuildHtml);

    // 5. Verify GET /api/public/pro-build serves the reactivated build (its
    //    exact content, whatever it is).
    const publicRes = await request(app)
      .get('/api/public/pro-build')
      .set('X-Tenant-Slug', slug);

    expect(publicRes.status).toBe(200);
    expect(publicRes.text).toBe(oldBuildHtml);
  });

  it('POST /api/tenant/site/builds/:buildId/activate returns 404 for a nonexistent build', async () => {
    const fakeBuildId = crypto.randomUUID();
    const res = await request(app)
      .post(`/api/tenant/site/builds/${fakeBuildId}/activate`)
      .set(authHeaders());

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('GET /api/tenant/site/builds returns empty array for a tenant with no builds', async () => {
    // Create a new tenant with no builds.
    const noBuildsTenantId = crypto.randomUUID();
    const noBuildsUserId = crypto.randomUUID();
    const noBuildsSlug = `no-builds-${Date.now()}`;
    const noBuildsPhone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    const noBuildsEmail = `no-builds-${Date.now()}@egebeya.test`;

    await db.insert(tenants).values({
      id: noBuildsTenantId,
      name: 'No Builds Tenant',
      slug: noBuildsSlug,
      settings: {},
      createdAt: Date.now(),
    });
    await db.insert(users).values({
      id: noBuildsUserId,
      tenantId: noBuildsTenantId,
      name: 'No Builds Owner',
      phone: noBuildsPhone,
      email: noBuildsEmail,
      passwordHash: await bcrypt.hash('testPass123', 10),
      role: 'owner',
      createdAt: Date.now(),
    });
    const proPlan = await db.select().from(plans).where(eq(plans.name, 'pro')).get();
    if (proPlan) {
      await db.insert(tenantSubscriptions).values({
        id: crypto.randomUUID(),
        tenantId: noBuildsTenantId,
        planId: proPlan.id,
        status: 'active',
        startsAt: Date.now(),
      });
    }
    const noBuildsToken = require('jsonwebtoken').sign(
      { userId: noBuildsUserId, tenantId: noBuildsTenantId, role: 'owner', tokenVersion: 0 },
      JWT_SECRET,
      { expiresIn: '15m' },
    );

    const res = await request(app)
      .get('/api/tenant/site/builds')
      .set('Authorization', `Bearer ${noBuildsToken}`)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.builds).toEqual([]);

    // Cleanup
    await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, noBuildsTenantId));
    await db.delete(users).where(eq(users.id, noBuildsUserId));
    await db.delete(tenants).where(eq(tenants.id, noBuildsTenantId));
  });
});