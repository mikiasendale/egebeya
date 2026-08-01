import { NextFunction, Request, Response } from 'express';

/**
 * CSRF protection for cookie-authenticated mutation endpoints.
 *
 * Because the SPA authenticates with httpOnly cookies, state-changing
 * requests are verified against a non-httpOnly `csrf_token` cookie: the
 * client must echo that value in the `X-CSRF-Token` header. A cross-site
 * attacker cannot read the cookie (it's not readable cross-origin) so a
 * forged POST is rejected with 403.
 *
 * Bearer-token API clients carry no `csrf_token` cookie (CSRF does not apply
 * to header-authenticated requests) — the check is skipped for them so the
 * API/test path keeps working.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const cookieToken = (req as any).cookies?.csrf_token;
  if (!cookieToken) {
    // No CSRF cookie → this is a header/token-authenticated client, which is
    // not subject to CSRF. Pass through.
    return next();
  }

  const headerToken = req.headers['x-csrf-token'];
  if (typeof headerToken !== 'string' || headerToken !== cookieToken) {
    return res.status(403).json({ error: 'CSRF token mismatch. Please refresh the page and try again.' });
  }

  next();
}
