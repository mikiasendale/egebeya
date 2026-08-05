import { Router } from 'express';
import { db } from '../db';
import { apiKeys, tenants } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { requireAuth } from './middleware/auth';
import { csrfProtection } from './middleware/csrf';
import { tenantWriteLimiter } from '../../server/middleware/rateLimiter';

const router = Router();

// All key-management routes require an authenticated owner.
router.use(requireAuth({ roles: ['owner'] }));
router.use(csrfProtection);
router.use(tenantWriteLimiter);

const VALID_SCOPES = ['read:bookings', 'read:services', 'write:bookings'] as const;

const CreateKeySchema = z.object({
  label: z.string().min(1).max(80).optional(),
  scopes: z.array(z.enum(VALID_SCOPES)).min(1).max(10),
  expires_in_days: z.number().int().min(1).max(365).optional(),
});

/**
 * POST /api/tenant/api-keys — Create a new API key.
 *
 * Owner-only. Generates a cryptographically random key, hashes it with
 * bcrypt, stores the hash + prefix + scopes, and returns the raw key
 * ONCE. The raw key is never stored or returned again.
 */
router.post('/', async (req, res) => {
  try {
    const data = CreateKeySchema.parse(req.body);
    const tenantId = (req as any).user.tenantId;

    const rawKey = `egb_${crypto.randomBytes(32).toString('hex')}`;
    const prefix = rawKey.slice(0, 8);
    const keyHash = await bcrypt.hash(rawKey, 10);

    const expiresAt = data.expires_in_days
      ? Date.now() + data.expires_in_days * 24 * 60 * 60 * 1000
      : null;

    const row = await db.insert(apiKeys).values({
      id: crypto.randomUUID(),
      tenantId,
      keyPrefix: prefix,
      keyHash,
      scopes: data.scopes,
      expiresAt,
      createdAt: Date.now(),
    }).returning().get();

    // Return metadata + the raw key. The raw key is returned ONCE.
    res.status(201).json({
      id: row.id,
      prefix: row.keyPrefix,
      key: rawKey,
      label: data.label ?? null,
      scopes: row.scopes,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ error: error.issues });
    }
    console.error('Create API key error:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

/**
 * GET /api/tenant/api-keys — List all API keys for this tenant.
 *
 * Returns metadata only (no raw keys, no hashes).
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const rows = await db.select()
      .from(apiKeys)
      .where(eq(apiKeys.tenantId, tenantId))
      .orderBy(desc(apiKeys.createdAt))
      .all();

    res.json(rows.map((r) => ({
      id: r.id,
      prefix: r.keyPrefix,
      scopes: r.scopes,
      expiresAt: r.expiresAt,
      lastUsedAt: r.lastUsedAt,
      createdAt: r.createdAt,
    })));
  } catch (error) {
    console.error('List API keys error:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

/**
 * DELETE /api/tenant/api-keys/:id — Revoke (delete) an API key.
 */
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { id } = req.params;

    const row = await db.select().from(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)))
      .get();

    if (!row) {
      return res.status(404).json({ error: 'API key not found' });
    }

    await db.delete(apiKeys).where(eq(apiKeys.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error('Delete API key error:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

export default router;
