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
import { tenants, plans, tenantSubscriptions } from './schema';
import { eq, inArray } from 'drizzle-orm';
import { getOrCreatePlan } from '../../server/lib/plans';
import { SEED_TENANT_SLUGS } from '../../server/lib/demoTenant';

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
  const isIndex = /^CREATE (UNIQUE )?INDEX/i.test(sql.trim());
  // F3: CREATE INDEX rows use a synthetic column guard (they never match a
  // real column), so the log must say what the SQL actually does — "Ensuring
  // index", never the misleading "Adding column".
  console.log(`[migration] Checking ${table}.${column}, existing columns:`, Array.from(cols));
  if (cols.has(column)) {
    console.log(`[migration] Column ${table}.${column} already exists, skipping`);
    return null;
  }
  console.log(isIndex
    ? `[migration] Ensuring index ${table}.${column}`
    : `[migration] Adding column ${table}.${column} with SQL: ${sql}`);
  const driver = (db as any).session?.client ?? (db as any).$client ?? (db as any).driver;
  const client = driver ?? db;
  if (client.execute) {
    await client.execute(sql);
  } else {
    await db.run((({ sql } as unknown) as any));
  }
  console.log(isIndex
    ? `[migration] Index ${table}.${column} ensured`
    : `[migration] Successfully added ${table}.${column}`);
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
        is_demo INTEGER NOT NULL DEFAULT 0,
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
      table: 'appointments',
      column: 'opaque_id',
      sql: `ALTER TABLE appointments ADD COLUMN opaque_id TEXT`,
    },
    {
      table: 'appointments',
      column: 'opaque_id_unique',
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS appointments_opaque_id_unique ON appointments(opaque_id)`,
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
        original_name TEXT,
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
      table: 'tenants',
      column: 'is_demo',
      sql: `ALTER TABLE tenants ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0`,
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
      table: 'appointments',
      column: 'opaque_id',
      sql: `ALTER TABLE appointments ADD COLUMN opaque_id TEXT`,
    },
    {
      table: 'appointments',
      column: 'opaque_id_unique',
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS appointments_opaque_id_unique ON appointments(opaque_id)`,
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
    {
      table: 'refresh_token_families',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS refresh_token_families (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        parent_jti TEXT NOT NULL,
        child_jti TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_used_at INTEGER,
        revoked_at INTEGER
      )`,
    },
    {
      table: 'refresh_token_families',
      column: 'idx_user',
      sql: `CREATE INDEX IF NOT EXISTS refresh_token_families_user_id_idx ON refresh_token_families(user_id)`,
    },
    // P0.5(a): a merchant must not be able to define the same promo code
    // twice — per-tenant lookup would otherwise resolve ambiguously.
    {
      table: 'promo_codes',
      column: 'tenant_code_unique',
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_tenant_code_unique ON promo_codes(tenant_id, code)`,
    },
    // P1.1: founding-rate pricing ladder (ROADMAP §0) — first 25 paying
    // tenants lock the founding price for 12 months; attribution code of the
    // street agent / campaign that acquired them.
    {
      table: 'tenants',
      column: 'founding_rate_locked_until',
      sql: `ALTER TABLE tenants ADD COLUMN founding_rate_locked_until INTEGER`,
    },
    {
      table: 'tenants',
      column: 'acquired_via_code',
      sql: `ALTER TABLE tenants ADD COLUMN acquired_via_code TEXT`,
    },
    // P1.2: subscription invoices/receipts. Mirrors schema.ts exactly.
    {
      table: 'invoices',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES tenants(id) NOT NULL,
        number TEXT NOT NULL UNIQUE,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'ETB',
        period_start INTEGER,
        period_end INTEGER,
        status TEXT NOT NULL DEFAULT 'draft',
        chapa_tx_ref TEXT,
        issued_at INTEGER NOT NULL,
        paid_at INTEGER
      )`,
    },
    {
      table: 'invoices',
      column: 'idx_tenant_issued',
      sql: `CREATE INDEX IF NOT EXISTS invoices_tenant_issued_idx ON invoices(tenant_id, issued_at)`,
    },
    // P1.7 settlement reconciliation — invoiced ≠ collected until Chapa
    // settles (T+2/T+3). NULL = legacy rows that predate tracking.
    {
      table: 'payments',
      column: 'settled_at',
      sql: `ALTER TABLE payments ADD COLUMN settled_at INTEGER`,
    },
    {
      table: 'payments',
      column: 'settlement_status',
      sql: `ALTER TABLE payments ADD COLUMN settlement_status TEXT`,
    },
    {
      table: 'payments',
      column: 'created_at',
      sql: `ALTER TABLE payments ADD COLUMN created_at INTEGER`,
    },
    {
      table: 'invoices',
      column: 'settled_at',
      sql: `ALTER TABLE invoices ADD COLUMN settled_at INTEGER`,
    },
    {
      table: 'invoices',
      column: 'settlement_status',
      sql: `ALTER TABLE invoices ADD COLUMN settlement_status TEXT`,
    },
    // P1.2 (A): payment-level "this charge already granted a Pro cycle" flag.
    {
      table: 'payments',
      column: 'subscription_granted_at',
      sql: `ALTER TABLE payments ADD COLUMN subscription_granted_at INTEGER`,
    },
    // P1.4 dunning-lite: idempotent per (tenant, stage, cycle) send markers.
    {
      table: 'billing_reminder_sends',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS billing_reminder_sends (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES tenants(id) NOT NULL,
        stage TEXT NOT NULL,
        cycle_start INTEGER NOT NULL,
        channel TEXT,
        sent_at INTEGER NOT NULL
      )`,
    },
    {
      table: 'billing_reminder_sends',
      column: 'idx_tenant_stage_cycle',
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS billing_reminders_tenant_stage_cycle_unique ON billing_reminder_sends(tenant_id, stage, cycle_start)`,
    },
    // ── Phase 3 (P3.2–P3.5, P3.7) ────────────────────────────────────────
    // P3.2 Telegram opt-in links. chat_id is the PK (one chat = one row);
    // consent_given_at NOT NULL enforces the P3.7 rule at the storage layer.
    {
      table: 'telegram_links',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS telegram_links (
        chat_id TEXT PRIMARY KEY,
        phone TEXT NOT NULL,
        tenant_id TEXT,
        consent_given_at INTEGER NOT NULL,
        linked_at INTEGER NOT NULL
      )`,
    },
    {
      table: 'telegram_links',
      column: 'idx_phone',
      sql: `CREATE INDEX IF NOT EXISTS telegram_links_phone_idx ON telegram_links(phone)`,
    },
    // P3.3 delivery ledger — written by the NotificationAdapter.
    {
      table: 'notification_log',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS notification_log (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        channel TEXT NOT NULL,
        template TEXT NOT NULL,
        ref_type TEXT,
        ref_id TEXT,
        status TEXT NOT NULL,
        error TEXT,
        created_at INTEGER NOT NULL
      )`,
    },
    {
      table: 'notification_log',
      column: 'idx_channel_created',
      sql: `CREATE INDEX IF NOT EXISTS notification_log_channel_created_idx ON notification_log(channel, created_at)`,
    },
    // P3.4 consumer identity-lite.
    {
      table: 'consumers',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS consumers (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL UNIQUE,
        name TEXT,
        consent_given_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    },
    {
      table: 'appointments',
      column: 'consumer_id',
      sql: `ALTER TABLE appointments ADD COLUMN consumer_id TEXT REFERENCES consumers(id)`,
    },
    // P3.7 deletion requests (manual fulfillment v1, logged + acked).
    {
      table: 'data_deletion_requests',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS data_deletion_requests (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'requested',
        requested_at INTEGER NOT NULL,
        fulfilled_at INTEGER,
        note TEXT
      )`,
    },
    {
      table: 'data_deletion_requests',
      column: 'idx_phone',
      sql: `CREATE INDEX IF NOT EXISTS data_deletion_requests_phone_idx ON data_deletion_requests(phone)`,
    },
    // P3.5 activation funnel events (append-only).
    {
      table: 'activation_events',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS activation_events (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        event TEXT NOT NULL,
        meta TEXT,
        created_at INTEGER NOT NULL
      )`,
    },
    {
      table: 'activation_events',
      column: 'idx_tenant_event',
      sql: `CREATE INDEX IF NOT EXISTS activation_events_tenant_event_idx ON activation_events(tenant_id, event)`,
    },
    {
      table: 'activation_events',
      column: 'idx_created',
      sql: `CREATE INDEX IF NOT EXISTS activation_events_created_idx ON activation_events(created_at)`,
    },
    // ── Phase 5 (P5.1 Loyalty-lite) ──────────────────────────────────────
    {
      table: 'loyalty_ledger',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS loyalty_ledger (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
        consumer_phone TEXT NOT NULL,
        points_delta INTEGER NOT NULL,
        reason TEXT NOT NULL,
        ref_type TEXT,
        ref_id TEXT,
        created_at INTEGER NOT NULL
      )`,
    },
    {
      table: 'loyalty_ledger',
      column: 'idx_tenant_phone',
      sql: `CREATE INDEX IF NOT EXISTS loyalty_ledger_tenant_phone_idx ON loyalty_ledger(tenant_id, consumer_phone)`,
    },
    // Idempotency: one ledger row per (tenant, phone, reason, ref).
    {
      table: 'loyalty_ledger',
      column: 'tenant_phone_ref_unique',
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS loyalty_ledger_tenant_phone_ref_unique ON loyalty_ledger(tenant_id, consumer_phone, reason, ref_id)`,
    },
    // P5.1 ACCEPTANCE (append-only): UPDATE and DELETE are rejected at the
    // storage layer — the ledger is a trust surface, not a scratch table.
    {
      table: 'loyalty_ledger',
      column: 'trg_no_update',
      sql: `CREATE TRIGGER IF NOT EXISTS loyalty_ledger_no_update BEFORE UPDATE ON loyalty_ledger BEGIN SELECT RAISE(ABORT, 'loyalty_ledger is append-only'); END`,
    },
    {
      table: 'loyalty_ledger',
      column: 'trg_no_delete',
      sql: `CREATE TRIGGER IF NOT EXISTS loyalty_ledger_no_delete BEFORE DELETE ON loyalty_ledger BEGIN SELECT RAISE(ABORT, 'loyalty_ledger is append-only'); END`,
    },
    {
      table: 'punch_cards',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS punch_cards (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
        consumer_phone TEXT NOT NULL,
        punches INTEGER NOT NULL DEFAULT 0,
        target INTEGER NOT NULL DEFAULT 5,
        reward_config TEXT,
        created_at INTEGER NOT NULL
      )`,
    },
    {
      table: 'punch_cards',
      column: 'tenant_phone_unique',
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS punch_cards_tenant_phone_unique ON punch_cards(tenant_id, consumer_phone)`,
    },
    // P3.7 marketing-consent timestamp on customer_stats (booking-time and
    // CRM-toggle capture points write it alongside marketing_opt_in).
    {
      table: 'customer_stats',
      column: 'marketing_opt_in_given_at',
      sql: `ALTER TABLE customer_stats ADD COLUMN marketing_opt_in_given_at INTEGER`,
    },
    // ── Phase 4 (P4.1 Queue-Buster) ──────────────────────────────────────
    // Audit P0.4 pre-decision: queue lives on appointment COLUMNS, never a
    // second table. Same-day scope is enforced in queries (Addis day bounds).
    {
      table: 'appointments',
      column: 'queue_position',
      sql: `ALTER TABLE appointments ADD COLUMN queue_position INTEGER`,
    },
    {
      table: 'appointments',
      column: 'queue_state',
      sql: `ALTER TABLE appointments ADD COLUMN queue_state TEXT`,
    },
    {
      table: 'appointments',
      column: 'checked_in_at',
      sql: `ALTER TABLE appointments ADD COLUMN checked_in_at INTEGER`,
    },
    {
      table: 'appointments',
      column: 'booking_source',
      sql: `ALTER TABLE appointments ADD COLUMN booking_source TEXT NOT NULL DEFAULT 'online'`,
    },
    {
      table: 'appointments',
      column: 'idx_tenant_start',
      sql: `CREATE INDEX IF NOT EXISTS appointments_tenant_start_idx ON appointments(tenant_id, start_time)`,
    },
    // ── Wayfinder #14/#19 — UGC reports + consumer blocks ─────────────────
    // (Apple 1.2 / DSA Art 16 notice-and-action + personal consumer filter.)
    {
      table: 'content_reports',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS content_reports (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES tenants(id) NOT NULL,
        reporter_phone TEXT,
        reason TEXT NOT NULL,
        details TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        resolution_note TEXT,
        created_at INTEGER NOT NULL,
        resolved_at INTEGER
      )`,
    },
    {
      table: 'content_reports',
      column: 'idx_status_created',
      sql: `CREATE INDEX IF NOT EXISTS content_reports_status_created_idx ON content_reports(status, created_at)`,
    },
    {
      table: 'consumer_blocks',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS consumer_blocks (
        id TEXT PRIMARY KEY,
        consumer_id TEXT REFERENCES consumers(id) NOT NULL,
        tenant_id TEXT REFERENCES tenants(id) NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    },
    {
      table: 'consumer_blocks',
      column: 'pair_unique',
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS consumer_blocks_pair_unique ON consumer_blocks(consumer_id, tenant_id)`,
    },
    {
      table: 'ai_usage',
      column: 'id',
      sql: `CREATE TABLE IF NOT EXISTS ai_usage (id TEXT PRIMARY KEY, tenant_id TEXT REFERENCES tenants(id) NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
    },
    {
      table: 'ai_usage',
      column: 'tenant_day_unique',
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS ai_usage_tenant_day_unique ON ai_usage(tenant_id, day)`,
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
  await backfillAppointmentOpaqueIds();
  await backfillDemoTenantFlags();

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
async function backfillAppointmentOpaqueIds(): Promise<void> {
  try {
    const driver = (db as any).session?.client ?? (db as any).$client ?? (db as any).driver;
    const client = driver ?? db;
    // Generate opaqueId for appointments that don't have one
    const sqlStmt = "UPDATE appointments " +
      "SET opaque_id = lower(hex(randomblob(8))) || '-' || lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(12))) " +
      "WHERE opaque_id IS NULL OR opaque_id = ''";
    if (client.execute) {
      await client.execute(sqlStmt);
    } else {
      await db.run((({ sql: sqlStmt } as unknown) as any));
    }
  } catch (err) {
    console.warn('[migrations] backfillAppointmentOpaqueIds skipped:', (err as Error)?.message);
  }
}

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
 * T4.5: flag the fictional/demo tenants that pre-date `is_demo`. The seed
 * marks NEW rows; this reconciles rows seeded before the column existed (and
 * any dev DB that ran an earlier `npm run seed`). Idempotent by slug match —
 * running it twice changes nothing.
 */
async function backfillDemoTenantFlags(): Promise<void> {
  try {
    if (SEED_TENANT_SLUGS.length === 0) return;
    await db.update(tenants).set({ isDemo: true }).where(inArray(tenants.slug, SEED_TENANT_SLUGS));
  } catch (err) {
    console.warn('[migrations] backfillDemoTenantFlags skipped:', (err as Error)?.message);
  }
}

/**
 * Canonicalise plan rows. Older seeds created 'Basic'/'Pro' (title-case)
 * alongside the canonical 'free'/'pro' — duplicate rows break the Pro gate
 * and the upgrade flow. This:
 *   1. ensures exactly one 'free' and one 'pro' row exist (creating the
 *      canonical row first when a fresh DB never seeded one, which fixes the
 *      "Pro plan is not configured" 500 on subscription checkout),
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

    if (!canonicalFree) await getOrCreatePlan('free');
    if (!canonicalPro) await getOrCreatePlan('pro');
  } catch (err) {
    console.warn('[migrations] normalizePlanRows skipped:', (err as Error)?.message);
  }
}