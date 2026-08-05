/**
 * Performance & Database Resilience (Feature M).
 *
 * Three families of assertions:
 *
 *   1. N+1 audit — a source-level scan of src/api/*.ts asserting no
 *      collection-iteration loop (for...of, for...in, .forEach/.map/.filter
 *      callbacks) contains a Drizzle query. This is the regression guard for
 *      the classic `.all()`-inside-a-`for...of` anti-pattern; bounded numeric
 *      loops (e.g. the fixed 7-day analytics window) are deliberately exempt.
 *
 *   2. Query-count bound — patches the underlying libsql client to count
 *      statements and asserts GET /api/public/discover issues a small,
 *      dataset-independent number of queries (no per-tenant fan-out).
 *
 *   3. Database resilience — when the DB is unreachable the API answers 503
 *      with `{ error: 'Service temporarily unavailable', retryAfter: 30 }`,
 *      a matching `Retry-After` header, and no stack trace. Uses the
 *      injectable `createDbHealthMiddleware` so the circuit breaker can be
 *      driven without a real outage.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import { tenants } from '../../src/db/schema';
import { inArray } from 'drizzle-orm';
import { createDbHealthMiddleware, isDbUnavailableError } from '../../src/db/health';

// ── 1. N+1 source audit ────────────────────────────────────────────────────

const API_DIR = path.join(process.cwd(), 'src', 'api');

/** Strip // line comments and /* block comments *\/ (non-greedy, multiline). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

/** A Drizzle query entry point anywhere in the current scope. */
const DB_QUERY = /\b(?:db|tx|client)\.(?:select|insert|update|delete|execute|all|run|values)\s*\(/;

const LOOP_HEADERS: Array<{ name: string; test: (line: string) => boolean }> = [
  // for (const x of collection) { — classic N+1 carrier
  { name: 'for...of', test: (l) => /\bfor\s*\(\s*(?:const|let|var)\s+[^)]*?\bof\s+/.test(l) },
  // for (const key in obj) {
  { name: 'for...in', test: (l) => /\bfor\s*\(\s*(?:const|let|var)\s+[^)]*?\bin\s+/.test(l) },
  // .forEach(... => { … }) and friends (functional loops). The param list
  // may be parenthesised (`map((x) =>`) or bare (`map(x =>`), so the matcher
  // accepts either an atom or a balanced parenthesised group before `=>`.
  { name: 'forEach/map/filter', test: (l) => /\.(?:forEach|map|filter|some|every|find)\s*\(\s*(?:[^()]|\([^)]*\))*\s*=>/.test(l) },
];

/**
 * Walk the stripped source line-by-line and flag any collection-iteration
 * loop whose body performs a Drizzle query (the `.all()`-inside-`for...of`
 * anti-pattern and its `.map(r => db…)` sibling).
 *
 * Body scoping is deliberately conservative so in-memory aggregations over
 * query results (`rows.map(r => r.id)`, `for (const s of rows) map.set(…)`)
 * never false-positive:
 *
 *   - Block-bodied loops (`for (const x of xs) {` / `.map((x) => {`) are
 *     brace-matched from the header line and only that body is scanned.
 *   - Brace-less loops are single statements. We scan only the header line
 *     itself (covers `xs.map(r => db.select()…)`) plus, at most, the next
 *     line when it is indented deeper than the header (covers a query
 *     statement on its own continuation line). We never jump forward to an
 *     unrelated `{` on a later line, which is what produced the false hits.
 */
function findNPlusOneLoop(filePath: string): Array<{ line: number; header: string }> {
  const src = stripComments(fs.readFileSync(filePath, 'utf8'));
  const lines = src.split('\n');
  const hits: Array<{ line: number; header: string }> = [];

  const headerIndent = (l: string) => l.match(/^\s*/)?.[0]?.length ?? 0;

  const scanRange = (headerLine: number, from: number, to: number) => {
    const body = lines.slice(from, to + 1).join('\n');
    if (DB_QUERY.test(body)) {
      hits.push({ line: headerLine + 1, header: lines[headerLine].trim() });
    }
  };

  // Returns the line index that closes the block opened on `openLine`.
  const matchBlock = (openLine: number): number => {
    let depth = 0;
    let open = false;
    for (let j = openLine; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === '{') { depth++; open = true; }
        else if (ch === '}') depth--;
      }
      if (open && depth === 0) return j;
    }
    return -1;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!LOOP_HEADERS.some((h) => h.test(line))) continue;

    // Block-bodied loop — brace-match and scan just that body.
    if (line.includes('{')) {
      const end = matchBlock(i);
      if (end !== -1) scanRange(i, i + 1, end);
      continue;
    }

    // Brace-less loop — single statement on the header line (e.g.
    // `rows.map(r => db.select()…)` or `for (const s of rows) doThing(s)`).
    if (DB_QUERY.test(line)) {
      hits.push({ line: i + 1, header: line.trim() });
      continue;
    }

    // The statement may continue on the next line when indented deeper
    // (`for (const x of rows)` / `  await db.select()…`).
    const next = lines[i + 1];
    if (next !== undefined && next.trim() !== '' && headerIndent(next) > headerIndent(line)) {
      scanRange(i, i + 1, i + 1);
    }
  }

  return hits;
}

