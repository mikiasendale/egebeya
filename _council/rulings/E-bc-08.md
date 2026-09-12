ID: E-bc-08 (+ Fresha pair F-mp-27)
Name: Reschedule (merchant drag + client self-serve)
Surface: merchant SaaS
Category: booking-core
Class: PARTIAL (COMPARE-01 F-mp-27: client self-serve present; merchant drag/resize calendar absent — day-list only)
Fresha behaviour: Merchant drag-to-reschedule in the calendar plus client self-serve moves (features.json fb-scheduling; help-center hc/263 — OBSERVED at doc level).
Egebeya current state: Client self-serve reschedule shipped and server-validated (src/api/public.ts:1293-1369, incl. the multi-service duration bugfix); merchant side is a day-list (src/pages/Dashboard/Bookings.tsx:36-129).
Blockers: none (sequencing dependency: the E-ms-01 grid component)
Debate summary: The real clash was the verdict letter: A DEFERred even a button-reschedule to avoid forking the UX twice before the grid; C rated the merchant half GREEN-with-conditions (same conflict-checked endpoint, "never trust a client-sent endTime"); B's E-ms-01 dependency sided with A on order but not on the DEFER label. The Chair built the compromise: the merchant move ships only inside the shared-calendar bundle, as button+grid in the new calendar, never as a standalone day-list patch; drag lands later. C's payments-invariant chain test was adopted as the condition for any merchant move.
Council ruling: BUILD NEXT (inside the E-ms-01 shared-calendar bundle, Band 2; drag deferred to the grid's second slice)
Closure method (if BUILD): Scope: owner moves an appointment via button+grid in the new read-only week calendar (E-ms-01); drag later. Entity changes: none. Endpoint changes: the merchant action calls the existing conflict-checked reschedule endpoint (public.ts:1293-1369) — never a client-sent endTime; conflicts ride the same 409 path. UI changes: Dashboard calendar bundle (Bookings.tsx day-list gains the move affordance only via the grid; no standalone day-list patch). Test additions: server/tests/chain-payments-billing.test.ts — new case "rescheduling a paid booking leaves payments rows untouched" (C's CAUTION condition; the ruling moves no money but the register case pins it); booking-concurrency-style conflict cases in server/tests/booking-concurrency.test.ts.
Substitute method (if SUBSTITUTE/DEFER-with-substitute): —
Owner: Product Owner (A's fork concern decided the placement; C's GREEN-with-conditions decided the safety boundary)
Effort: M (B §1 — E-bc-08 not re-priced in the §3 audit)
Money path: NO — "the chain test records/preserves, moves no money" (Chair escalation note); register case attached as an invariant guard
Protected decision referenced (if any): COMPARE-03 #8-adjacent: effectiveAmount at booking time is ledger truth (C) — a reschedule may never re-charge or re-price.
EGE-ADVANTAGE collision (if any): None — sits beside the queue stack; queue.ts untouched.
Merchant evidence: OBSERVED-workaround — day-filtered list, zero drag/grid (Bookings.tsx:36-71; Gap.md:55); merchant calls/texts the client to self-reschedule or cancels+rebooks; on a 6" Android the day-list is usable; Day-1: n (drag is polish).
Confidence: HIGH
CEO ruling (final): Not escalated — council ruling stands.
