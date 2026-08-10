# F3 — Atomic webhook idempotency

- **Type:** `wayfinder:grilling`
- **Map:** Audit Remediation — 2026-08-27
- **Status:** open / unclaimed
- **Severity:** HIGH
- **Location:** `src/api/payments.ts:130` (per 2026-08-01 audit), `src/api/payments.ts:120-180` (per 2026-08-27 audit)

## Question

How is webhook idempotency made atomic at the SQL layer so concurrent duplicates no longer return 500 to Chapa (and to avoid the unique-constraint collision surfacing to the caller)?

## Context

Reproduced in 2026-08-01 audit: 5 identical signed webhooks fired concurrently → 1×200 + 4×500 (`{"error":"Failed to process webhook"}`). Root cause: the code checks for the existing row, then inserts; in the gap, another request also passes the check and inserts, hitting the `UNIQUE(provider, event_id)` constraint. The catch block looks for `err.code` but Drizzle wraps SQLite errors with `code` on `err.cause.code`, so the constraint collision is misclassified as a generic error.

Idempotency holds (exactly one confirm row, no double-charge), but every Chapa retry burst is a 500 → alert noise and a real risk of upstream retry storms.

## Constraints / known considerations

- SQLite/libsql — `INSERT … ON CONFLICT` is supported (SQLite ≥ 3.24, libsql compatible).
- Drizzle's error wrapping nests the SQLite code under `err.cause.code`. Two valid fixes: (a) unwrap and match, (b) make the insert atomic and treat the row existence as success regardless of error source.
- The current code path uses `db.insert(...).values(...).run()` after a separate `db.select(...).get()`. Both round-trips can be collapsed.
- The webhooks handler must remain correct under: (i) burst of identical events, (ii) sequential duplicates, (iii) out-of-order events, (iv) the unique-constraint collision itself.

## Open sub-questions

1. **Atomic insert pattern.** Options: (a) `INSERT OR IGNORE INTO processed_webhook_events …` then `SELECT` to check if it was a new row, (b) Drizzle's `onConflictDoNothing()` returning the affected-row count, (c) wrap the whole handler in a transaction with `BEGIN IMMEDIATE`, (d) match `err.cause?.code === 'SQLITE_CONSTRAINT_UNIQUE'` and treat as duplicate.
2. **Return shape.** Does a duplicate webhook return `{success: true, duplicate: true}` (current intent), or just `200 OK` with no body?
3. **Logging.** How loud should a duplicate-webhook event be? Currently logged as 500 (bad); should be logged at `info` or `warn` level as `webhook_duplicate`.

## Suggested approach (when claiming)

1. Run `/grilling` on the atomic-insert pattern choice. Pick the option that keeps the failure surface smallest (probably (a) or (b)).
2. Unify the check-and-insert into one round-trip; remove the second `db.select` after insert if Drizzle's `returning()` covers it.
3. Add the `err.cause?.code` fallback to the catch block as a defense-in-depth, even after adopting an atomic insert.
4. Test: write a concurrency test that fires N identical webhooks and asserts N×200 with exactly one confirm row.
5. Commit to `security/audit-remediation`.

## Blocked by

*(none — this is on the frontier)*

## Blocks

- V1 (Reproduce-and-close the 4 reproduced findings)
- V2 (Security regression suite)
- V4 (Red-team rerun)

## Resolution

*(filled in on close)*
