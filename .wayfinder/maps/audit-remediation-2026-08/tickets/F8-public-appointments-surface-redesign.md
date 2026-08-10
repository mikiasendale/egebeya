# F8 — Public appointments surface redesign

- **Type:** `wayfinder:prototype`
- **Map:** Audit Remediation — 2026-08-27
- **Status:** open / unclaimed
- **Severity:** MEDIUM
- **Location:** `src/api/public.ts` — `/api/public/appointments`

## Question

What does the public appointments surface look like after the UUID/status leak is fixed, while preserving the legitimate use case (letting customers see availability)?

## Context

`/api/public/appointments` (no auth required) returns `id` (UUID), `startTime`, `status`, `serviceName` for the whole day. It leaks appointment UUIDs (an attacker can use them to phone-verify bookings they don't own) and reveals `status` (free/booked/confirmed) which can be used to learn when a slot is *almost* booked.

The audit's stated design intent is "public availability". The leak is that UUIDs and `status` are returned when only the availability grid is needed.

## Constraints / known considerations

- The endpoint exists for a real reason: customer-side availability lookup before booking.
- Phone verification on booking already requires both `id` and `phone` to retrieve; the leak is reconnaissance, not direct takeover.
- Returning just `startTime` (no `status`, no `id`) makes the endpoint a true availability grid.
- A status-aware but UUID-opaque option: return `startTime` and an opaque `slotToken` for each free slot that the customer can use to start a booking. Verification happens server-side via a separate lookup.

## Open sub-questions

1. **Response shape.** Options: (a) minimal — only `startTime` for free slots, (b) opaque tokens — `startTime` + opaque per-slot `slotToken` (server validates token on booking), (c) hide endpoint entirely behind a per-tenant public-token, (d) rate-limit + redact `id` but keep `status`.
2. **Status exposure.** Does the booking form need to know if a slot is *pending* (held by an unfinished booking) to prevent showing it as available? Probably yes — pending slots should not appear free. A short-TTL "hold" table can express this without leaking the underlying booking.
3. **Backwards compat.** Is this endpoint consumed by any frontend today? The customer-facing booking flow likely uses it.

## Suggested approach (when claiming)

1. Run `/prototype` to sketch the response shape — get a concrete artifact before locking the design.
2. Run `/grilling` on the chosen shape with the user. **Per the map's `Notes`, the user weighs in on product-surface changes.**
3. Implement: change the route's response; add a hold mechanism if option (b) is chosen.
4. Test: assert no `id` is in the response; assert pending slots do not appear as free.
5. Commit to `security/audit-remediation`.

## Blocked by

*(none — on the frontier)*

## Blocks

- V2 (Security regression suite)
- V4 (Red-team rerun)

## Resolution

*(filled in on close)*
