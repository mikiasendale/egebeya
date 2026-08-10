# V3 — Rate-limit load test

- **Type:** `wayfinder:task`
- **Map:** Audit Remediation — 2026-08-27
- **Status:** open / unclaimed
- **Severity:** n/a (verification)
- **Location:** new load test script under `tests/load/` (or wherever existing perf tests live)

## Question

Does the dashboard read rate limit (F9) actually trigger at the configured threshold under concurrent load, and does it not trigger under realistic user load?

## Constraints / known considerations

- Tooling choice is in fog (k6 vs autocannon vs custom). Resolve before claiming.
- Test against a running server (`npx tsx server.ts`) with `NODE_ENV=production` to exercise the real limiter.
- Two scenarios: (a) burst over the limit, expect 429; (b) realistic dashboard load (50 pages × 10 reads each), expect 0×429.
- The existing `booking-concurrency.test.ts` simulates 50 concurrent bookings — a good template.

## Suggested approach (when claiming)

1. Resolve the tooling fog (small `/grilling` or just pick `autocannon` for simplicity).
2. Write two scenarios: burst over limit, realistic load.
3. Run against a local server; assert both scenarios behave as expected.
4. Add to CI as a non-blocking job (or a scheduled job — full load is expensive per-PR).

## Blocked by

- F9 (Dashboard read rate limit) — the limit must be defined before it can be measured.

## Blocks

- V4 (Red-team rerun) — V4's rate-limit evasion probe is meaningful only after V3 proves the limits hold.

## Resolution

*(filled in on close)*
