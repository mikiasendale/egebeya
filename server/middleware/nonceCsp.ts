
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
 * Stamp a per-request nonce onto every <script> and <style> tag in a served
 * HTML document and expose the nonce in a meta tag for dynamic script
 * creation. Works for any Vite build (hashed /assets/*-hash.js entries and
 * inline critical CSS alike) rather than matching one dev-specific path.
 */
export function injectCspNonce(html: string, nonce: string): string {
  html = html.replace(/<script\b/g, `<script nonce="${nonce}"`).replace(/<style\b/g, `<style nonce="${nonce}"`);
  if (!html.includes('name="csp-nonce"')) {
    html = html.replace('</head>', `<meta name="csp-nonce" content="${nonce}" /></head>`);
  }
  return html;
}

/**
 * CSP middleware that uses the per-request nonce for script-src.
 * Used for dashboard/editor routes where Sandpack/Puck require unsafe-eval/inline.
 * The nonce allows specific inline scripts/styles while blocking injected ones.
 *
 * script-src deliberately omits 'strict-dynamic': the hosting page keeps
 * 'self' in the allowlist, so Vite's dynamically-imported chunk scripts
 * (created with an src on self) load normally without the nonce, and a
 * nonce-trusted script is never handed the ability to blindly trust its
 * children. Nonces still cover inline scripts (entries, inline modules).
 *
 * style-src allows 'unsafe-inline': React UIs rely heavily on inline
 * `style={{...}}` attributes (style-src-attr), which cannot be nonced and
 * are inert (they cannot execute code), matching strictCsp's allowance.
 */
export function nonceCsp(_req: Request, res: Response, next: NextFunction) {
  const nonce = res.locals.cspNonce;
  if (!nonce) {
    console.warn('CSP nonce not found — nonceCsp middleware must run after cspNonceMiddleware');
    return next();
  }

  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'unsafe-inline' 'nonce-${nonce}' https:`,
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
