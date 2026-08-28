/**
 * Consumer-audience auth middleware (P3.4).
 *
 * Mirrors requireAuth's care but for the consumer JWT audience: tokens are
 * signed with aud:'consumer' and verified with that expectation. A merchant
 * (owner/staff) token carries no audience → audience mismatch → 403, which
 * is the acceptance-tested confusion direction.
 */
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../../db';
import { consumers } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { jwtSecret } from './auth';
import { logSecurityEvent, ipFromRequest } from '../../../server/lib/securityLog';

export function isAudienceMismatch(err: unknown): boolean {
  return err instanceof jwt.JsonWebTokenError
    && String((err as any)?.message || '').toLowerCase().includes('audience');
}

export function requireConsumerAuth() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = (req as any).cookies?.accessToken
      || (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let payload: any;
    try {
      payload = jwt.verify(token, jwtSecret(), { audience: 'consumer' });
    } catch (err) {
      if (isAudienceMismatch(err)) {
        logSecurityEvent({
          type: 'consumer_auth_rejected',
          ip: ipFromRequest(req),
          result: 'failure',
          details: { reason: 'audience_mismatch' },
        });
        return res.status(403).json({ error: 'Wrong token audience' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!payload?.consumerId || typeof payload.phone !== 'string') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Fresh row check: a deleted consumer profile revokes live tokens.
    const consumer = await db.select().from(consumers).where(eq(consumers.id, payload.consumerId)).get();
    if (!consumer || consumer.phone !== payload.phone) {
      return res.status(401).json({ error: 'Session no longer valid' });
    }

    (req as any).consumer = {
      consumerId: consumer.id,
      phone: consumer.phone,
      name: consumer.name,
      consentGivenAt: consumer.consentGivenAt,
    };
    next();
  };
}