describe('N+1 elimination (static audit of src/api)', () => {
  it('contains no collection-iteration loop that performs a DB query', () => {
    const files = fs.readdirSync(API_DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'));
    const offenders: string[] = [];

    for (const file of files) {
      const filePath = path.join(API_DIR, file);
      const hits = findNPlusOneLoop(filePath);
      for (const h of hits) {
        offenders.push(`${file}:${h.line}  ${h.header}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});

// ── 2. Query-count bound for /discover ─────────────────────────────────────

const COUNT_TENANTS = 25;
const PERF_SLUGS: string[] = [];

// The raw libsql client sits on the drizzle session; every statement a route
// issues funnels through its `execute`, so wrapping it yields a true count.
function installQueryCounter(): { count(): number; restore(): void } {
  const client: any = (db as any).session?.client ?? (db as any).$client;
  const original = client.execute;
  let calls = 0;
  client.execute = function (this: any, ...args: any[]) {
    calls++;
    return original.apply(this, args);
  };
  return {
    count: () => calls,
    restore: () => { client.execute = original; },
  };
}

describe('GET /api/public/discover — bounded query count (no N+1)', () => {
  beforeAll(async () => {
    const now = Date.now();
    const rows = Array.from({ length: COUNT_TENANTS }, (_, i) => ({
      id: crypto.randomUUID(),
      name: `PerfCount-${i}`,
      slug: `perfcount-${i}-${now}-${crypto.randomUUID().slice(0, 6)}`,
      category: 'salon',
      isListed: true,
      isSuspended: false,
      settings: { city: 'Addis Ababa' },
      createdAt: now,
    }));
    PERF_SLUGS.push(...rows.map((r) => r.slug));
    await db.insert(tenants).values(rows as any);
  });

  afterAll(async () => {
    if (PERF_SLUGS.length) {
      const ids = (await db.select({ id: tenants.id }).from(tenants)
        .where(inArray(tenants.slug, PERF_SLUGS)).all()).map((t) => t.id);
      await db.delete(tenants).where(inArray(tenants.id, ids));
    }
  });

  it('issues a constant, small number of queries regardless of dataset size', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);

    const counter = installQueryCounter();
    try {
      // The health middleware pings once (per 2s TTL), then discover runs a
      // fixed pipeline: count + page rows + pages + bookings (4 statements).
      // A naive N+1 over 20+ tenants would need 20+ queries just for the
      // page/booking enrichments; the batched implementation stays ≤ 6.
      const res = await request(app).get('/api/public/discover?limit=20');
      expect(res.status).toBe(200);

      const firstCount = counter.count();
      expect(firstCount).toBeLessThanOrEqual(6);

      // Second request: still the same fixed pipeline; the health ping is
      // TTL-cached, so the delta must not exceed the 4-statement pipeline.
      const second = await request(app).get('/api/public/discover?limit=20');
      expect(second.status).toBe(200);
      expect(counter.count() - firstCount).toBeLessThanOrEqual(5);
    } finally {
      counter.restore();
    }
  });
});

// ── 3. Database resilience (503 on unreachable DB) ─────────────────────────

describe('Database resilience', () => {
  function mountBroken(): { app: express.Express; pings: () => number } {
    const app = express();
    let pings = 0;
    app.use(express.json());
    app.use(createDbHealthMiddleware({
      ping: async () => { pings++; throw new Error('connection refused: no route to host'); },
    }));
    app.get('/api/anything', (_req, res) => res.json({ ok: true }));
    return { app, pings: () => pings };
  }

  it('returns 503 with retryAfter when the database is unreachable', async () => {
    const { app } = mountBroken();
    const res = await request(app).get('/api/anything');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'Service temporarily unavailable', retryAfter: 30 });
    expect(res.headers['retry-after']).toBe('30');
    // No stack trace leaked into the body.
    expect(JSON.stringify(res.body)).not.toMatch(/at\s+\w+\.\w+/);
  });

  it('short-circuits the circuit breaker without re-pinging while open', async () => {
    const { app, pings } = mountBroken();
    await request(app).get('/api/anything'); // trips the breaker
    await request(app).get('/api/anything'); // should be short-circuited
    const res = await request(app).get('/api/anything');
    expect(res.status).toBe(503);
    expect(pings()).toBe(1);
  });

  it('passes requests through while the database is healthy', async () => {
    const app = express();
    app.use(express.json());
    app.use(createDbHealthMiddleware({ ping: async () => {} }));
    app.get('/api/anything', (_req, res) => res.json({ ok: true }));
    const res = await request(app).get('/api/anything');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('classifies connection-style errors as database-unavailable', () => {
    expect(isDbUnavailableError(new Error('connect ECONNREFUSED 127.0.0.1:8001'))).toBe(true);
    expect(isDbUnavailableError(new Error('socket hang up'))).toBe(true);
    expect(isDbUnavailableError({ message: 'SQLITE_BUSY: database is locked' })).toBe(false);
    expect(isDbUnavailableError(new Error('disk I/O error'))).toBe(false);
    expect(isDbUnavailableError(null)).toBe(false);
  });
});
