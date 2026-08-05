import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../../db';
import { apiKeys } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { logSecurityEvent, ipFromRequest } from '../../../server/lib/securityLog';

/**
 * Authenticate a public v1 API request via the `x-api-key` header.
 *
 * Flow:
 *   1. Read the raw key from `x-api-key`.
 *   2. Extract the first 8-char prefix (the public identifier).
 *   3. Look up the row by prefix, then bcrypt.compare the full key.
 *   4. Verify all requested scopes are present in the key's scope list.
 *   5. Check expiry.
 *   6. Update `last_used_at` (fire-and-forget).
 *   7. Attach `req.apiKey` with tenantId, scopes, and key row for downstream.
 */
export function requireApiKey(...requiredScopes: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const rawKey = req.headers['x-api-key'];
    if (typeof rawKey !== 'string' || rawKey.length < 12) {
      return res.status(401).json({ error: 'Invalid or missing API key', code: 'API_KEY_INVALID' });
    }

    const prefix = rawKey.slice(0, 8);

    // Look up by prefix (indexed lookup is fast).
    const row = await db.select().from(apiKeys).where(eq(apiKeys.keyPrefix, prefix)).get();

    if (!row) {
      logSecurityEvent({
        type: 'failed_login',
        ip: ipFromRequest(req),
        details: { surface: 'api_key', reason: 'prefix_not_found', prefix },
      });
      return res.status(401).json({ error: 'Invalid API key', code: 'API_KEY_INVALID' });
    }

    // Check expiry.
    if (row.expiresAt && row.expiresAt < Date.now()) {
      return res.status(401).json({ error: 'API key has expired', code: 'API_KEY_EXPIRED' });
    }

    // Verify hash.
    const valid = await bcrypt.compare(rawKey, row.keyHash);
    if (!valid) {
      logSecurityEvent({
        type: 'failed_login',
        tenantId: row.tenantId,
        ip: ipFromRequest(req),
        details: { surface: 'api_key', reason: 'hash_mismatch', prefix },
      });
      return res.status(401).json({ error: 'Invalid API key', code: 'API_KEY_INVALID' });
    }

    // Scope check.
    const keyScopes: string[] = Array.isArray(row.scopes) ? row.scopes : [];
    const missing = requiredScopes.filter((s) => !keyScopes.includes(s));
    if (missing.length > 0) {
      return res.status(403).json({
        error: 'Insufficient scope',
        code: 'API_KEY_SCOPE_DENIED',
        missing,
      });
    }

    // Fire-and-forget update of last_used_at.
    const now = Date.now();
    db.update(apiKeys).set({ lastUsedAt: now }).where(eq(apiKeys.id, row.id))
      .catch((err) => console.error('[api-key] failed to update last_used_at:', err?.message));

    (req as any).apiKey = {
      id: row.id,
      tenantId: row.tenantId,
      scopes: keyScopes,
      prefix,
    };

    next();
  };
}
