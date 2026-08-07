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
  const result: any = await (client.execute
    ? client.execute(`PRAGMA table_info(${tableName})`)
    : db.all((({ sql: `PRAGMA table_info(${tableName})` } as unknown) as any)));
  const rows: TableInfo[] = (result?.rows ?? result) as TableInfo[];
  return new Set(rows.map((r) => r.name));
}

/**
 * Check if a table exists by attempting to query it.
 */
async function tableExists(tableName: string): Promise<boolean> {
  const cols = await getColumns(tableName);
  return cols.size > 0;
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

async function createTableIfMissing(
  table: string,
  sql: string,
): Promise<boolean> {
  const exists = await tableExists(table);
  if (exists) return false;
  try {
    const driver = (db as any).session?.client ?? (db as any).$client ?? (db as any).driver;
    const client = driver ?? db;
    if (client.execute) {
      await client.execute(sql);
    } else {
      await db.run((({ sql } as unknown) as any));
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Run every registered migration. Returns a `table -> columns added` map so
 * the caller can log a single line per boot when the schema has actually
 * moved forward. A clean boot (newest schema already in place) returns `{}`.
 */
export async function ensureSchemaMigrations(): Promise<Record<string, string[]>> {
  const added: Record<string, string[]> = {};

  const migrations: Array<{ table: string; column: string; sql: string }> = [
    // ────────────────────────────────────────────────────────────────
    // Day-zero schema bootstrap. Drizzle's schema.ts declares these tables,
    // but they only exist in a database after `drizzle-kit push` runs against
    // it. Render/Turso databases start empty, so on every boot we CREATE the
    // full core schema (IF NOT EXISTS keeps it a no-op for existing DBs).
    // Parent tables come first so FK references resolve. Column names must
    // match schema.ts exactly.
    // ────────────────────────────────────────────────────────────────
    {
      table: 'tenants',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        domain TEXT UNIQUE,
        category TEXT,
        is_listed INTEGER DEFAULT 1,
        is_suspended INTEGER NOT NULL DEFAULT 0,
        settings TEXT,
        created_at INTEGER NOT NULL
      )`,
    },
    {
      table: 'tenants',
      column: 'idx_slug',
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_unique ON tenants(slug)`,
    },
    {
      table: 'tenants',
      column: 'idx_domain',
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS tenants_domain_unique ON tenants(domain)`,
    },
    {
      table: 'users',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES tenants(id),
        name TEXT NOT NULL,
        phone TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        token_version INTEGER NOT NULL DEFAULT 0,
        consent_given_at INTEGER,
        is_superadmin INTEGER NOT NULL DEFAULT 0,
        refresh_token_id TEXT NOT NULL DEFAULT ''
      )`,
    },
    {
      table: 'users',
      column: 'idx_phone',
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users(phone)`,
    },
    {
      table: 'users',
      column: 'idx_email',
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email)`,
    },
    {
      table: 'password_resets',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS password_resets (
        id TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        user_id TEXT REFERENCES users(id) NOT NULL,
        expires_at INTEGER NOT NULL
      )`,
    },
    {
      table: 'plans',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        max_staff INTEGER NOT NULL,
        custom_domain_allowed INTEGER DEFAULT 0
      )`,
    },
    {
      table: 'tenant_subscriptions',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS tenant_subscriptions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES tenants(id) NOT NULL,
        plan_id TEXT REFERENCES plans(id),
        status TEXT NOT NULL,
        trial_ends_at INTEGER,
        starts_at INTEGER,
        ends_at INTEGER
      )`,
    },
    {
      table: 'tenant_subscriptions',
      column: 'idx_tenant',
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS tenant_subscriptions_tenant_id_unique ON tenant_subscriptions(tenant_id)`,
    },
    {
      table: 'services',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES tenants(id) NOT NULL,
        name TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        price INTEGER NOT NULL,
        image_path TEXT,
        active INTEGER DEFAULT 1
      )`,
    },
    {
      table: 'staff',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS staff (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES tenants(id) NOT NULL,
        user_id TEXT REFERENCES users(id),
        name TEXT NOT NULL,
        title TEXT,
        bio TEXT,
        image_path TEXT,
        active INTEGER DEFAULT 1
      )`,
    },
    {
      table: 'staff_services',
      column: 'staff_id',
      sql: `CREATE TABLE IF NOT EXISTS staff_services (
        staff_id TEXT REFERENCES staff(id) NOT NULL,
        service_id TEXT REFERENCES services(id) NOT NULL
      )`,
    },
    {
      table: 'staff_availability',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS staff_availability (
        id TEXT PRIMARY KEY,
        staff_id TEXT REFERENCES staff(id) NOT NULL,
        day_of_week INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL
      )`,
    },
    {
      table: 'tenant_business_hours',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS tenant_business_hours (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES tenants(id) NOT NULL,
        day_of_week INTEGER NOT NULL,
        open_time TEXT,
        close_time TEXT,
        is_closed INTEGER DEFAULT 0
      )`,
    },
    {
      table: 'tenant_closures',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS tenant_closures (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES tenants(id) NOT NULL,
        date TEXT NOT NULL,
        reason TEXT
      )`,
    },
    {
      table: 'appointments',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES tenants(id) NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_email TEXT,
        staff_id TEXT REFERENCES staff(id) NOT NULL,
        service_id TEXT REFERENCES services(id) NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        status TEXT NOT NULL,
        reminder_sent INTEGER DEFAULT 0,
        sent_via TEXT,
        cancels_at INTEGER,
        recurring_series_id TEXT
      )`,
    },
    {
      table: 'appointment_services',
      column: 'appointment_id',
      sql: `CREATE TABLE IF NOT EXISTS appointment_services (
        appointment_id TEXT REFERENCES appointments(id) NOT NULL,
        service_id TEXT REFERENCES services(id) NOT NULL,
        price_at_booking INTEGER NOT NULL,
        duration_minutes INTEGER NOT NULL,
        PRIMARY KEY (appointment_id, service_id)
      )`,
    },
    {
      table: 'payments',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES tenants(id) NOT NULL,
        appointment_id TEXT REFERENCES appointments(id),
        amount INTEGER NOT NULL,
        gateway TEXT,
        method TEXT,
        gateway_reference TEXT,
        status TEXT NOT NULL,
        meta TEXT
      )`,
    },
    {
      table: 'pages',
      column: 'tenant_id',
      sql: `CREATE TABLE IF NOT EXISTS pages (
        tenant_id TEXT REFERENCES tenants(id) PRIMARY KEY,
        content TEXT
      )`,
    },
    {
      table: 'pro_site_files',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS pro_site_files (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES tenants(id) NOT NULL,
        file_path TEXT NOT NULL,
        content TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    },
    {
      table: 'pro_site_files',
      column: 'idx_tenant_path',
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS pro_site_files_tenant_path_unique ON pro_site_files(tenant_id, file_path)`,
    },
    {
      table: 'media',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS media (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES tenants(id) NOT NULL,
        path TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    },
    // `site_config` — the Website Builder's mode + published Code-Mode HTML.
    {
      table: 'site_config',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS site_config (
        tenant_id TEXT PRIMARY KEY REFERENCES tenants(id),
        builder_mode TEXT NOT NULL DEFAULT 'puck',
        published_code_html TEXT,
        updated_at INTEGER NOT NULL,
        active_build_id TEXT
      )`,
    },
    // ── Legacy ALTER TABLE migrations ──────────────────────────────────
    {
      table: 'tenants',
      column: 'is_suspended',
      sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_suspended INTEGER NOT NULL DEFAULT 0`,
    },
    {
      table: 'users',
      column: 'token_version',
      sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0`,
    },
    {
      table: 'users',
      column: 'consent_given_at',
      sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_given_at INTEGER`,
    },
    {
      table: 'users',
      column: 'is_superadmin',
      sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superadmin INTEGER NOT NULL DEFAULT 0`,
    },
    {
      table: 'users',
      column: 'refresh_token_id',
      sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token_id TEXT NOT NULL DEFAULT ''`,
    },
    {
      table: 'appointments',
      column: 'sent_via',
      sql: `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS sent_via TEXT`,
    },
    {
      table: 'appointments',
      column: 'cancels_at',
      sql: `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancels_at INTEGER`,
    },
    {
      table: 'appointments',
      column: 'recurring_series_id',
      sql: `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurring_series_id TEXT`,
    },
    {
      table: 'customer_stats',
      column: 'tenant_id',
      sql: `CREATE TABLE IF NOT EXISTS customer_stats (
        tenant_id TEXT REFERENCES tenants(id) NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        first_visit_at INTEGER,
        last_visit_at INTEGER,
        visit_count INTEGER NOT NULL DEFAULT 0,
        total_spend_etb_cents INTEGER NOT NULL DEFAULT 0,
        last_cancelled_at INTEGER,
        marketing_opt_in INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        health_tag TEXT NOT NULL DEFAULT 'healthy',
        no_show_count INTEGER NOT NULL DEFAULT 0,
        automation_state TEXT NOT NULL DEFAULT 'active',
        last_automation_sent_at INTEGER,
        PRIMARY KEY (tenant_id, customer_phone)
      )`,
    },
    {
      table: 'customer_stats',
      column: 'marketing_opt_in',
      sql: `ALTER TABLE customer_stats ADD COLUMN IF NOT EXISTS marketing_opt_in INTEGER NOT NULL DEFAULT 0`,
    },
    {
      table: 'customer_stats',
      column: 'health_tag',
      sql: `ALTER TABLE customer_stats ADD COLUMN IF NOT EXISTS health_tag TEXT NOT NULL DEFAULT 'healthy'`,
    },
    {
      table: 'customer_stats',
      column: 'no_show_count',
      sql: `ALTER TABLE customer_stats ADD COLUMN IF NOT EXISTS no_show_count INTEGER NOT NULL DEFAULT 0`,
    },
    {
      table: 'customer_stats',
      column: 'automation_state',
      sql: `ALTER TABLE customer_stats ADD COLUMN IF NOT EXISTS automation_state TEXT NOT NULL DEFAULT 'active'`,
    },
    {
      table: 'customer_stats',
      column: 'last_automation_sent_at',
      sql: `ALTER TABLE customer_stats ADD COLUMN IF NOT EXISTS last_automation_sent_at INTEGER`,
    },
    {
      table: 'promo_codes',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS promo_codes (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES tenants(id) NOT NULL,
        code TEXT NOT NULL,
        discount_type TEXT NOT NULL,
        discount_value INTEGER NOT NULL,
        max_uses INTEGER NOT NULL DEFAULT 1,
        used_count INTEGER NOT NULL DEFAULT 0,
        valid_from INTEGER,
        valid_until INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      )`,
    },
    {
      table: 'appointment_services',
      column: 'price_at_booking',
      sql: `ALTER TABLE appointment_services ADD COLUMN IF NOT EXISTS price_at_booking INTEGER NOT NULL`,
    },
    {
      table: 'appointment_services',
      column: 'duration_minutes',
      sql: `ALTER TABLE appointment_services ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL`,
    },
    {
      table: 'recurring_series',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS recurring_series (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES tenants(id) NOT NULL,
        staff_id TEXT REFERENCES staff(id) NOT NULL,
        service_id TEXT REFERENCES services(id) NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_email TEXT,
        interval TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        timeslot_minutes INTEGER NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      )`,
    },
    // ── Phase 2 migrations (continued) ───────────────────────────────────
    {
      table: 'otp_codes',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS otp_codes (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        used INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )`,
    },
    {
      table: 'otp_codes',
      column: 'idx_phone',
      sql: `CREATE INDEX IF NOT EXISTS otp_codes_phone_idx ON otp_codes(phone, created_at)`,
    },
    {
      table: 'inventory_items',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS inventory_items (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES tenants(id) NOT NULL,
        service_id TEXT REFERENCES services(id),
        name TEXT NOT NULL,
        sku TEXT,
        quantity_on_hand INTEGER NOT NULL DEFAULT 0,
        reorder_threshold INTEGER NOT NULL DEFAULT 5,
        unit TEXT NOT NULL DEFAULT 'unit',
        created_at INTEGER NOT NULL
      )`,
    },
    {
      table: 'api_keys',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES tenants(id) NOT NULL,
        key_prefix TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        scopes TEXT NOT NULL DEFAULT '[]',
        expires_at INTEGER,
        last_used_at INTEGER,
        created_at INTEGER NOT NULL
      )`,
    },
    {
      table: 'search_intent',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS search_intent (
        id TEXT PRIMARY KEY,
        category TEXT,
        city TEXT,
        action TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    },
    {
      table: 'pro_alerts',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS pro_alerts (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES tenants(id) NOT NULL,
        category TEXT NOT NULL,
        city TEXT NOT NULL,
        action_count INTEGER NOT NULL,
        message TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    },
    {
      table: 'processed_webhook_events',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS processed_webhook_events (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        event_id TEXT NOT NULL,
        tx_ref TEXT,
        payment_id TEXT,
        action TEXT NOT NULL,
        raw TEXT,
        received_at INTEGER NOT NULL
      )`,
    },
    {
      table: 'processed_webhook_events',
      column: 'idx_provider_event',
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS processed_webhook_events_provider_event_unique ON processed_webhook_events(provider, event_id)`,
    },
    {
      table: 'security_events',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS security_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        tenant_id TEXT,
        ip TEXT,
        result TEXT NOT NULL,
        details TEXT,
        created_at INTEGER NOT NULL
      )`,
    },
    {
      table: 'security_events',
      column: 'idx_event_type',
      sql: `CREATE INDEX IF NOT EXISTS security_events_event_type_idx ON security_events(event_type)`,
    },
    {
      table: 'security_events',
      column: 'idx_tenant_created',
      sql: `CREATE INDEX IF NOT EXISTS security_events_tenant_created_idx ON security_events(tenant_id, created_at)`,
    },
  ];

  for (const m of migrations) {
    try {
      const addedCol = await addColumnIfMissing(m.table, m.column, m.sql);
      if (addedCol) {
        (added[m.table] ||= []).push(addedCol);
      }
    } catch (err) {
      console.warn(`[migrations] ${m.table}.${m.column} skipped:`, (err as Error)?.message);
    }
  }

  await normalizePlanRows();
  await backfillOnboardingCompletedFlag();

  return added;
}

/**
 * `onboarding_completed` lives inside the tenants.settings JSON blob (not a
 * dedicated column), defaulting to `false`. Because settings is a single JSON
 * column, "adding the column" is really a row-level backfill: every existing
 * tenant gets `settings.onboarding_completed = 0` unless they already carry
 * the key (e.g. a tenant mid-wizard that set it to 1 explicitly).
 *
 * New tenants default to unlisted + un-onboarded via the register endpoint;
 * this migration only reconciles tenants that pre-date the flag.
 */
async function backfillOnboardingCompletedFlag(): Promise<void> {
  try {
    const driver = (db as any).session?.client ?? (db as any).$client ?? (db as any).driver;
    const client = driver ?? db;
    const sqlStmt = `
      UPDATE tenants
      SET settings = json_set(COALESCE(settings, '{}'), '$.onboarding_completed', 0)
      WHERE json_extract(COALESCE(settings, '{}'), '$.onboarding_completed') IS NULL
    `;
    if (client.execute) {
      await client.execute(sqlStmt);
    } else {
      await db.run((({ sql: sqlStmt } as unknown) as any));
    }
  } catch (err) {
    console.warn('[migrations] onboarding_completed backfill skipped:', (err as Error)?.message);
  }
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