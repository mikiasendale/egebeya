# Q2 — Performance baseline + load test

- **Type:** `wayfinder:task`
- **Map:** Audit Remediation — 2026-08-27
- **Status:** open / unclaimed
- **Severity:** n/a (quality dimension)
- **Location:** new perf scripts under `tests/perf/` (or wherever)

## Question

What is the platform's performance baseline at expected load, and does it meet a launch-ready budget?

## Context

The 2026-08-01 audit recorded latency medians at low load:
- `/api/health` ~1ms
- `/api/discover` ~1ms
- `/api/public/page` ~2ms
- `/api/public/services` ~2.5ms
- `/api/public/availability` ~4ms
- authed reads ~3-4ms

These are single-request numbers, not load-test numbers. The 2026-08-27 audit marks performance 3/5 with "concurrency tests exist; no load results".

## Constraints / known considerations

- Tooling choice is in fog (autocannon, k6, custom). Resolve before claiming.
- The existing `booking-concurrency.test.ts` simulates 50 concurrent bookings — a good template.
- A "baseline" needs to define: traffic shape (booking-heavy? browse-heavy?), target concurrency, target latency, target error rate.
- Sandpack and Puck bundle weight is a separate concern (bundle-split, code-splitting).

## Open sub-questions

1. **Target load.** What is the expected concurrent-user count for the first 100 tenants?
2. **Target budget.** p50 < 100ms, p95 < 500ms, p99 < 1s? Or tighter?
3. **Tooling.** autocannon (simple), k6 (richer), custom (full control)?
4. **CI gate.** Run on every PR (slow), nightly, or on-demand?

## Suggested approach (when claiming)

1. Resolve the fog above in a small `/grilling` session.
2. Write a baseline load test script.
3. Run against a local server; capture metrics.
4. Commit the baseline numbers as `docs/perf/baseline-2026-08.md`.
5. Add CI gate if budget is set.

## Blocked by

*(none — on the frontier)*

## Blocks

- *(none — though V3 is the analogous test for rate limits)*

## Resolution

*(filled in on close)*
