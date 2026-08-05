/**
 * Database-resilience guard.
 *
 * When the database becomes unreachable the whole platform should degrade to
 * a clean, cachable 503 ("Service temporarily unavailable") rather than leak
 * stack traces or return misleading 500s. Two pieces work together:
 *
 *   1. `dbHealthMiddleware` — a circuit-breaker mounted at the top of the API
 *      router. While healthy it performs at most one `SELECT 1` ping every
 *      `OK_TTL_MS`; the moment a ping (or an earlier in-route query) fails
 *      with a connection-style error it trips the breaker open for
 *      `retryAfter` seconds and short-circuits every subsequent request with
 *      503 — without hammering the dead server.
 *
 *   2. `isDbUnavailableError(err)` — a best-effort classifier reused by the
 *      server.ts global error handler so any DB-unreachable error that
 *      escapes a route's try/catch (e.g. thrown synchronously, or forwarded
 *      via `next(dbError)`) is normalised to the same 503 shape instead of a
 *      generic 500.
 *
 * The `createDbHealthMiddleware` factory takes an injected `ping` so tests
 * can simulate a downed database without touching the real connection.
 */
import { sql } from 'drizzle-orm';
import { db } from './index';

const DEFAULT_RETRY_AFTER = 30;
const OK_TTL_MS = 2000; // re-ping at most every 2s while healthy

/**
 * Best-effort classification of "database is unreachable" driver errors
 * (connection refused/closed/timeout, network failure, unresponsive host).
 * Safe under any engine: it inspects the message/code text and returns false
 * for anything it doesn't recognise, so non-connection SQL errors still take
 * the normal 500 path.
 */
export function isDbUnavailableError(err: any): boolean {
  if (!err) return false;
  if (err?.name === 'DbUnavailableError') return true;
  const msg = [err?.message, err?.code, err?.cause?.message]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase())
    .join(' ');
  return (
    msg.includes('connection refused') ||
    msg.includes('econnrefused') ||
    msg.includes('refused') ||
    msg.includes('connection closed') ||
    msg.includes('connection timed out') ||
    msg.includes('failed to connect') ||
    msg.includes('could not reach') ||
    msg.includes('client is closed') ||
    msg.includes('socket hang up') ||
    msg.includes('socket timeout') ||
    msg.includes('network') ||
    msg.includes('unreachable') ||
    msg.includes('hrana') ||
    msg.includes('not connected')
  );
}

export interface DbHealthDeps {
  /** Async probe that resolves when the DB is reachable, rejects otherwise. */
  ping: () => Promise<void>;
  /** Optional error classifier override (defaults to `isDbUnavailableError`). */
  isDown?: (e: unknown) => boolean;
  /** Seconds in the `retryAfter` body field / Retry-After header + breaker window. */
  retryAfter?: number;
}

export function createDbHealthMiddleware(deps: DbHealthDeps) {
  const isDown = deps.isDown ?? isDbUnavailableError;
  const retryAfter = deps.retryAfter ?? DEFAULT_RETRY_AFTER;
  const cooldownMs = retryAfter * 1000;

  // Per-instance circuit-breaker state (not shared across middleware instances).
  let circuitOpenUntil = 0;
  let lastOkPing = 0;

  return async function dbHealth(_req: any, res: any, next: any) {
    const now = Date.now();
    // Breaker is open — short-circuit immediately, no query attempted.
    if (circuitOpenUntil > now) {
      return res
        .status(503)
        .set('Retry-After', String(retryAfter))
        .json({ error: 'Service temporarily unavailable', retryAfter });
    }

    // Healthy within the TTL window — skip the redundant ping.
    if (now - lastOkPing < OK_TTL_MS) {
      return next();
    }

    try {
      await deps.ping();
      lastOkPing = now;
      circuitOpenUntil = 0;
      return next();
    } catch (err) {
      if (!isDown(err)) return next(err); // not a connectivity failure → 500
      circuitOpenUntil = Date.now() + cooldownMs;
      return res
        .status(503)
        .set('Retry-After', String(retryAfter))
        .json({ error: 'Service temporarily unavailable', retryAfter });
    }
  };
}

export const dbHealthMiddleware = createDbHealthMiddleware({
  ping: async () => {
    await db.run(sql`select 1`);
  },
});