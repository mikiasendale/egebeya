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
  // Referrer-Policy — never leak the public-site URL (which can include
  // the tenant slug + booking date in the query string) to third-party
  // link targets, image hosts, or CDN refferer logs crossed from these
  // surfaces.
  res.setHeader('Referrer-Policy', 'no-referrer');
  // Frame-ancestors is already locked via CSP `frame-src`, but defence in
  // depth: an explicit X-Frame-Options: DENY here guarantees legacy user
  // agents that don't understand CSP frame-ancestors also reject attempts
  // to embed public surfaces.
  res.setHeader('X-Frame-Options', 'DENY');
  // HSTS — force HTTPS for these surfaces so SSL-stripping can't downgrade
  // first visits. Applied here (and globally via helmet) for defence in depth.
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}
