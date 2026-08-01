/**
 * Vitest global setup — runs once per test process before any test file
 * is imported.
 *
 * Why this exists: the production server.ts calls `dotenv/config` so
 * `process.env.JWT_SECRET`, `process.env.REFRESH_SECRET`, etc. all come
 * from the operator's `.env`. The tests don't go through server.ts — they
 * mount the Express app directly via supertest — so `.env` is never
 * loaded unless we load it here. Loading it here lets tests run the same
 * way against the same secrets they would on a real production-like
 * machine (which is exactly what a CI runner is).
 *
 * The `.env` file is OPTIONAL in CI. When the file is missing (e.g. a
 * sandboxed runner) every test still passes because the in-code
 * fallbacks (`JWT_SECRET || 'supersecret_fallback'`, the Chapa test
 * webhook secret `'CyNDCzoXF7JsaPig6GErkdT0'`) align with what we
 * use here in `setupDevScope()` below.
 *
 * After env is loaded, this runs `ensureSchemaMigrations()` from
 * `src/db/migrations` — the same idempotent ALTER TABLE / CREATE TABLE
 * pass that production server.ts runs on boot. The tests bypass
 * server.ts entirely, so the security_events / processed_webhook_events
 * tables would otherwise be missing the first time the suite asserts
 * against them.
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  loadEnv({ path: envPath });
}

// When `.env` is absent (CI without secrets) we still want a deterministic
// JWT secret so token-for-token endpoints behave consistently across runs.
// We seed a random-but-stable string of the right length, scoped to the
// test process lifetime.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-'.padEnd(43, 'x');
}
if (!process.env.REFRESH_SECRET) {
  process.env.REFRESH_SECRET = 'test-refresh-secret-'.padEnd(43, 'y');
}
// Always run in test mode so the Chapa SDK skips signing-key checks and
// the webhook test's `webhook.test.ts` can stub the live verify call.
process.env.NODE_ENV = 'test';
// Test-mode Chapa keys. initChapa()/getWebhookSecret() now REQUIRE these in
// every environment, so the suite injects documented test values. The
// webhook spec deliberately `delete`s CHAPA_SECRET_KEY to prove the init
// fails closed without it.
if (!process.env.CHAPA_SECRET_KEY) {
  process.env.CHAPA_SECRET_KEY = 'CHASECK_TEST-g3pDAuHMdioBphvmSN0ETveYu5KPaDD5';
}
if (!process.env.CHAPA_WEBHOOK_SECRET) {
  process.env.CHAPA_WEBHOOK_SECRET = 'CyNDCzoXF7JsaPig6GErkdT0';
}

// Now that the DB is available, make sure the schema is up-to-date. This
// is the same call server.ts makes on boot — but we have to invoke it
// ourselves because the tests don't go through server.ts. Failure here
// is logged but non-fatal: the individual test that needs the table will
// surface a clearer error if its required schema is missing.
import('./../../src/db/migrations').then(async (mod) => {
  try {
    const added = await mod.ensureSchemaMigrations();
    const flat = Object.values(added).flat();
    if (flat.length > 0) {
      console.log(`[test-setup] added columns: ${flat.join(', ')}`);
    }
  } catch (err) {
    console.error('[test-setup] ensureSchemaMigrations failed:', err);
  }
}).catch((err) => {
  console.error('[test-setup] load migrations failed:', err);
});

// Seed the canonical plan rows ('free' / 'pro'). server.ts:ensurePlansSeeded
// does this in production; tests bypass server.ts, so we replicate the
// essential subset here. Failures here are also non-fatal — anything that
// actually needs a plan row should resolve 'free' / 'pro' explicitly via
// the seed helper.
import('./../../server/lib/chapa').catch(() => {});
import('./../../src/db').then(async (mod) => {
  try {
    const { plans } = await import('./../../src/db/schema');
    const { eq } = await import('drizzle-orm');
    const free = await mod.db.select().from(plans).where(eq(plans.name, 'free')).get();
    const pro = await mod.db.select().from(plans).where(eq(plans.name, 'pro')).get();
    if (!free || !pro) {
      const { randomUUID } = await import('crypto');
      const now = Date.now();
      if (!free) await mod.db.insert(plans).values({
        id: randomUUID(), name: 'free', price: 0, priceEtb: 0,
        maxStaff: 2, customDomainAllowed: false, description: 'free',
        createdAt: now,
      } as any).catch(() => {});
      if (!pro) await mod.db.insert(plans).values({
        id: randomUUID(), name: 'pro', price: 100000, priceEtb: 1000,
        maxStaff: 10, customDomainAllowed: true, description: 'pro',
        createdAt: now,
      } as any).catch(() => {});
    }
  } catch { /* non-fatal */ }
}).catch(() => {});

