# F14 — Route booking emails to owners only

- **Type:** `wayfinder:task`
- **Map:** Audit Remediation — 2026-08-27
- **Status:** open / unclaimed
- **Severity:** LOW
- **Location:** `src/api/public.ts:606` (per 2026-08-01 audit)

## Question

How is the owner-notification mail lookup changed so the "first row" fallback in `public.ts:606` becomes an explicit `role='owner'` query?

## Context

`public.ts:606` (per 2026-08-01 audit) sends a "New Booking" notification to `users` *first row* for the tenant. That row is the owner at registration but could be a staff row if user ordering changes. The 2026-08-27 audit escalates slightly: name + service + time are in the email (no phone), so the leak is small, but the routing is fragile.

## Constraints / known considerations

- The existing pattern: tenant has exactly one owner, multiple staff. Look up by `role='owner'`.
- The booking notification email should go to *the* owner. If there are multiple owners (not currently supported but possible), pick deterministically or broadcast.
- The mailer redaction and template are unaffected; only the recipient lookup changes.

## Suggested approach (when claiming)

1. Verify the current lookup code in `public.ts:606`.
2. Replace with `SELECT email FROM users WHERE tenant_id = ? AND role = 'owner' ORDER BY created_at LIMIT 1`.
3. Add a test that asserts the recipient is the owner even when a staff user was inserted earlier.
4. Commit to `security/audit-remediation`.

## Blocked by

*(none — on the frontier)*

## Blocks

- *(none)*

## Resolution

*(filled in on close)*
