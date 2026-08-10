
import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

/**
 * Per-request CSP nonce generator.
 * Generates a cryptographically secure nonce for each request and attaches it
 * to res.locals.cspNonce so it can be used in CSP headers and templates.
 */
export function cspNonceMiddleware(_req: Request, res: Response, next: NextFunction) {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.cspNonce = nonce;
  next();
}

/**
 * CSP middleware that uses the per-request nonce for script-src and style-src.
 * Used for dashboard/editor routes where Sandpack/Puck require unsafe-eval/inline.
 * The nonce allows specific inline scripts/styles while blocking injected ones.
 */
export function nonceCsp(_req: Request, res: Response, next: NextFunction) {
  const nonce = res.locals.cspNonce;
  if (!nonce) {
    console.warn('CSP nonce not found — nonceCsp middleware must run after cspNonceMiddleware');
    return next();
  }

  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}' https:`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' ws: wss:",
    "frame-src 'self' blob: data: https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  res.setHeader('Content-Security-Policy', policy);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}
