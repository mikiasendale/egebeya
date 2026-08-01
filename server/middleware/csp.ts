import { NextFunction, Request, Response } from 'express';

/**
 * Strict Content-Security-Policy for public-facing surfaces.
 *
 * The dashboard/editor routes keep CSP disabled (Sandpack/Puck need
 * unsafe-inline/eval), but public tenant pages, the public booking API and
 * uploaded media are served with a locked-down policy so a stored/mutated
 * XSS payload has no script sink to run against.
 */
const STRICT_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "frame-src https://api.egebeya.et",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export function strictCsp(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Content-Security-Policy', STRICT_CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}
