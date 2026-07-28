/**
 * Centralised rate-limit presets keyed to the sensitivity of the surface
 * they protect. All public-facing endpoints that were previously ungated
 * get a limiter here; auth/OTP-style endpoints are stricter; read-only
 * public listing endpoints are looser so a busy /discover doesn't lock
 * out legitimate traffic.
 *
 * Each limiter delegates to `logSecurityEvent({ type: 'rate_limit', ... })`
 * so a tenant hammering the booking endpoint leaves an audit trail instead
 * of just being silently 429'd — that's item 10 of the security self-audit
 * (security event logging must record rate-limit triggers).
 *
 * Why a separate module rather than declaring limiters inline:
 *   1. One place to tune numbers (window/max) per surface, easy to grep.
 *   2. Consistent 429 body shape `{ error, code, retryAfter }` so the SPA
 *      can render a uniform "slow down" message rather than per-route
 *      guessing.
 *   3. `keyGenerator` lets us combine IP + tenantId for surfaces where a
 *      single IP behind a NAT (e.g. a co-working space) shouldn't lock all
 *      the tenants out — and surfacing the resolved tenant in the security
 *      log aids incident review.
 */
import rateLimit from 'express-rate-limit';
import { logSecurityEvent, ipFromRequest } from '../lib/securityLog';

/**
 * Strict limiter for auth surfaces — login, register, forgot/reset
 * password. These are the most attractive brute-force / credential-
 * stuffing targets, so we hold them to a tight per-IP budget.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many auth attempts, please try again later.',
    code: 'RATE_LIMITED_AUTH',
  },
  handler: (req, res, _next, options) => {
    logSecurityEvent({
      type: 'rate_limit',
      ip: ipFromRequest(req),
      details: { surface: 'auth', message: options.message },
    });
    res.status(429).json(options.message);
  },
});

/**
 * Even stricter limiter for OTP/verify-style endpoints if/when we add
 * them (telebirr push, SMS-OTP). Reserved here so we don't accidentally
 * reuse the looser auth preset on something a script can blast at 20/15min.
 */
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many verification attempts, please try again later.',
    code: 'RATE_LIMITED_OTP',
  },
  handler: (req, res, _next, options) => {
    logSecurityEvent({
      type: 'rate_limit',
      ip: ipFromRequest(req),
      details: { surface: 'otp', message: options.message },
    });
    res.status(429).json(options.message);
  },
});

/**
 * Booking endpoint (POST /api/public/bookings) — the most attractive
 * public-side abuse target: every hit creates a row in the DB and (when
 * the tenant requires it) initiates a real Chapa charge. 30 submissions
 * per 10 minutes per IP is plenty for a real customer booking flow while
 * still choking a drive-by spammer.
 */
export const bookingWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many booking attempts from this address, please try again later.',
    code: 'RATE_LIMITED_BOOKING',
  },
  handler: (req, res, _next, options) => {
    logSecurityEvent({
      type: 'rate_limit',
      tenantId: (req as any)?.tenant?.id ?? null,
      ip: ipFromRequest(req),
      details: { surface: 'booking', message: options.message },
    });
    res.status(429).json(options.message);
  },
});

/**
 * Read-only public directory endpoints (/discover, /api/public/* GETs).
 * These can be hit on every page-load of the public site so the budget is
 * generous: 300/10min/IP. Tight enough to stop a scraper hammering the
 * directory for every tenant; loose enough to keep a real visitor's
 * pageloads responsive.
 */
export const publicReadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests, please slow down.',
    code: 'RATE_LIMITED_PUBLIC_READ',
  },
  handler: (req, res, _next, options) => {
    logSecurityEvent({
      type: 'rate_limit',
      tenantId: (req as any)?.tenant?.id ?? null,
      ip: ipFromRequest(req),
      details: { surface: 'public_read', path: req.path, message: options.message },
    });
    res.status(429).json(options.message);
  },
});

