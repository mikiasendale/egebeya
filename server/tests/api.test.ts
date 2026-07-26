import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRoutes from '../../src/api';
import { db } from '../../src/db';
import { tenants, users, services } from '../../src/db/schema';
import crypto from 'crypto';

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

describe('API Tests', () => {
  let testTenantId: string;
  let testToken: string;
  let testServiceId: string;
  let testStaffId: string;
  // Ethiopian-format phone (+251 plus 9 digits) to satisfy validation.
  const testPhone = `+251${Math.floor(Math.random() * 1_000_000_000).toString().padStart(9, '0')}`;
  const testSlug = `test-${Date.now()}`;

  beforeAll(async () => {
    // We can run these tests directly against the local sqlite db
  });

  it('should register a new tenant', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test Owner',
        phone: testPhone,
        password: 'password123',
        businessName: 'Test Business',
        slug: testSlug,
        email: `test-${Date.now()}@egebeya.test`,
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.tenant).toBeDefined();
    expect(res.body.tenant.slug).toBe(testSlug);

    testToken = res.body.token;
    testTenantId = res.body.tenant.id;
  });

  it('should reject registration with an invalid phone number', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Bad Phone Owner',
        phone: '1234567890',
        password: 'password123',
        businessName: 'Bad Phone Business',
        slug: `bad-phone-${Date.now()}`,
        email: `bad-phone-${Date.now()}@egebeya.test`,
      });

    expect(res.status).toBe(400);
    expect(String(res.body.error || '')).toMatch(/phone/i);
  });

  it('should prevent duplicate slug registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Another Owner',
        phone: '+251900000000',
        password: 'password123',
        businessName: 'Another Business',
        slug: testSlug, // same slug
        email: `another-${Date.now()}@egebeya.test`,
      });

    expect(res.status).toBe(400);
  });

  it('should check slug availability', async () => {
    const res = await request(app)
      .post('/api/auth/check-slug')
      .send({ slug: 'admin' });
    
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false); // reserved
  });

  // Note: we can't easily test booking without staff/services seeded properly
  // so we'll just check if auth login works

  it('should login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        phone: testPhone,
        password: 'password123',
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('GET /api/tenant/settings returns name + slug + tenantId', async () => {
    const res = await request(app)
      .get('/api/tenant/settings')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testTenantId);
    expect(res.body.slug).toBe(testSlug);
    expect(res.body.name).toBe('Test Business');
  });

  it('PUT /api/tenant/settings updates business name + notification email', async () => {
    const res = await request(app)
      .put('/api/tenant/settings')
      .set('Authorization', `Bearer ${testToken}`)
      .set('Content-Type', 'application/json')
      .send({
        name: 'Test Business Renamed',
        notification_email: 'staff+bookings@egebeya.test',
        require_payment_upfront: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.settings.name).toBe('Test Business Renamed');
    expect(res.body.settings.notification_email).toBe('staff+bookings@egebeya.test');
    expect(res.body.settings.require_payment_upfront).toBe(true);
  });

  it('PUT /api/tenant/settings persists across subsequent reads', async () => {
    const res = await request(app)
      .get('/api/tenant/settings')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test Business Renamed');
    expect(res.body.notification_email).toBe('staff+bookings@egebeya.test');
    expect(res.body.require_payment_upfront).toBe(true);
  });

  it('PUT /api/tenant/settings ignores attempts to change the slug', async () => {
    const res = await request(app)
      .put('/api/tenant/settings')
      .set('Authorization', `Bearer ${testToken}`)
      .set('Content-Type', 'application/json')
      .send({
        slug: 'attacker-controlled-subdomain',
        name: 'Test Business Locked',
      });

    expect(res.status).toBe(200);
    // The slug must NOT have changed even though the body tried to set it.
    const follow = await request(app)
      .get('/api/tenant/settings')
      .set('Authorization', `Bearer ${testToken}`);
    expect(follow.body.slug).toBe(testSlug);
    expect(follow.body.name).toBe('Test Business Locked');
  });
});
