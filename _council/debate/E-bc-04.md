# Debate — E-bc-04 Group bookings
**Surface (declared per persona):** A: consumer marketplace | B: not declared per row | C: MS — ⚠ A/C declare different surfaces | D: paper-level CM+MS

## 1 · Product Owner
- Needs multi-attendee rows + capacity per slot: "new machinery (effort L)".
- **DEFER** — "nothing in the funnel needs it; single customer + N services covers the local party pattern informally".
- Cites `public.ts:755-779`. MED.

## 2 · Engineering Lead
- **L**: one appointment = one staff interval (public.ts:755-800; conflict check :902-914 assumes single block; grid :570-583 has no seat concept); per-slot capacity accounting inside the write tx or it overbooks — "a booking-core rewrite, not a form field".
- **Money: total = N×price changes `effectiveAmount` (:877) → gate case.** Crons: none. Failure: double-booked chairs, the one defect the stack cannot absorb quietly. MED.

## 3 · Council
- **AMBER-with-conditions**: one booker, N seats; rides the same BEGIN IMMEDIATE conflict transaction (public.ts:731-734, 896, 902-914); per-seat capacity is a new constraint the single-writer model does not have today.
- **Money: none** — one consumer pays effectiveAmount, prepay-only preserved (COMPARE-03 #3). Collision: NO. MEDIUM (local demand unobserved — telemetry GAP 10).

## 4 · Support/CRM
- Impact LOW-MED. frequency: UNDOCUMENTED — real in Ethiopian wedding/burial culture but "zero recorded asks — keep honest".
- Workaround: the wedding party books four back-to-back slots by phone, or one person books four times. Agent sentence: better say nothing. Day-1: **n** (phone absorbs it).

## 5 · Challenge round
**B → C:** opposite facts about the same line — B: N×price changes `effectiveAmount` (public.ts:877) and requires a money-gate case; C: "Money: none (one consumer pays effectiveAmount)". Both cite the booking-core conflict machinery (public.ts:902-914).

## 6 · Chair log
- **Agreed:** L-effort booking-core rewrite; per-seat capacity is new machinery; demand is unobserved; nothing ships this season.
- **Contested:**
  - Money semantics if ever built: B (effectiveAmount changes → gate case) vs C (none, prepay-only preserved) — both cite public.ts:877/:902-914.
  - Verdict shade: A DEFER vs C AMBER-with-conditions (buildable when demand exists).
  - Surface: A CM vs C MS.
- **Escalation:** None — deferred by all; the N×price gate-case question attaches only to a future build.
- **Closure:** CONTESTED-DEFER
