# F9 — Dashboard read rate limit

- **Type:** `wayfinder:grilling`
- **Map:** Audit Remediation — 2026-08-27
- **Status:** open / unclaimed
- **Severity:** MEDIUM
- **Location:** `server/middleware/rateLimiter.ts`

## Question

What is the dashboard read rate limit (window, max) per IP+tenant, and which routes does it cover?

## Context

`server/middleware/rateLimiter.ts` already defines a tenant-write limiter (10min / 200 req per IP+tenant). Dashboard reads (e.g. `GET /api/tenant/services`, `GET /api/tenant/bookings`, `GET /api/tenant/settings`) are unprotected. An authenticated attacker can scrape the tenant's data plane at request speed.

The audit's existing rate-limit table has Auth (15m / 10), Discover (1m / 60), Webhook (1m / 60), and Tenant Write (10m / 200). Reads are missing.

## Constraints / known considerations

- The rate limiter is in-memory keyed on `IP+tenant`. `app.set('trust proxy', …)` is set in production per the audit (per a prior fix), so IP is real.
- Read traffic has different shape from write traffic: legitimate users hit many reads in burst (loading a dashboard page issues many GETs).
- The limit must not break legitimate dashboards (Puck/Sandpack pages make many parallel GETs on load).
- Discovery (`/api/discover`) is already rate-limited separately — that pattern can be mirrored for dashboard reads.

## Open sub-questions

1. **Window and max.** Options: (a) 1min / 300 req per IP+tenant (generous for legitimate dashboard loaders), (b) 1min / 120 req per IP+tenant (matches Discover), (c) 10min / 2000 req per IP+tenant, (d) per-endpoint tuned (e.g. listing endpoints 60/min, settings 30/min).
2. **Coverage.** All dashboard reads, or just the most data-heavy ones (bookings list, services list)?
3. **Response on limit.** 429 with `Retry-After`; the existing limiter pattern should be reused.

## Suggested approach (when claiming)

1. Run `/grilling` on the window/max choice. Numbers are a product decision; the user weighs in per the map's `Notes`.
2. Reuse the existing limiter pattern; just add a new limiter for dashboard reads.
3. Mount on `/api/tenant/*` GETs (excluding the few that already have their own limits).
4. Add a load test that asserts the limiter triggers at the right threshold.
5. Commit to `security/audit-remediation`.

## Blocked by

*(none — on the frontier)*

## Blocks

- V3 (Rate-limit load test) — V3 needs the limit defined before it can be measured.

## Resolution

*(filled in on close)*
