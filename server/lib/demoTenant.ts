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

let cachedDemoTenantId: string | null | undefined;

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

/** Test seam: clear the memoized id between fixtures. */
export function __resetDemoTenantCache(): void {
  cachedDemoTenantId = undefined;
}

/**
 * Drop rows belonging to the demo tenant. Rows carry `tenantId` (any shape
 * with that field qualifies); pass through untouched when there is no demo
 * tenant to exclude.
 */
export function excludeDemoRows<T extends { tenantId?: string | null }>(
  rows: T[],
  demoTenantId: string | null,
): T[] {
  if (!demoTenantId) return rows;
  return rows.filter((r) => r.tenantId !== demoTenantId);
}
