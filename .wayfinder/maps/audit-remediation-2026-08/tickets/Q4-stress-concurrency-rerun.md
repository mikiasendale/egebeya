# Q4 — Stress / concurrency rerun

- **Type:** `wayfinder:task`
- **Map:** Audit Remediation — 2026-08-27
- **Status:** open / unclaimed
- **Severity:** n/a (quality dimension)
- **Location:** `server/tests/booking-concurrency.test.ts`, related

## Question

Do the platform's concurrency invariants still hold after the audit-era fixes (F1, F2, F3, F4, F9) are in place, and what new invariants need adding?

## Context

The 2026-08-01 audit verified:
- 15-way booking slot race → 1×201 + 14×409 ✅
- 5-way webhook duplicate → 1×200 + 4×500 ❌ (now fixed by F3)
- Sequential webhook replay → `{duplicate:true}` ✅

The 2026-08-27 audit marks stress 2/5 with "tests exist but no performance metrics". This ticket re-runs and extends the existing concurrency tests against the post-fix codebase.

## Constraints / known considerations

- Existing `booking-concurrency.test.ts` is the template.
- New invariants to add: F3's webhook burst (now should be N×200), F2's concurrent-refresh invariants, F9's rate-limit edge cases (under concurrency).
- Concurrency under the in-memory rate limiter + SQLite transaction model needs verification — does the limiter's race surface under burst?

## Suggested approach (when claiming)

1. Re-run the existing concurrency tests against the post-fix codebase.
2. Add F3's expected behavior to the test (N×200 with one confirm row).
3. Add a concurrent-refresh test for F2 (verify rotation under concurrency, no double-issuance).
4. Add a rate-limit edge test for F9 (concurrent requests at the limit boundary).
5. Commit to `security/audit-remediation`.

## Blocked by

*(none — on the frontier; useful in parallel with F1–F14 closure)*

## Blocks

- V4 (Red-team rerun)

## Resolution

*(filled in on close)*
