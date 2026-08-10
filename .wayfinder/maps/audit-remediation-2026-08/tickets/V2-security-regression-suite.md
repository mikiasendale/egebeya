# V2 — Security regression suite

- **Type:** `wayfinder:task`
- **Map:** Audit Remediation — 2026-08-27
- **Status:** open / unclaimed
- **Severity:** n/a (verification)
- **Location:** `server/tests/`, `tests/`

## Question

What is the full regression test suite for the security invariants the platform now asserts, and where does it live in CI?

## Question — coverage targets

1. **Auth:** refresh-token rotation works, replay is detected, family revocation on compromise, multi-device preserved (per F2 strategy), logout invalidates tokens, password reset invalidates tokens.
2. **Multi-tenant isolation:** every scoped resource rejects foreign-tenant IDs (existing `cross-tenant-isolation.test.ts` covers this — extend if F8 changed the public surface).
3. **Plan-gate:** dev trial path unreachable in production build (F1).
4. **Webhook idempotency:** burst duplicates return 200, exactly one confirm row (F3).
5. **Superadmin:** central guard rejects non-superadmin (F4).
6. **CSP:** nonce present on dashboard scripts (F5).
7. **Password policy:** weak passwords rejected (F6).
8. **Media:** no user-supplied filename in URL (F7).
9. **Public appointments:** no `id`, no `status` leak (F8).
10. **Rate limits:** limits trigger at expected threshold (F9).
11. **File upload:** magic-byte mismatch → clean 400 (F10).
12. **CSV export:** formula injection prevented, role gate enforced (F11).

## Constraints / known considerations

- Existing `cross-tenant-isolation.test.ts` and `booking-concurrency.test.ts` are good templates.
- Tests should run in CI on every PR; a failure is a release-blocker.
- The audit's verified findings are the seed list; the suite grows as F8, F9, F11 add new surfaces.

## Suggested approach (when claiming)

1. Once F1, F2, F3, F4 are closed, start the suite. V1 provides 4 of the 12 tests.
2. Add tests for F5–F11 as those tickets close.
3. Wire into CI: `bun test` (or whatever the existing runner is — check `package.json`) runs the security tests on every PR.
4. Document the suite in `server/tests/README.md` (create if not exists).

## Blocked by

- F1, F2, F3, F4 (so the tests can assert the new invariants)

## Blocks

- V4 (Red-team rerun)

## Resolution

*(filled in on close)*
