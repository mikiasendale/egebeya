# V1 — Reproduce-and-close the 4 reproduced findings

- **Type:** `wayfinder:task`
- **Map:** Audit Remediation — 2026-08-27
- **Status:** open / unclaimed
- **Severity:** n/a (this is verification)
- **Location:** reproductions live in `server/tests/` once written; original findings documented in `SECURITY_AUDIT.md`

## Question

For each of the four reproduced CRITICAL/HIGH findings (F1, F2, F3, F4), is the original attack now blocked, and is the regression test in place?

## Question — per-finding

1. **F1 — Pro upgrade bypass:** does the dev path return 404 (or payment-required) in a production build?
2. **F2 — Refresh-token replay:** does the second use of a rotated refresh token fail, and does the family get killed on detected reuse (per F2's chosen strategy)?
3. **F3 — Webhook race:** does a burst of N identical webhooks return N×200 with exactly one confirm row?
4. **F4 — Superadmin guard:** does a non-superadmin user get 403 on a representative admin endpoint?

## Constraints / known considerations

- V1 is *post-fix* verification. Do not claim until F1, F2, F3, F4 are all closed.
- The reproductions are *tests*, not exploits — they live in the test suite.
- Each reproduction should be a permanent regression test (so V2 can collect them).

## Suggested approach (when claiming)

1. Once F1, F2, F3, F4 are closed, run the original reproduction steps from `SECURITY_AUDIT.md` §5.1–5.4 and the 2026-08-27 audit's evidence.
2. Convert each reproduction into a Playwright or supertest-based test.
3. Commit each test alongside the fix it verifies (already done) or as a follow-up commit.
4. Mark V1 closed with a one-line summary per finding.

## Blocked by

- F1 (Lock unauthenticated Pro upgrade path)
- F2 (Rotate refresh tokens on use)
- F3 (Atomic webhook idempotency)
- F4 (Centralize superadmin guard)

## Blocks

- V4 (Red-team rerun)

## Resolution

*(filled in on close)*
