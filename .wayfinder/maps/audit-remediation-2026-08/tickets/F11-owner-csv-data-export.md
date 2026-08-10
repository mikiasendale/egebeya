# F11 — Owner CSV data export

- **Type:** `wayfinder:grilling`
- **Map:** Audit Remediation — 2026-08-27
- **Status:** open / unclaimed
- **Severity:** LOW (data export) — but **MEDIUM** if CSV formula injection from the prior audit is bundled in
- **Location:** bookings endpoints (no export route exists today)

## Question

What is the shape of the owner-facing CSV export of bookings, how is CSV-formula injection prevented, and what authorization gates the endpoint?

## Context

The 2026-08-27 audit says "no CSV export endpoint found" — i.e. data export is a missing feature for launch-readiness, not a fix to an existing route. The 2026-08-01 audit separately flagged that *if* a CSV export were added, the existing `escapeCell` does not guard against formula injection (`=`, `+`, `-`, `@` prefixes).

Owners exporting bookings is a reasonable launch feature. Doing it right means both building the export and shipping the formula-injection guard from the start.

## Constraints / known considerations

- Owner-only access (role gate). Staff should not get bulk export — too easy to exfiltrate.
- Fields to export: per the audit's mention of "name + service + time" in emails, the natural export shape is `customer_name, customer_phone, customer_email, service, staff, start_time, status, created_at`. Phone and email are PII — exporting them in CSV is a compliance touchpoint (Ethiopia's data-protection landscape is developing; conservative export is the safe default).
- The `Bookings.tsx:82` `escapeCell` is referenced in the 2026-08-01 audit — that's the *frontend* export (not a server route). The new ticket should be a *server* export so it can be authorized and audited.
- CSV injection prevention: prefix `=`, `+`, `-`, `@`, `\t`, `\r` with a leading single-quote so spreadsheet apps treat the cell as text.

## Open sub-questions

1. **Scope.** Bookings only, or also customers, services, staff? Start with bookings.
2. **PII handling.** Include phone/email in the export, or owner must opt in per export, or strip by default with an explicit "include PII" toggle?
3. **Filename pattern.** UUID-only (per F7 convention) or human-readable like `bookings-2026-08-27.csv`?
4. **Audit.** Log each export as a `security_event` (who, when, row count).
5. **Size limit.** If a tenant has 100k bookings, the export is huge. Stream it, or cap at N rows with a warning?

## Suggested approach (when claiming)

1. Run `/grilling` on the scope and PII choices with the user. **Per the map's `Notes`, the user weighs in on PII-touching features.**
2. Build a server route `GET /api/tenant/bookings/export` with role gate (`requireAuth({ roles: ['owner'] })`) and rate limiter (per F9).
3. Use a small CSV serializer (no need for a heavy library); apply formula-injection guard to every cell.
4. Stream the response for large tenants.
5. Log as `security_event: booking_export`.
6. Commit to `security/audit-remediation`.

## Blocked by

*(none — on the frontier; F9's read rate limit should be considered but is not strictly blocking)*

## Blocks

- *(none)*

## Resolution

*(filled in on close)*
