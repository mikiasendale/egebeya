# V4 — Red-team rerun

- **Type:** `wayfinder:task`
- **Map:** Audit Remediation — 2026-08-27
- **Status:** open / unclaimed
- **Severity:** n/a (verification)
- **Location:** `docs/security/redteam-2026-08-27.md` (output)

## Question

After all fixes ship, does the platform survive a fresh adversarial pass that attempts the original four findings *and* the new vectors the fixes might have introduced?

## Question — scope

1. Re-run the four original reproductions (F1, F2, F3, F4). All must be closed.
2. Probe new vectors introduced by the fixes:
   - F1's new payment-gated upgrade: can a forged webhook claim a Pro upgrade without payment?
   - F2's rotation: can the family-revocation logic be bypassed? What if a user has 5 devices?
   - F5's nonce CSP: can a script smuggle in via Sandpack's iframe?
   - F8's opaque tokens: can a leaked `slotToken` be replayed across tenants?
   - F11's CSV export: does the formula-injection guard hold against `=cmd|...`?
3. Probe vectors the audit marked MEDIUM/LOW but didn't fix (e.g. login CSRF, slot alignment, pending-booking TTL).

## Constraints / known considerations

- This is a final gate, not a parallel activity. V4 starts when V1, V2, V3 close.
- Scope should be sized in a `/grilling` session when V4 is claimed — the map's `Not yet specified` lists this as fog.
- Output is a written report (markdown) appended to the existing `SECURITY_AUDIT.md` or a new `docs/security/redteam-<date>.md`.

## Suggested approach (when claiming)

1. Resolve the scope fog with a `/grilling` session.
2. Run the four original reproductions; assert closed.
3. Probe the new vectors.
4. Write the report.
5. Commit the report to `security/audit-remediation` or `main` (whichever the repo convention prefers for audit docs).

## Blocked by

- V1 (Reproduce-and-close)
- V2 (Security regression suite)
- V3 (Rate-limit load test)

## Blocks

- *(none — V4 is the terminal verification)*

## Resolution

*(filled in on close)*
