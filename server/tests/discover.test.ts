/**
 * Discover Directory (Feature B) — pagination, filters, and X-Total-Count.
 *
 * Seeds 50 tenants spanning categories, cities, and name prefixes, then
 * asserts the /api/public/discover endpoint:
 *   - default page size 20, `limit`/`offset` pagination,
 *   - `limit` is capped at 100,
 *   - `X-Total-Count` reflects the full filtered result set,
 *   - `category` (exact), `city` (settings.city substring), and `q`
 *     (name LIKE) filters compose.
 *
 * The shared sqlite.db already holds tenants from other suites, so the count
 * assertions isolate our fixture via a distinctive `q` prefix (`PerfTenant`)
 * — total = exactly 50 for that filtered set — while the unfiltered call is
 * asserted with `>=`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import { tenants, users } from '../../src/db/schema';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

const COUNT = 50;
const PREFIX = 'PerfTenant';
const SLUGS: string[] = [];

async function seedDiscoverFixtures() {
  const now = Date.now();
  const rows = Array.from({ length: COUNT }, (_, i) => {
    const id = crypto.randomUUID();
    const slug = `perf-${i}-${now}-${crypto.randomUUID().slice(0, 6)}`;
    SLUGS.push(slug);
    return {
      id,
      name: `${PREFIX}-${String(i).padStart(2, '0')}`,
      slug,
      category: i % 3 === 0 ? 'salon' : (i % 3 === 1 ? 'clinic' : 'pharmacy'),
      isListed: true,
      isSuspended: false,
      settings: {
        city: i % 2 === 0 ? 'Addis Ababa' : 'Dire Dawa',
        // A few names should contain "hair" for the q= search.
        ...(i % 5 === 0 ? {} : {}),
      },
      createdAt: now + i,
    };
  });

  // Sprinkle "hair" into some names so the q= search has a meaningful match.
  rows.forEach((r, i) => {
    if (i % 4 === 0) r.name = `${PREFIX}-${String(i).padStart(2, '0')} Hair Salon`;
  });

  await db.insert(tenants).values(rows as any);
}

describe('GET /api/public/discover — pagination & filters', () => {
  beforeAll(async () => {
    await seedDiscoverFixtures();
  });

  afterAll(async () => {
    if (SLUGS.length) {
      const ids = (await db.select({ id: tenants.id }).from(tenants)
        .where(inArray(tenants.slug, SLUGS)).all()).map((t) => t.id);
      await db.delete(users).where(inArray(users.tenantId, ids));
      await db.delete(tenants).where(inArray(tenants.id, ids));
    }
  });

  it('returns X-Total-Count matching the filtered result set', async () => {
    const res = await request(app).get(`/api/public/discover?q=${PREFIX}&limit=100`);
    expect(res.status).toBe(200);
    expect(res.headers['x-total-count']).toBe(String(COUNT));
    // The default/capped response should include all 50 fixtures.
    expect(Array.isArray(res.body)).toBe(true);
    expect((res.body as any[]).length).toBe(COUNT);
    const slugs = (res.body as any[]).map((t: any) => t.slug);
    expect(slugs).toContain(SLUGS[0]);
  });

  it('paginates with limit + offset while preserving the total count', async () => {
    const page1 = await request(app).get(`/api/public/discover?q=${PREFIX}&limit=20&offset=0`);
    expect(page1.status).toBe(200);
    expect(page1.headers['x-total-count']).toBe(String(COUNT));
    expect((page1.body as any[]).length).toBe(20);

    const page2 = await request(app).get(`/api/public/discover?q=${PREFIX}&limit=20&offset=20`);
    expect(page2.status).toBe(200);
    expect(page2.headers['x-total-count']).toBe(String(COUNT));
    expect((page2.body as any[]).length).toBe(20);

    const page3 = await request(app).get(`/api/public/discover?q=${PREFIX}&limit=20&offset=40`);
    expect(page3.status).toBe(200);
    expect((page3.body as any[]).length).toBe(10);

    const allSlugs = [...page1.body, ...page2.body, ...page3.body].map((t: any) => t.slug);
    expect(new Set(allSlugs).size).toBe(COUNT);
  });

  it('clamps limit to a maximum of 100', async () => {
    const res = await request(app).get(`/api/public/discover?q=${PREFIX}&limit=1000`);
    expect(res.status).toBe(200);
    expect((res.body as any[]).length).toBe(COUNT);
  });

  it('defaults to limit=20 when no limit is supplied', async () => {
    const res = await request(app).get(`/api/public/discover?q=${PREFIX}`);
    expect(res.status).toBe(200);
    expect((res.body as any[]).length).toBe(20);
    expect(res.headers['x-total-count']).toBe(String(COUNT));
  });

  it('filters by category (exact match)', async () => {
    const res = await request(app).get(`/api/public/discover?q=${PREFIX}&category=salon&limit=100`);
    const cats = (res.body as any[]).map((t: any) => t.category);
    expect(cats.length).toBeGreaterThan(0);
    expect(cats.every((c) => c === 'salon')).toBe(true);
  });

  it('filters by city (settings.city substring)', async () => {
    const res = await request(app).get(`/api/public/discover?q=${PREFIX}&city=Addis+Ababa&limit=100`);
    expect(res.status).toBe(200);
    const cities = (res.body as any[]).map((t: any) => t.city);
    expect(cities.length).toBeGreaterThan(0);
    expect(cities.every((c) => c === 'Addis Ababa')).toBe(true);
  });

  it('filters by q (name LIKE search)', async () => {
    const res = await request(app).get(`/api/public/discover?q=${PREFIX}-00%20Hair&limit=100`);
    expect(res.status).toBe(200);
    const names = (res.body as any[]).map((t: any) => t.name);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => n.includes('Hair'))).toBe(true);
  });

  it('composes category + city + q filters and keeps X-Total-Count consistent', async () => {
    const res = await request(app).get(`/api/public/discover?q=${PREFIX}&category=clinic&city=Dire+Dawa&limit=100`);
    expect(res.status).toBe(200);
    const total = parseInt(res.headers['x-total-count'], 10);
    expect(total).toBe((res.body as any[]).length);
    for (const t of res.body as any[]) {
      expect(t.category).toBe('clinic');
      expect(t.city).toBe('Dire Dawa');
    }
  });

  it('returns an empty array with X-Total-Count 0 when nothing matches', async () => {
    const res = await request(app).get('/api/public/discover?q=zzz-no-such-business');
    expect(res.status).toBe(200);
    expect(res.headers['x-total-count']).toBe('0');
    expect(res.body).toEqual([]);
  });
});
