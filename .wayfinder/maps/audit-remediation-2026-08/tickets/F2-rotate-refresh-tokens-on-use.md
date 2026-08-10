# F2 — Rotate refresh tokens on use (defeat replay)

- **Type:** `wayfinder:grilling`
- **Map:** Audit Remediation — 2026-08-27
- **Status:** open / unclaimed
- **Severity:** HIGH
- **Location:** `src/api/auth.ts`, `src/api/middleware/auth.ts`

## Question

What refresh-token rotation strategy best matches the Egebeya stack (Express 5 + Drizzle/SQLite, httpOnly cookies, single-tenant-per-user) and how is it implemented end-to-end?

## Context

Reproduced in 2026-08-01 audit: an intercepted refresh token remains valid for the full 7-day window after the legitimate user has refreshed. There is no jti/reuse tracking; only `tokenVersion` bumps on logout/reset. This violates RFC 6819 §5.2.2.3 and is the second-most serious finding in the audit.

The user table already has a `refreshTokenId` column documented as "Server-issued opaque jti" — but it's not validated on refresh. The infrastructure for rotation exists; the logic is missing.

## Constraints / known considerations

- Cookies are httpOnly, SameSite=Lax, Secure in prod. The refresh cookie path is `/api/auth/refresh`. Standard rotation pattern.
- SQLite + Drizzle — no Redis; rotation tracking must live in the DB or in a short-lived token claim (jti in JWT, validated server-side).
- Multiple devices / sessions per user must be supported (a phone refresh should not log out a laptop).
- The 7-day RT validity window is large; rotation should detect reuse within that window.
- When reuse is detected, the legitimate session family should be invalidated (this is the OAuth 2.0 BCP / RFC 6819 recommendation — replay detection → family revocation).

## Open sub-questions

1. **Rotation strategy.** Options: (a) *rotate-and-invalidate* — every refresh issues a new RT and invalidates the old one (single-device UX), (b) *family revocation* — track token family in DB; on RT reuse, kill the entire family (multi-device safe), (c) *short-lived RT + silent refresh* — 15-min RT, refresh on every API call, accept replay within 15 minutes (smallest code change).
2. **State location.** Is `refreshTokenId` in the user table sufficient (one-session model), or does the schema need a `refresh_token_families` table for multi-device?
3. **Reuse detection.** Server checks incoming RT's jti against the stored "current" jti. Mismatch → (i) issue new RT and update stored jti (just rotation), or (ii) flag as compromise and kill the family.
4. **Cookie churn.** Each rotation sets a new cookie. Acceptable, but check that logout/reset correctly clears all versions.

## Suggested approach (when claiming)

1. Run `/grilling` and `/domain-modeling` on the three open sub-questions. **The user wants to weigh in on rotation strategy per the map's `Notes`** — this is exactly the kind of architecture call that needs the human's choice.
2. Document the chosen strategy in `docs/adr/` (e.g. `0007-refresh-token-rotation.md`).
3. Schema migration if needed (a `refresh_token_families` table for multi-device; otherwise stick with `users.refreshTokenId`).
4. Middleware change: validate jti on refresh; on mismatch, apply the strategy.
5. Add tests: rotation works, replay is detected, family is killed on compromise, multi-device is preserved (if strategy supports it).
6. Commit to `security/audit-remediation`.

## Blocked by

*(none — this is on the frontier)*

## Blocks

- V1 (Reproduce-and-close the 4 reproduced findings)
- V2 (Security regression suite)
- V4 (Red-team rerun)

## Resolution

*(filled in on close)*
