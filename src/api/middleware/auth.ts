import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';

// JWT/REFRESH secrets are NEVER hardcoded in source — not even test-mode
// literals. The test runner injects them via vitest env / _setup.ts (runtime
// generated); any other environment must supply them or the process refuses
// to start (enforced here AND at boot in server.ts).
export function jwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  throw new Error('JWT_SECRET is required. Set JWT_SECRET in your environment.');
}

export function refreshSecret(): string {
  const s = process.env.REFRESH_SECRET;
  if (s) return s;
  throw new Error('REFRESH_SECRET is required. Set REFRESH_SECRET in your environment.');
}

export interface AuthOptions {
  /** Restrict to these roles (e.g. ['owner']). Omit to allow any authenticated role. */
  roles?: string[];
}

// Resolve the bearer token from an httpOnly access cookie (primary, the SPA
// path) or the Authorization header (backward-compatible API/test path).
function resolveAccessToken(req: Request): string | null {
  const fromCookie = (req as any).cookies?.accessToken;
  if (typeof fromCookie === 'string' && fromCookie) return fromCookie;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

/**
 * Authenticate an access token (cookie or Bearer) and verify the caller's
 * `tokenVersion` against the users table so that logout / password changes
 * revoke previously issued access tokens immediately.
 */


/**
 * Middleware to require superadmin role.
 * Verifies the JWT's userId, then looks up the user fresh on every request
 * so revoking superadmin status takes effect immediately.
 * Also verifies tokenVersion so a revoked session cannot reach admin surfaces.
 */
export function requireSuperadmin() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = resolveAccessToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let payload: any;
    try {
      payload = jwt.verify(token, jwtSecret());
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!payload?.userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await db.select().from(users).where(eq(users.id, payload.userId)).get();
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const currentVersion = (user as any).tokenVersion ?? 0;
    if (typeof payload.tokenVersion !== 'number' || payload.tokenVersion !== currentVersion) {
      return res.status(401).json({ error: 'Session has been revoked, please sign in again' });
    }

    if (!(user as any).isSuperadmin) {
      return res.status(403).json({ error: 'Forbidden — superadmin only' });
    }

    (req as any).user = {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      name: user.name,
      email: user.email,
    };
    next();
  };
}

export function requireAuth(options: AuthOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = resolveAccessToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let payload: any;
    try {
      payload = jwt.verify(token, jwtSecret());
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!payload?.userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await db.select().from(users).where(eq(users.id, payload.userId)).get();
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const currentVersion = (user as any).tokenVersion ?? 0;
    if (typeof payload.tokenVersion !== 'number' || payload.tokenVersion !== currentVersion) {
      return res.status(401).json({ error: 'Session has been revoked, please sign in again' });
    }

    if (options.roles && options.roles.length > 0 && !options.roles.includes(payload.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    (req as any).user = payload;
    next();
  };
}
