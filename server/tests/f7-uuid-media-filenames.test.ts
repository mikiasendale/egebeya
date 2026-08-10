import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRoutes from '../../src/api';
import jwt from 'jsonwebtoken';
import { db } from '../../src/db';
import { tenants, users, media } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import sharp from 'sharp';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';
const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

describe('F7 — UUID-only media filenames', () => {
  let tenantId: string; let token: string; let jpeg: Buffer;
  beforeAll(async () => {
    jpeg = await sharp({ create: { width: 1, height: 1, channels: 3, background: { r: 255, g: 0, b: 0 } } }).jpeg().toBuffer();
    tenantId = crypto.randomUUID();
    const phone = `+251${String(Math.floor(Math.random() * 1e9)).padStart(9,'0')}`;
    await db.insert(tenants).values({ id: tenantId, name: 'Media', slug: `media-${Date.now()}`, createdAt: Date.now() });
    const userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId, tenantId, name: 'Owner', phone,
      email: `media-${Date.now()}@egebeya.test`,
      passwordHash: await bcrypt.hash('pass1234', 10),
      role: 'owner', createdAt: Date.now(),
    });
    token = jwt.sign({ userId, tenantId, role: 'owner', tokenVersion: 0 }, JWT_SECRET, { expiresIn: '15m' });
  });
  afterAll(async () => {
    await db.delete(media).where(eq(media.tenantId, tenantId)).run();
    await db.delete(users).where(eq(users.tenantId, tenantId)).run();
    await db.delete(tenants).where(eq(tenants.id, tenantId)).run();
  });
  it('does not echo originalName and path is /uploads/<tenantId>/<uuid>.jpg', async () => {
    const res = await request(app)
      .post('/api/tenant/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', jpeg, { filename: 'secret-name.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('originalName');
    expect(res.body.path).toMatch(/^\/uploads\/[^/]+\/[A-Za-z0-9-]+\.jpg$/);
  });
  it('does not persist originalName in DB', async () => {
    const res = await request(app)
      .post('/api/tenant/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', jpeg, { filename: 'leak.png', contentType: 'image/jpeg' });
    const row = await db.select().from(media).where(eq(media.id, res.body.id)).get();
    expect(row).toBeDefined();
    expect(row!.path).toMatch(/^\/uploads\/[^/]+\/[A-Za-z0-9-]+\.jpg$/);
    expect((row as any).originalName).toBeUndefined();
  });
});
