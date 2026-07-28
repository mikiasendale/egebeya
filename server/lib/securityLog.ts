/**
 * Structured security event logger.
 *
 * Distinct from Sentry's error tracking: Sentry is for "something broke and
 * we need to fix it"; this is the audit log the operator reviews when they
 * need to ask "did someone try to mess with the system?" — failed logins,
 * rejected webhook signatures, rate-limit triggers, cross-tenant access
 * attempts caught by the isolation checks, etc.
 *
 * Every helper here is fire-and-forget: the function writes a row to the
 * `security_events` table (creating a deterministic UUID, capturing the
 * caller's tenantId/IP, and JSON-stringifying any structured details) but
 * never throws into the request path. A failure to log a security event is
 * not allowed to break the user's request — worst case we log to stderr and
 * move on, so a flaky disk can't take down auth.
 *
 * Conventions:
 *  - `details` is operator-curated metadata only; never pass the raw user
 *    payload or the raw request body in — the log should not itself become
 *    an injection sink.
 *  - `ip` is whatever Express already resolved via `req.ip` (honors
 *    X-Forwarded-For when `trust proxy` is set; otherwise the raw socket
 *    address). Caller passes it in so we don't need to import Express types
 *    into the data layer.
 *  - `result` is 'failure' for almost every code path that calls us; the
 *    field exists so a future "we recorded a near-miss as success" event
 *    type is expressible without schema churn.
 */
import { db } from '../../src/db';
import { securityEvents } from '../../src/db/schema';
import crypto from 'crypto';

export type SecurityEventType =
  | 'failed_login'
  | 'webhook_signature_rejected'
  | 'rate_limit'
  | 'cross_tenant_attempt'
  | 'suspended_tenant_request'
  | 'plan_gate_denied'
  | 'webhook_idempotent_duplicate'
  | 'data_deletion_request';

export interface SecurityEventInput {
  type: SecurityEventType;
  tenantId?: string | null;
  ip?: string | null;
  result?: 'success' | 'failure';
  details?: Record<string, unknown> | null;
}

/**
 * Insert a row into `security_events`. Never throws, never returns a
 * promise the caller is forced to await. Returns void so call sites stay
 * terse: `logSecurityEvent({ type: 'failed_login', ip, details: { phone } });`.
 *
 * Trims `details` to a sane size (4KB) before persisting so a runaway
 * metadata blob can't bloat the table.
 */
export function logSecurityEvent(input: SecurityEventInput): void {
  const row = {
    id: crypto.randomUUID(),
    eventType: input.type,
    tenantId: input.tenantId ?? null,
    ip: input.ip ?? null,
    result: input.result ?? 'failure',
    details: input.details ?? null,
    createdAt: Date.now(),
  };

  // Best-effort persist: catch any DB error and surface it on stderr so the
  // operator notices the logger is degraded without derailing the request
  // that triggered the security event in the first place.
  try {
    if (row.details) {
      const json = JSON.stringify(row.details);
      row.details = json.length > 4096 ? json.slice(0, 4096) : (json as any);
    }
    void db.insert(securityEvents).values(row).catch((err) => {
      console.error('[security-events] failed to persist:', err?.message || err);
    });
  } catch (err: any) {
    console.error('[security-events] threw synchronously:', err?.message || err);
  }
}

/**
 * Pull the IP off an Express request, defensively. `req.ip` is populated
 * once Express has its `trust proxy` setting happy; if for some reason it
 * isn't (e.g. raw supertest hit before middleware fully runs), fall back to
 * `req.socket?.remoteAddress`. Returns null when neither is available so
 * the log row stores a NULL rather than the string "undefined".
 */
export function ipFromRequest(req: any): string | null {
  const ip = req?.ip ?? req?.socket?.remoteAddress ?? req?.connection?.remoteAddress;
  return typeof ip === 'string' && ip.length > 0 ? ip : null;
}
