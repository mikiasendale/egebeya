/**
 * Idempotent ALTER TABLE migrations.
 *
 * These run on every server boot before traffic is served. Each migration is a
 * small "if column X is missing on table Y, add it" check — they tolerate a
 * freshly-created database (the Drizzle CREATE TABLE statements in schema.ts
 * already cover the day-zero shape, so most of these are no-ops on a clean db)
 * and adapt legacy databases that pre-date a column without losing data.
 *
 * Conventions:
 *  - Never `DROP`; only `ADD COLUMN` (or equivalent additive change).
 *  - Each migration is wrapped in try/catch so a single failure can't block
 *    boot — see server.ts where failures are logged.
 *  - The function returns a `Record<string, string[]>` listing every column
 *    added (table → columns) so the boot log has something meaningful when
 *    a real schema-update happens in production.
 */

import { db } from './index';
import { plans, tenantSubscriptions } from './schema';
import { eq } from 'drizzle-orm';

type TableInfo = { name: string; cid: number; type: string; notnull: 0 | 1; pk: number };

/**
 * Read the existing columns of a table. Returns an empty list if the table
 * does not exist (caller can use presence as a guard).
 *
 * Uses the libsql client's `execute` duck-type so it doesn't depend on a
 * specific Drizzle version exposing raw SQL helpers.
 */
async function getColumns(tableName: string): Promise<Set<string>> {
  const driver = (db as any).session?.client ?? (db as any).$client ?? (db as any).driver;
  const client = driver ?? db;
  // libsql's `execute` returns `{ rows: [...] }` for SELECT.
  const result: any = await (client.execute
    ? client.execute(`PRAGMA table_info(${tableName})`)
    : db.all((({ sql: `PRAGMA table_info(${tableName})` } as unknown) as any)));
  const rows: TableInfo[] = (result?.rows ?? result) as TableInfo[];
  return new Set(rows.map((r) => r.name));
}

async function addColumnIfMissing(
  table: string,
  column: string,
  sql: string,
): Promise<string | null> {
  const cols = await getColumns(table);
  if (cols.has(column)) return null;
  const driver = (db as any).session?.client ?? (db as any).$client ?? (db as any).driver;
  const client = driver ?? db;
  if (client.execute) {
    await client.execute(sql);
  } else {
    await db.run((({ sql } as unknown) as any));
  }
  return column;
}

/**
 * Run every registered migration. Returns a `table -> columns added` map so
 * the caller can log a single line per boot when the schema has actually
 * moved forward. A clean boot (newest schema already in place) returns `{}`.
 */
