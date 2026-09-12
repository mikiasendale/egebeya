# Debate — E-bc-08 Reschedule (merchant drag + client self-serve)
**Surface (declared per persona):** A: merchant SaaS | B: not declared per row | C: MS | D: paper-level CM+MS

## 1 · Product Owner
- Client self-serve is shipped (`public.ts:1293` verified HIGH in repo-map). Smallest remaining unit: owner moves an appointment via the detail sheet (no drag).
- **DEFER** — "drag arrives with the E-ms-01 grid; a button-reschedule now would fork the UX twice".
- Cites COMPARE-01 F-mp-27. HIGH.

## 2 · Engineering Lead
- **M**: client self-serve exists (public.ts:1293-1369, including the multi-service duration bugfix); merchant side is a day-list (Bookings.tsx:36-129); work is a calendar grid + drag → same endpoint.
- Crons: none. Failure: drag conflicts must hit the same 409 path. Dep: E-ms-01 grid component. HIGH.

## 3 · Council
- **GREEN-with-conditions**: self-serve path already validates server-side (public.ts:1293-1369, OBSERVED); drag must call the same conflict-checked endpoint, never trust a client-sent endTime.
- Condition: reschedule of a *paid* booking must not re-charge or re-price — effectiveAmount at booking time is ledger truth. **Money-path CAUTION**: add a chain test that reschedule leaves payments rows untouched. Collision: NO. HIGH.

## 4 · Support/CRM
- Impact MED (HIGH for the drag half's absence). frequency: OBSERVED-workaround — day-filtered list, zero drag/grid (Bookings.tsx:36-71, select dropdown per row :218-229; Gap.md:55).
- Workaround: merchant calls/texts the client to self-reschedule, or cancels and re-books; on a 6" Android the day-list is *usable* — "this is why I won't call it HIGH". Day-1: **n** (drag is polish).

## 5 · Challenge round
**C → A:** C rates the merchant half GREEN-with-conditions (same endpoint + one chain test, public.ts:1293-1369); A DEFERs even a button-reschedule to avoid forking the UX twice (A: E-ms-01 sequencing | C: "never trust a client-sent endTime" makes any surface safe today). B's dep (E-ms-01 grid) sides with A on order but not on A's DEFER label.

## 6 · Chair log
- **Agreed:** client self-serve done; drag/grid lands with E-ms-01; any merchant move must reuse the conflict-checked endpoint; paid-booking reschedule must not touch payments (C's CAUTION chain test).
- **Contested:** verdict — A DEFER vs B M-depends vs C GREEN-with-conditions (build now on the existing endpoint).
- **Escalation:** None — the chain test records/preserves, moves no money (money register: E-bc-08 absent; C: "payments rows untouched").
- **Closure:** CONTESTED-DEFER
