/**
 * ops-check.ts (P3.6) — the daily ops floor probe. Exits NONZERO on any
 * threshold breach so a crontab alert (or the founder's morning ritual)
 * catches problems before tenants do.
 *
 * Checks:
 *   1. Disk free on the DB volume            ≥ OPS_MIN_DISK_MB   (default 500)
 *   2. Database file size                    ≤ OPS_MAX_DB_MB     (default 2000)
 *   3. SQLITE_BUSY probe loop                5 timed reads, none may error
 *                                            and p95 must stay < 2s
 *   4. Sentry reachability                   DSN configured? test event sent?
 *                                            (missing DSN = WARN, not breach)
 *   5. Cron last-run ages                    billing reminders ≤ 26h,
 *                                            webhooks seen ≤ 24h
 *                                            (thresholds via OPS_CRON_* envs;
 *                                             empty tables = WARN only)
 *   6. USD infra spend vs monthly budget     OPS_INFRA_SPEND_USD must be
 *                                            ≤ OPS_MONTHLY_BUDGET_USD when
 *                                            the budget is set (CEO risk #5:
 *                                            ETB devaluation vs USD costs).
 */
import fs from 'fs';
import path from 'path';
import { createClient } from '@libsql/client';

export interface OpsCheckResult {
  check: string;
  ok: boolean;
  detail: string;
  /** Warnings don't fail the run; breaches do. */
  severity: 'ok' | 'warn' | 'breach';
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function diskFreeMb(path: string): Promise<number> {
  // Node ≥18.13 exposes fs.statfs.
  const st = await (fs as any).promises.statfs(path);
  return Math.round((st.bavail * st.bsize) / (1024 * 1024));
}

export async function runOpsChecks(opts: {
  now?: number;
  dbFile?: string;
} = {}): Promise<OpsCheckResult[]> {
  const results: OpsCheckResult[] = [];
  const push = (check: string, ok: boolean, detail: string, severity: 'ok' | 'warn' | 'breach') =>
    results.push({ check, ok: severity !== 'breach', detail, severity });

  // ── Resolve DB file ────────────────────────────────────────────────────
  const url = process.env.DATABASE_URL || 'file:sqlite.db';
  const dbFile = opts.dbFile ?? (url.startsWith('file:') ? url.slice('file:'.length) || 'sqlite.db' : null);
  const dbDir = dbFile ? (fs.existsSync(dbFile) ? fs.statSync(dbFile).isDirectory() ? dbFile : path.dirname(dbFile) : process.cwd()) : process.cwd();

  // ── 1. Disk ────────────────────────────────────────────────────────────
  try {
    const freeMb = await diskFreeMb(dbDir);
    const minMb = num(process.env.OPS_MIN_DISK_MB, 500);
    push(
      'disk_free',
      freeMb >= minMb,
      `${freeMb} MiB free (min ${minMb})`,
      freeMb >= minMb ? 'ok' : 'breach',
    );
  } catch (err: any) {
    push('disk_free', false, `statfs unavailable: ${err?.message}`, 'warn');
  }

  // ── 2. DB size ────────────────────────────────────────────────────────
  if (dbFile && fs.existsSync(dbFile)) {
    const mb = Math.round(fs.statSync(dbFile).size / (1024 * 1024));
    const maxMb = num(process.env.OPS_MAX_DB_MB, 2000);
    push('db_size', mb <= maxMb, `${mb} MiB (max ${maxMb})`, mb <= maxMb ? 'ok' : 'breach');
  } else {
    push('db_size', true, 'local DB file not found (remote/Turso mode?)', 'warn');
  }

  // ── 3. SQLITE_BUSY probe loop ─────────────────────────────────────────
  try {
    const client = createClient({ url: dbFile ? `file:${dbFile}` : url });
    const latencies: number[] = [];
    let errored: string | null = null;
    for (let i = 0; i < 5; i++) {
      const t0 = Date.now();
      try {
        await client.execute('SELECT count(*) FROM sqlite_master');
        latencies.push(Date.now() - t0);
      } catch (err: any) {
        errored = err?.message || String(err);
        break;
      }
    }
    client.close();
    if (errored) {
      push('sqlite_busy_probe', false, `probe failed: ${errored}`, 'breach');
    } else {
      const max = Math.max(...latencies);
      const busy = latencies.some((l) => l > 2000);
      push(
        'sqlite_busy_probe',
        !busy,
        `5 probes ok, slowest ${max}ms${busy ? ' (>2s — possible lock contention)' : ''}`,
        busy ? 'breach' : 'ok',
      );
    }
  } catch (err: any) {
    push('sqlite_busy_probe', false, `client open failed: ${err?.message}`, 'breach');
  }

  // ── 4. Sentry ping ────────────────────────────────────────────────────
  const sentryDsn = process.env.VITE_SENTRY_DSN || process.env.SENTRY_DSN || '';
  if (!sentryDsn) {
    push('sentry', true, 'no SENTRY_DSN configured', 'warn');
  } else {
    try {
      // Dynamic import so a missing SDK never breaks ops checks.
      const mod = await import('@sentry/node').catch(() => null);
      if (mod) {
        // Configuration-only ping: full network verification would spam the
        // ingest quota; presence of a well-formed DSN + SDK load is our v1 bar.
        const looksValid = /^https:\/\/[^@]+@[^/]+\/\d+$/.test(sentryDsn) || sentryDsn.length > 30;
        push('sentry', looksValid, 'DSN configured and SDK loads', looksValid ? 'ok' : 'warn');
      } else {
        push('sentry', true, '@sentry/node not installed; skipping ping', 'warn');
      }
    } catch (err: any) {
      push('sentry', false, `ping failed: ${err?.message}`, 'warn');
    }
  }

  // ── 5. Cron last-run ages ─────────────────────────────────────────────
  const now = opts.now ?? Date.now();
  const HOUR_MS = 3600 * 1000;
  try {
    const client = createClient({ url: dbFile ? `file:${dbFile}` : url });
    const cronTargets: Array<{ name: string; table: string; column: string; maxAgeHours: number }> = [
      { name: 'billing_reminders', table: 'billing_reminder_sends', column: 'sent_at', maxAgeHours: num(process.env.OPS_CRON_BILLING_MAX_AGE_HOURS, 26) },
      { name: 'webhooks_seen', table: 'processed_webhook_events', column: 'received_at', maxAgeHours: num(process.env.OPS_CRON_WEBHOOK_MAX_AGE_HOURS, 24) },
    ];
    for (const target of cronTargets) {
      const res = await client.execute(`SELECT MAX(${target.column}) AS last FROM ${target.table}`);
      const raw = (res.rows?.[0] as any)?.last;
      if (raw == null) {
        push(`cron_${target.name}`, true, 'no rows yet (empty table)', 'warn');
        continue;
      }
      const ageH = Math.round((now - Number(raw)) / HOUR_MS);
      push(
        `cron_${target.name}`,
        ageH <= target.maxAgeHours,
        `last run ${ageH}h ago (max ${target.maxAgeHours})`,
        ageH <= target.maxAgeHours ? 'ok' : 'breach',
      );
    }
    client.close();
  } catch (err: any) {
    push('cron_ages', false, `query failed: ${err?.message}`, 'warn');
  }

  // ── 5b. Stale settlements (P1.7 red-flag) ──────────────────────────────
  // Collected ≠ settled: Chapa settles T+2/T+3. A paid-but-unsettled payment
  // older than 5 days needs manual comparison against the Chapa dashboard
  // export (server/lib/settlements.ts). The weekly report script catches it;
  // this makes the MORNING ritual catch it too.
  try {
    const client = createClient({ url: dbFile ? `file:${dbFile}` : url });
    const staleMs = 5 * 24 * 3600 * 1000;
    const res = await client.execute({
      sql: `SELECT COUNT(*) AS n FROM payments
            WHERE status = 'completed' AND settlement_status = 'pending'
              AND settled_at IS NOT NULL AND settled_at < ?`,
      args: [now - staleMs],
    });
    const staleCount = Number((res.rows?.[0] as any)?.n ?? 0);
    push(
      'stale_settlements',
      staleCount === 0,
      staleCount === 0
        ? 'no paid-but-unsettled payments past 5 days'
        : `${staleCount} payment(s) unsettled past 5 days — reconcile against Chapa dashboard`,
      staleCount === 0 ? 'ok' : 'breach',
    );
    client.close();
  } catch (err: any) {
    push('stale_settlements', true, `query failed: ${err?.message}`, 'warn');
  }

  // ── 6. USD infra budget (CEO risk #5) ─────────────────────────────────
  const spendUsd = process.env.OPS_INFRA_SPEND_USD ? Number(process.env.OPS_INFRA_SPEND_USD) : null;
  const budgetUsd = process.env.OPS_MONTHLY_BUDGET_USD ? Number(process.env.OPS_MONTHLY_BUDGET_USD) : null;
  if (budgetUsd != null && spendUsd != null) {
    const over = spendUsd > budgetUsd;
    push(
      'infra_budget_usd',
      !over,
      `$${spendUsd.toFixed(2)} spent of $${budgetUsd.toFixed(2)} monthly budget`,
      over ? 'breach' : 'ok',
    );
  } else {
    push('infra_budget_usd', true, 'set OPS_MONTHLY_BUDGET_USD + OPS_INFRA_SPEND_USD to enable', 'warn');
  }

  return results;
}

const isDirectRun = process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href;
if (isDirectRun && process.env.NODE_ENV !== 'test') {
  runOpsChecks().then((results) => {
    console.log('\n=== EGEBEYA OPS CHECK ===');
    let failed = false;
    for (const r of results) {
      const mark = r.severity === 'ok' ? 'PASS' : r.severity === 'warn' ? 'WARN' : 'FAIL';
      if (r.severity === 'breach') failed = true;
      console.log(`${mark.padEnd(4)} ${r.check.padEnd(22)} ${r.detail}`);
    }
    console.log(failed ? '\nRESULT: BREACHES DETECTED' : '\nRESULT: OK');
    process.exit(failed ? 1 : 0);
  });
}
