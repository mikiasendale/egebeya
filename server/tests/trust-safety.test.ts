/**
 * Wayfinder #14/#19 — trust & safety (Apple 1.2, DSA Art 16).
 *
 * Covers: public report intake (validation, anonymous OK, security-log),
 * consumer blocks (auth-gated, idempotent, list/unblock), and the personal
 * filter semantics — a blocked merchant disappears from the caller's
 * /discover but stays visible signed-out. Plus the admin review queue.
 */
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import { tenants, users, tenantSubscriptions, consumerBlocks, contentReports, consumers } from '../../src/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { cookieValue } from './helpers';
import crypto from 'crypto';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api', apiRoutes);

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const suffix = `${Date.now()}`;
const slugA = `trust-a-${suffix}`;
const slugB = `trust-b-${suffix}`;
const tenantA = crypto.randomUUID();
const tenantB = crypto.randomUUID();
const consumerPhone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
let consumerId = '';
let consumerToken = '';

function consumerJwt(): string {
  return jwt.sign({ consumerId, phone: consumerPhone, aud: 'consumer' }, JWT_SECRET, { expiresIn: '10m' });
}

afterAll(async () => {
  try {
    await db.delete(contentReports).where(inArray(contentReports.tenantId, [tenantA, tenantB]));
    await db.delete(consumerBlocks).where(inArray(consumerBlocks.tenantId, [tenantA, tenantB]));
    await db.delete(tenantSubscriptions).where(inArray(tenantSubscriptions.tenantId, [tenantA, tenantB]));
    await db.delete(tenants).where(inArray(tenants.id, [tenantA, tenantB]));
    if (consumerId) {
      await db.delete(consumers).where(eq(consumers.id, consumerId));
      await db.delete(users).where(and(eq(users.phone, consumerPhone), eq(users.role, 'owner')));
    }
  } catch {
    // best-effort
  }
});

describe('Trust & safety setup', () => {
  it('seeds two listed merchants + a consumer identity', async () => {
    await db.insert(tenants).values([
      { id: tenantA, name: 'Trust Salon A', slug: slugA, isListed: true, createdAt: Date.now() },
      { id: tenantB, name: 'Trust Salon B', slug: slugB, isListed: true, createdAt: Date.now() },
    ]);
    consumerId = crypto.randomUUID();
    await db.insert(consumers).values({
      id: consumerId, phone: consumerPhone, name: 'Tester', consentGivenAt: Date.now(), createdAt: Date.now(),
    });
    consumerToken = consumerJwt();
    expect(consumerToken).toBeTruthy();
  });
});

describe('POST /api/public/report', () => {
  it('rejects an invalid payload', async () => {
    const res = await request(app).post('/api/public/report').send({ tenantId: 'nope', reason: 'junk' });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown tenant', async () => {
    const res = await request(app).post('/api/public/report')
      .send({ tenantId: crypto.randomUUID(), reason: 'spam' });
    expect(res.status).toBe(404);
  });

  it('files an anonymous report and states the 7-day SLA', async () => {
    const res = await request(app).post('/api/public/report')
      .send({ tenantId: tenantA, reason: 'fraud_or_scam', details: 'fake prices' });
    expect(res.status).toBe(201);
    expect(res.body.ackEn).toMatch(/7 days/);

    const row = await db.select().from(contentReports).where(eq(contentReports.tenantId, tenantA)).get();
    expect(row).toBeTruthy();
    expect(row!.reporterPhone).toBeNull();
    expect(row!.status).toBe('open');
  });
});

describe('Consumer blocks (personal filter)', () => {
  it('requires consumer auth', async () => {
    const res = await request(app).post('/api/consumer/blocks').send({ tenantId: tenantB });
    expect(res.status).toBe(401);
  });

  it('blocks and lists a merchant for the authed consumer', async () => {
    const post = await request(app).post('/api/consumer/blocks')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ tenantId: tenantB });
    expect(post.status).toBe(201);

    const list = await request(app).get('/api/consumer/blocks')
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(list.status).toBe(200);
    expect(list.body.some((b: any) => b.tenantId === tenantB)).toBe(true);
  });

  it('is idempotent on re-block', async () => {
    const again = await request(app).post('/api/consumer/blocks')
      .set('Authorization', `Bearer ${consumerToken}`)
      .send({ tenantId: tenantB });
    expect(again.status).toBe(200);
    expect(again.body.alreadyBlocked).toBe(true);
  });

  it('hides the blocked merchant from the caller discover but not signed-out callers', async () => {
    // Authed consumer: B hidden, A visible.
    const authed = await request(app).get('/api/public/discover')
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(authed.status).toBe(200);
    const idsAuthed: string[] = authed.body.map((b: any) => b.id);
    expect(idsAuthed).toContain(tenantA);
    expect(idsAuthed).not.toContain(tenantB);

    // Signed-out: both visible.
    const anon = await request(app).get('/api/public/discover');
    expect(anon.status).toBe(200);
    const idsAnon: string[] = anon.body.map((b: any) => b.id);
    expect(idsAnon).toContain(tenantA);
    expect(idsAnon).toContain(tenantB);
  });

  it('unblocks and the merchant reappears', async () => {
    const del = await request(app).delete(`/api/consumer/blocks/${tenantB}`)
      .set('Authorization', `Bearer ${consumerToken}`);
    expect(del.status).toBe(200);

    const authed = await request(app).get('/api/public/discover')
      .set('Authorization', `Bearer ${consumerToken}`);
    const ids: string[] = authed.body.map((b: any) => b.id);
    expect(ids).toContain(tenantB);
  });
});

describe('Admin review queue', () => {
  it('requires superadmin', async () => {
    const res = await request(app).get('/api/admin/reports');
    expect(res.status).toBe(401);
  });

  it('lists open reports for a superadmin and resolves one', async () => {
    // Promote the seeded owner flow isn't needed — mint a superadmin token.
    const adminId = crypto.randomUUID();
    await db.insert(users).values({
      id: adminId, tenantId: null, name: 'Trust Admin',
      phone: `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
      email: `trust-admin-${suffix}@egebeya.test`,
      passwordHash: 'x', role: 'admin', isSuperadmin: true, createdAt: Date.now(),
    });
    const adminToken = jwt.sign({ userId: adminId, tenantId: null, role: 'admin', tokenVersion: 0 }, JWT_SECRET, { expiresIn: '10m' });

    const list = await request(app).get('/api/admin/reports')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    const row = list.body.find((r: any) => r.tenantId === tenantA);
    expect(row).toBeTruthy();
    expect(row.reason).toBe('fraud_or_scam');

    const patch = await request(app).patch(`/api/admin/reports/${row.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'actioned', note: 'listing corrected' });
    expect(patch.status).toBe(200);

    const resolved = await db.select().from(contentReports).where(eq(contentReports.id, row.id)).get();
    expect(resolved!.status).toBe('actioned');
    expect(resolved!.resolvedAt).toBeTruthy();

    await db.delete(users).where(eq(users.id, adminId));
  });
});
