import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import { tenants, users } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET as string;
const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

function tokenFor(userId: string, tenantId: string, role: string): string {
  return jwt.sign({ userId, tenantId, role, tokenVersion: 0 }, JWT_SECRET, { expiresIn: '15m' });
}

describe('Share link (WP1.2)', () => {
  const slug = `share-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
  let tenantId: string;
  let ownerUserId: string;
  let staffUserId: string;
  let ownerToken: string;
  let staffToken: string;

  beforeAll(async () => {
    tenantId = crypto.randomUUID();
    ownerUserId = crypto.randomUUID();
    staffUserId = crypto.randomUUID();
    const phone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
    const staffPhone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;

    await db.insert(tenants).values({ id: tenantId, name: 'Share Salon', slug, settings: { city: 'Addis' }, createdAt: Date.now() });
    await db.insert(users).values([
      { id: ownerUserId, tenantId, name: 'Owner', phone, email: `${slug}@egebeya.test`, passwordHash: await bcrypt.hash('pass1234', 10), role: 'owner', createdAt: Date.now() },
      { id: staffUserId, tenantId, name: 'Staff', phone: staffPhone, email: `${slug}-staff@egebeya.test`, passwordHash: await bcrypt.hash('pass1234', 10), role: 'staff', createdAt: Date.now() },
    ]);
    ownerToken = tokenFor(ownerUserId, tenantId, 'owner');
    staffToken = tokenFor(staffUserId, tenantId, 'staff');
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('returns a valid t.me share URL with the encoded slug', async () => {
    const res = await request(app)
      .get('/api/tenant/share-link')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    const { url, telegramShare } = res.body;
    expect(url).toBe(`http://localhost:3000/${slug}`);
    expect(telegramShare.startsWith('https://t.me/share/url?url=')).toBe(true);
    const params = new URLSearchParams(telegramShare.split('?')[1]);
    expect(params.get('url')).toBe(url);
    expect(decodeURIComponent(params.get('url') || '')).toBe(url);
    expect(params.get('text')).toContain('Book online');
  });

  it('refuses staff-role callers with 403 (owner only)', async () => {
    const res = await request(app)
      .get('/api/tenant/share-link')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  it('rejects unauthenticated callers with 401', async () => {
    const res = await request(app).get('/api/tenant/share-link');
    expect(res.status).toBe(401);
  });
});
