# F4 — Centralize the superadmin guard

- **Type:** `wayfinder:task`
- **Map:** Audit Remediation — 2026-08-27
- **Status:** open / unclaimed
- **Severity:** HIGH
- **Location:** `src/api/admin.ts`

## Question

How is the superadmin authorization check centralized so it cannot be bypassed by a route that forgets to add it inline?

## Context

The 2026-08-27 audit reports that admin routes mount without an explicit superadmin guard — internal checks exist per route, but there is no centralized middleware that gates the entire `/api/admin` mount. The risk: a future route added to the mount inherits the missing check by default.

Note from the 2026-08-01 audit: per-request superadmin is *correctly* enforced (`users.isSuperadmin` is checked server-side; the JWT `role` claim is not trusted). This ticket is about reducing the surface area where that check could be forgotten, not about fixing a currently-broken check.

## Constraints / known considerations

- Existing pattern: `router.use(requireAuth({ roles: ['owner'] }))` for dashboard routes. Mirror this for admin.
- Existing helper: there is likely a `requireSuperadmin` or similar; verify it exists and is in `server/middleware/`.
- Auth middleware already runs on the cookie/JWT, so the superadmin check is a *role* gate, not a session gate.
- Must not break any existing admin route. This is a refactor with no behavior change for valid admins.

## Suggested approach (when claiming)

1. Run `/grilling` only if the existing `requireSuperadmin` helper doesn't exist or its location is unclear.
2. Add `router.use(requireSuperadmin)` at the top of the admin router (one line).
3. Audit each admin route handler: if any has its own superadmin check inline, leave it (defense-in-depth) but note the duplication.
4. Add a test that asserts a non-superadmin user gets 403 on at least one representative admin endpoint.
5. Commit to `security/audit-remediation`.

## Blocked by

*(none — this is on the frontier)*

## Blocks

- V1 (Reproduce-and-close the 4 reproduced findings)
- V2 (Security regression suite)
- V4 (Red-team rerun)

## Resolution

*(filled in on close)*