export async function ensureSchemaMigrations(): Promise<Record<string, string[]>> {
  const added: Record<string, string[]> = {};

  const migrations: Array<{ table: string; column: string; sql: string }> = [
    // `site_config` — the Website Builder's mode + published Code-Mode HTML.
    // Declared in schema.ts but must also be created here for existing DBs.
    {
      table: 'site_config',
      column: 'id',
      sql: `
        CREATE TABLE IF NOT EXISTS site_config (
          tenant_id TEXT PRIMARY KEY REFERENCES tenants(id),
          builder_mode TEXT NOT NULL DEFAULT 'puck',
          published_code_html TEXT,
          updated_at INTEGER NOT NULL
        )
      `,
    },
    // `isSuspended` was added after launch. Default false so existing tenants
    // continue to serve; the admin route is the only writer.
    {
      table: 'tenants',
      column: 'is_suspended',
      sql: `ALTER TABLE tenants ADD COLUMN is_suspended INTEGER NOT NULL DEFAULT 0`,
    },
    {
      // Idempotency log for inbound payment webhooks. The (provider, event_id)
      // unique index is what makes "duplicate webhook replay" a race-free
      // detection — the second concurrent insert hits UNIQUE and we
      // short-circuit without mutating payment/appointment rows.
      //
      // CREATE TABLE is wrapped in `IF NOT EXISTS` because the Drizzle schema
      // bootstrap (from schema.ts) will also create it on a fresh DB; we only
      // want this migration to guarantee the table exists for databases that
      // already have everything except this new row.
      table: 'processed_webhook_events',
      column: 'id',
      sql: `
        CREATE TABLE IF NOT EXISTS processed_webhook_events (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          event_id TEXT NOT NULL,
          tx_ref TEXT,
          payment_id TEXT,
          action TEXT NOT NULL,
          raw TEXT,
          received_at INTEGER NOT NULL
        )
      `,
    },
    {
      // Same rationale as above: the unique index is part of declarative
      // schema (schema.ts) on fresh installs; CREATE UNIQUE INDEX IF NOT
      // EXISTS covers existing installs that gained the table via the prior
      // step but don't yet have the index.
      table: 'processed_webhook_events',
      column: 'idx_provider_event',
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS processed_webhook_events_provider_event_unique ON processed_webhook_events(provider, event_id)`,
    },
    {
      // security_events — append-only audit log for security-relevant
      // occurrences (failed logins, rejected webhook signatures, rate
      // limit triggers, cross-tenant access attempts). Created here so
      // existing installs gain the table on the next boot without having
      // to wipe sqlite.db; fresh installs get it from schema.ts.
      table: 'security_events',
      column: 'id',
      sql: `
        CREATE TABLE IF NOT EXISTS security_events (
          id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          tenant_id TEXT,
          ip TEXT,
          result TEXT NOT NULL,
          details TEXT,
          created_at INTEGER NOT NULL
        )
      `,
    },
    {
      // Supporting indexes for the (future) admin dashboard views:
      //   - list events of a given type over time.
      //   - list events scoped to a tenant, ordered newest-first.
      table: 'security_events',
      column: 'idx_event_type',
      sql: `CREATE INDEX IF NOT EXISTS security_events_event_type_idx ON security_events(event_type)`,
    },
    {
      table: 'security_events',
      column: 'idx_tenant_created',
      sql: `CREATE INDEX IF NOT EXISTS security_events_tenant_created_idx ON security_events(tenant_id, created_at)`,
    },
    {
      table: 'users',
      column: 'token_version',
      sql: `ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0`,
    },
    {
      // consent_given_at — records when the user agreed to Privacy Policy + Terms.
      // Nullable so existing users aren't blocked; new registrations must provide it.
      table: 'users',
      column: 'consent_given_at',
      sql: `ALTER TABLE users ADD COLUMN consent_given_at INTEGER`,
    },
    {
      // is_superadmin — platform-level admin flag for the internal /admin panel.
      // Only ever set manually in the DB for the operator's own account, never
      // via signup. Default false so every existing user stays non-admin.
      table: 'users',
      column: 'is_superadmin',
      sql: `ALTER TABLE users ADD COLUMN is_superadmin INTEGER NOT NULL DEFAULT 0`,
    },
    {
      // refresh_token_id — opaque server-issued jti that travels inside the
      // refresh-token JWT. Rotated on every successful /auth/refresh so a
      // stolen RT cannot be replayed once the legitimate client has refreshed
      // (replay → mismatched jti → 403). Backfilled to a UUID for existing
      // users so they get a clean rotation at next login.
      table: 'users',
      column: 'refresh_token_id',
      sql: `ALTER TABLE users ADD COLUMN refresh_token_id TEXT NOT NULL DEFAULT ''`,
    },
    {
      // active_build_id — points to the current published Code Mode build
      // folder under storage/pro-builds/{tenantId}/{buildId}/. Added for
      // the new publish pipeline. Default NULL so existing tenants continue
      // to work without a build.
      table: 'site_config',
      column: 'active_build_id',
      sql: `ALTER TABLE site_config ADD COLUMN active_build_id TEXT`,
    },
    {
      // sent_via — audit column on appointments recording which reminder
      // channel was used ('sms', 'email', or 'both'). Nullable so existing
      // rows (pre-SMS) report NULL in the dashboard audit view.
      table: 'appointments',
      column: 'sent_via',
      sql: `ALTER TABLE appointments ADD COLUMN sent_via TEXT`,
    },
    {
      // cancels_at — when payment_upfront is true, this is set to
      // startTimeMs - 15min so abandoned pending slots are reclaimed by the
      // cleanup cron without a manual refund step (refunds are manual).
      table: 'appointments',
      column: 'cancels_at',
      sql: `ALTER TABLE appointments ADD COLUMN cancels_at INTEGER`,
    },
  ];

  for (const m of migrations) {
    try {
      const addedCol = await addColumnIfMissing(m.table, m.column, m.sql);
      if (addedCol) {
        (added[m.table] ||= []).push(addedCol);
      }
    } catch (err) {
      // Don't block boot on a single bad migration — log and continue.
      console.warn(`[migrations] ${m.table}.${m.column} skipped:`, (err as Error)?.message);
    }
  }

  await normalizePlanRows();

  return added;
}

/**
 * Canonicalise plan rows. Older seeds created 'Basic'/'Pro' (title-case)
 * alongside the canonical 'free'/'pro' — duplicate rows break the Pro gate
 * and the upgrade flow. This:
 *   1. ensures exactly one 'free' and one 'pro' row exist,
 *   2. re-points subscriptions off legacy 'Basic'/'Pro' rows to canonical,
 *   3. deletes the legacy rows.
 * Idempotent — safe on every boot.
 */
async function normalizePlanRows(): Promise<void> {
  try {
    const all = await db.select().from(plans).all();

    const canonicalFree = all.find((p) => p.name === 'free');
    const canonicalPro = all.find((p) => p.name === 'pro');
    const legacyFree = all.find((p) => p.name === 'Basic');
    const legacyPro = all.find((p) => p.name === 'Pro');

    if (canonicalFree && legacyFree) {
      await db.update(tenantSubscriptions).set({ planId: canonicalFree.id }).where(eq(tenantSubscriptions.planId, legacyFree.id));
      await db.delete(plans).where(eq(plans.id, legacyFree.id)).catch(() => {});
    }
    if (canonicalPro && legacyPro) {
      await db.update(tenantSubscriptions).set({ planId: canonicalPro.id }).where(eq(tenantSubscriptions.planId, legacyPro.id));
      await db.delete(plans).where(eq(plans.id, legacyPro.id)).catch(() => {});
    }
  } catch (err) {
    console.warn('[migrations] normalizePlanRows skipped:', (err as Error)?.message);
  }
}
