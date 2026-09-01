/**
 * Demo tenant (P2.5) — the founder's in-shop closing artifact, seeded by
 * server/seed.ts under the reserved slug 'demo'.
 *
 * Exclusion contract (single source of truth for every surface):
 *   - /discover listing      → filtered in src/api/public.ts (never a "real
 *                              business" card)
 *   - activation funnel      → excluded from stage counts, north-star
 *                              numerator/denominator, and churn (the demo's
 *                              plausible bookings would flatter the
 *                              north-star the council reviews)
 *   - notification stats     → demo customers never pollute opt-in rate
 *
 * The demo tenant is NOT excluded from billing or security events — those
 * are operational records, not growth metrics.
 */

export const DEMO_TENANT_SLUG = 'demo';

/**
 * Every fictional/demo tenant slug that must be excluded from platform
 * aggregates: the reserved 'demo' slug plus the five seeded /discover tenants
 * (server/seed.ts). Single source of truth shared by the seed, the idempotent
 * migration backfill, and the admin aggregator.
 */
export const SEED_TENANT_SLUGS: string[] = [
  DEMO_TENANT_SLUG,
  'addisdental',
  'bolehair',
  'piazzapharmacy',
  'saritmedspa',
  'kazungawellness',
];

let cachedDemoTenantId: string | null | undefined;
let cachedDemoTenantIds: Set<string> | null | undefined;

/**
 * Resolve (and cache) the demo tenant's id. Returns null when no demo tenant
 * exists. Cached per process — the seed runs once at deploy time.
 */
export async function getDemoTenantId(): Promise<string | null> {
  if (cachedDemoTenantId !== undefined) return cachedDemoTenantId;
  try {
    const { db } = await import('../../src/db');
    const { tenants } = await import('../../src/db/schema');
    const { eq } = await import('drizzle-orm');
    const row = await db.select({ id: tenants.id }).from(tenants)
      .where(eq(tenants.slug, DEMO_TENANT_SLUG)).get();
    cachedDemoTenantId = row?.id ?? null;
  } catch {
    cachedDemoTenantId = null;
  }
  return cachedDemoTenantId;
}

/**
 * Resolve (and cache) the id of EVERY flagged demo/seed tenant (is_demo =
 * true). This is the structural exclusion set for admin aggregates —
 * the single mechanism that keeps fictional rows out of the metrics the
 * council reviews.
 */
export async function getDemoTenantIds(): Promise<Set<string>> {
  if (cachedDemoTenantIds !== undefined) return cachedDemoTenantIds;
  try {
    const { db } = await import('../../src/db');
    const { tenants } = await import('../../src/db/schema');
    const { eq } = await import('drizzle-orm');
    const rows = await db.select({ id: tenants.id }).from(tenants)
      .where(eq(tenants.isDemo, true)).all();
    cachedDemoTenantIds = new Set(rows.map((r) => r.id));
  } catch {
    cachedDemoTenantIds = new Set();
  }
  return cachedDemoTenantIds;
}

/** Test seam: clear the memoized ids between fixtures. */
export function __resetDemoTenantCache(): void {
  cachedDemoTenantId = undefined;
  cachedDemoTenantIds = undefined;
}

/**
 * Drop rows belonging to any flagged demo/seed tenant. Rows carry `tenantId`
 * (any shape with that field qualifies); pass through untouched when there is
 * nothing to exclude.
 */
export function excludeDemoRows<T extends { tenantId?: string | null }>(
  rows: T[],
  demoIds: Set<string> | null,
): T[] {
  if (!demoIds || demoIds.size === 0) return rows;
  return rows.filter((r) => !r.tenantId || !demoIds.has(r.tenantId));
}