/**
 * Payment webhook endpoint. Externally callable only by Chapa, but exposed
 * publicly so the provider can reach us. LIMITER_GOAL: stop a misbehaving
 * client (or an attacker that guesses a tx_ref but can't forge the
 * signature) from hammering us at 1000 req/s. Signature validation rejects
 * most malicious traffic before any work happens; this limiter keeps the
 * request-per-second rate survivable when a webhook gets backed up.
 *
 * 60/minute/IP is generous for a real Chapa retry burst; a forged flood
 * would chew through it fast and get 429'd.
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many webhook deliveries from this address.',
    code: 'RATE_LIMITED_WEBHOOK',
  },
  handler: (req, res, _next, options) => {
    logSecurityEvent({
      type: 'rate_limit',
      ip: ipFromRequest(req),
      details: { surface: 'webhook', message: options.message },
    });
    res.status(429).json(options.message);
  },
});

/**
 * Authenticated-tenant write surface (POST/PUT/DELETE under /api/tenant/*).
 * 200/10min/IP+tenant is plenty for dashboard clicks; an attacker that
 * steals a token can't blast writes past this rate while a defender is
 * reacting. Reads are deliberately exempt so a busy dashboard doesn't get
 * throttled on normal navigation.
 *
 * `skip` returns true for any non-mutating method so GETs fall through.
 */
export const tenantWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
  message: {
    error: 'Too many write requests, please slow down.',
    code: 'RATE_LIMITED_TENANT_WRITE',
  },
  keyGenerator: (req) => {
    // Combine IP + tenantId so several tenants sharing an office NAT
    // each get their own bucket rather than all sharing one IP's budget.
    const tenantId = (req as any)?.user?.tenantId ?? 'anon';
    return `${ipFromRequest(req) ?? 'unknown'}:${tenantId}`;
  },
  handler: (req, res, _next, options) => {
    logSecurityEvent({
      type: 'rate_limit',
      tenantId: (req as any)?.user?.tenantId ?? null,
      ip: ipFromRequest(req),
      details: { surface: 'tenant_write', path: req.path, method: req.method, message: options.message },
    });
    res.status(429).json(options.message);
  },
});

/**
 * Media upload (POST /api/tenant/upload specifically). Stricter than the
 * general tenant-write limiter because uploads are CPU/IO-expensive
 * (sharp resize) and an attacker with a stolen token could otherwise use
 * them to chew disk and CPU. 20 uploads/10min/IP+tenant is generous for a
 * real owner curating a gallery; anything past that is suspicious.
 */
export const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many uploads, please try again later.',
    code: 'RATE_LIMITED_UPLOAD',
  },
  keyGenerator: (req) => {
    const tenantId = (req as any)?.user?.tenantId ?? 'anon';
    return `upload:${ipFromRequest(req) ?? 'unknown'}:${tenantId}`;
  },
  handler: (req, res, _next, options) => {
    logSecurityEvent({
      type: 'rate_limit',
      tenantId: (req as any)?.user?.tenantId ?? null,
      ip: ipFromRequest(req),
      details: { surface: 'upload', message: options.message },
    });
    res.status(429).json(options.message);
  },
});

/**
 * Admin (superadmin) write surface. Very loose — there should only ever be
 * a handful of superadmins and they shouldn't be hitting /api/admin at
 * volume — but capped so a leaked superadmin token can't be used to
 * mass-suspend tenants at 1000/sec.
 */
export const adminWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
  message: {
    error: 'Too many admin actions, please slow down.',
    code: 'RATE_LIMITED_ADMIN',
  },
  handler: (req, res, _next, options) => {
    logSecurityEvent({
      type: 'rate_limit',
      tenantId: (req as any)?.user?.tenantId ?? null,
      ip: ipFromRequest(req),
      details: { surface: 'admin', path: req.path, method: req.method, message: options.message },
    });
    res.status(429).json(options.message);
  },
});
