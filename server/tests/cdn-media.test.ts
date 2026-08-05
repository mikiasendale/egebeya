/**
 * CDN media URL rewriting via UPLOADS_CDN_BASE_URL.
 *
 * The database always stores the relative media path
 * (`/uploads/<tenantId>/<filename>`). When `UPLOADS_CDN_BASE_URL` is
 * configured, the API rewrites those paths to absolute CDN URLs at READ time:
 *   - GET /api/tenant/media  → every item's `path` becomes
 *     `<UPLOADS_CDN_BASE_URL>/<tenantId>/<filename>`
 *   - GET /api/public/page   → any `/uploads/...` string inside the Puck
 *     document (including nested image props) is rewritten
 *
 * The env var is captured at module load, so this file sets it BEFORE
 * importing the API modules (via `vi.resetModules()` + dynamic import). This
 * keeps the shared test process (`.env`, sibling files) untouched.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';

const CDN = 'https://cdn.egebeya.test';

// Populated in beforeAll AFTER resetModules re-imports them with the CDN env
// var present in the module registry.
let app: any;
let request: any;
let db: any;
let schema: any;

describe('CDN media URL rewriting (UPLOADS_CDN_BASE_URL)', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

  let tenantId: string;
  let slug: string;
  let ownerId: string;
  let token: string;
  let mediaId: string;

  beforeAll(async () => {
    process.env.UPLOADS_CDN_BASE_URL = CDN;
    vi.resetModules();

    const expressMod = await import('express');
    const supertestMod = await import('supertest');
    const dbMod = await import('../../src/db');
    const schemaMod = await import('../../src/db/schema');
    const apiRoutes = (await import('../../src/api')).default;

    app = expressMod.default();
    app.use(expressMod.default.json());
    app.use('/api', apiRoutes);
    request = supertestMod.default;
    db = dbMod.db;
    schema = schemaMod;

    tenantId = crypto.randomUUID();
    ownerId = crypto.randomUUID();
    slug = `cdn-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
    mediaId = crypto.randomUUID();

    await db.insert(schema.tenants).values({
      id: tenantId, name: 'CDN Salon', slug,
      isListed: true, isSuspended: false,
      settings: {}, createdAt: Date.now(),
    });
    await db.insert(schema.users).values({
      id: ownerId, tenantId, name: 'CDN Owner',
      phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
      email: `cdn-${slug}@egebeya.test`,
      passwordHash: await bcrypt.hash('pass1234', 10),
      role: 'owner', tokenVersion: 0, refreshTokenId: '',
      createdAt: Date.now(),
    });
    // The DB must keep the RELATIVE path.
    await db.insert(schema.media).values({
      id: mediaId, tenantId,
      path: `/uploads/${tenantId}/a1b2c3.jpg`,
      originalName: 'photo.jpg', mimeType: 'image/jpeg', size: 1024,
      createdAt: Date.now(),
    });
    await db.insert(schema.pages).values({
      tenantId,
      content: {
        content: [
          {
            type: 'Hero',
            props: {
              backgroundImage: `/uploads/${tenantId}/hero.jpg`,
              overlay: {
                image: { src: `/uploads/${tenantId}/nested.png` },
              },
            },
          },
          {
            type: 'Gallery',
            props: { images: [`/uploads/${tenantId}/gallery-1.jpg`, 'https://picsum.photos/200'] },
          },
        ],
        root: {},
      },
    });

    token = jwt.sign(
      { userId: ownerId, tenantId, role: 'owner', tokenVersion: 0 },
      JWT_SECRET,
      { expiresIn: '15m' },
    );
  });

  afterAll(async () => {
    await db.delete(schema.media).where(eq(schema.media.id, mediaId));
    await db.delete(schema.pages).where(eq(schema.pages.tenantId, tenantId));
    await db.delete(schema.users).where(eq(schema.users.tenantId, tenantId));
    await db.delete(schema.tenants).where(eq(schema.tenants.id, tenantId));
    delete process.env.UPLOADS_CDN_BASE_URL;
  });

  it('GET /api/tenant/media returns absolute CDN paths while the DB keeps relative ones', async () => {
    const res = await request(app)
      .get('/api/tenant/media')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].path).toBe(`${CDN}/${tenantId}/a1b2c3.jpg`);

    // The stored row is unchanged — rewriting happens only at read time.
    const stored = await db.select().from(schema.media).where(eq(schema.media.id, mediaId)).get();
    expect(stored?.path).toBe(`/uploads/${tenantId}/a1b2c3.jpg`);
  });

  it('GET /api/public/page rewrites /uploads paths inside the Puck document', async () => {
    const res = await request(app)
      .get('/api/public/page')
      .set('X-Tenant-Slug', slug);
    expect(res.status).toBe(200);

    const blocks = res.body.page?.content?.content ?? [];
    const hero = blocks.find((b: any) => b.type === 'Hero');
    expect(hero.props.backgroundImage).toBe(`${CDN}/${tenantId}/hero.jpg`);
    expect(hero.props.overlay.image.src).toBe(`${CDN}/${tenantId}/nested.png`);

    const gallery = blocks.find((b: any) => b.type === 'Gallery');
    expect(gallery.props.images[0]).toBe(`${CDN}/${tenantId}/gallery-1.jpg`);
    // Non-upload URLs are left untouched.
    expect(gallery.props.images[1]).toBe('https://picsum.photos/200');

    // The stored Puck document keeps relative paths.
    const storedPage = await db.select().from(schema.pages).where(eq(schema.pages.tenantId, tenantId)).get();
    expect((storedPage?.content as any)?.content[0].props.backgroundImage)
      .toBe(`/uploads/${tenantId}/hero.jpg`);
  });

  it('leaves paths relative when UPLOADS_CDN_BASE_URL is unset', async () => {
    delete process.env.UPLOADS_CDN_BASE_URL;
    vi.resetModules();
    const mediaUrls = await import('../../server/lib/mediaUrls');

    expect(mediaUrls.resolveMediaUrl('/uploads/abc/photo.jpg')).toBe('/uploads/abc/photo.jpg');
    expect(mediaUrls.resolveMediaUrl('https://cdn.example/x.jpg')).toBe('https://cdn.example/x.jpg');
    expect(mediaUrls.resolveMediaUrl(null)).toBeNull();
    expect(mediaUrls.resolveMediaUrl(undefined)).toBeUndefined();
    expect(mediaUrls.rewriteUploadUrls({ src: '/uploads/abc/photo.jpg', keep: 1 }))
      .toEqual({ src: '/uploads/abc/photo.jpg', keep: 1 });
  });
});
