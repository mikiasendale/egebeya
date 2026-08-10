# F6 — Tenant password policy

- **Type:** `wayfinder:grilling`
- **Map:** Audit Remediation — 2026-08-27
- **Status:** open / unclaimed
- **Severity:** MEDIUM
- **Location:** auth endpoints, password reset

## Question

What password policy is enforced for tenant accounts, and how is it balanced against Ethiopian user friction (mobile-first, Amharic keyboard, low-bandwidth contexts)?

## Context

Neither audit found a password policy. bcrypt cost is 10 (acceptable). The auth surface accepts any-length password and lets the user pick.

The user base is Ethiopian — many signups are via mobile, some from shared devices, some on low-end networks. A strict policy (12+ chars, mixed case, symbols, no common words) will block more legitimate users than it blocks attackers. A loose policy (8+ chars) barely helps.

## Constraints / known considerations

- bcrypt cost 10 is fine; raising it doesn't help against replay (F2) or weak passwords.
- The audit rate this as LOW; the 2026-08-27 audit escalates to MEDIUM because of the refresh-token replay (F2) — once F2 closes, weak passwords become a more attractive vector.
- zxcvbn is a popular library; adds ~100KB to the bundle. Trade-off: ship on the server side only (don't ship to the client).
- The signup form has no client-side strength meter today — adding one changes UX and is a sub-decision.
- Password reset emails go via the existing mailer; no change needed there.

## Open sub-questions

1. **Policy shape.** Options: (a) NIST-style: min 8 chars, no max, screen against a top-1000 list, (b) zxcvbn score ≥ 3, (c) simple rules: min 8, must contain digit or symbol, (d) length-only: min 12.
2. **Server vs client enforcement.** Server is mandatory (the audit's concern); client strength meter is a UX nicety — separate sub-decision.
3. **Migration.** Do existing weak passwords get grandfathered (yes, almost certainly), or do users get prompted to reset on next login?
4. **Logging.** Does the audit log reject a too-weak signup as a `security_event`? (Probably yes at low severity.)

## Suggested approach (when claiming)

1. Run `/grilling` on the policy shape with the user. **Per the map's `Notes`, the user weighs in on UX-touching decisions.**
2. Server-side implementation in `server/middleware/auth.ts` (or wherever password validation lives).
3. If zxcvbn is chosen: install on server only; do not import in the client bundle.
4. Migrate existing users gracefully (grandfather; prompt on next login).
5. Commit to `security/audit-remediation`.

## Blocked by

*(none — on the frontier; consider waiting on F2 so the policy is designed with the new auth posture in mind)*

## Blocks

- V2 (Security regression suite)

## Resolution

*(filled in on close)*
