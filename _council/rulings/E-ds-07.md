ID: E-ds-07 (+ Fresha pair F-mp-07)
Name: Same-day availability surfacing
Surface: consumer marketplace
Category: discovery-search
Class: GAP (COMPARE-01 F-mp-07: availability computed but never surfaced in listings)
Fresha behaviour: Listings/venue pages surface same-day availability signals in bt-city copy (COMPARE-01 F-mp-07 — OBSERVED).
Egebeya current state: Availability computed per staff+day (src/api/public.ts:477-591) but never printed in the directory (PublicBooking.tsx:765-829); closures are enforced at read (public.ts:508-522) against a table nobody can write.
Blockers: none (sequencing fact: E-ms-03 closures writer / T7.6 must land first)
Debate summary: A called it "the same diff as E-ds-06" (S energy, shipping NOW above E-ms-03 in A's band order). B re-priced it M and made closures a hard dependency: without a write path, "open today" actively lies on closed dates (public.ts:508-522 enforces closures nobody can author). C accepted the row with conditions — bounded/cached reads, all day-math on fixed Addis UTC+3 (EGE-ADV #8). D supplied the kill condition: one wrong "space today" badge burns the directory's one asset (FSD-002:77-79). Chair ordered the build after T7.6, batched per request, no cache.
Council ruling: BUILD NEXT (ordered AFTER T7.6 / E-ms-03 closures writer; Band 1 position kept)
Closure method (if BUILD): Scope: `openToday` boolean on the discover payload computed batched per request (no cache — Chair), respecting tenant_closures and the UTC+3 day math. Entity changes: none. Endpoint changes: /api/public/discover response gains one field; one bounded rollup query per request beside the existing count join. UI changes: "opens today" badge on Discover.tsx cards. Test additions: server/tests/discover.test.ts — new cases "closed-today tenant never shows openToday", "openToday matches generator output", "batch rollup issues one query, not N".
Substitute method (if SUBSTITUTE/DEFER-with-substitute): —
Owner: Product Owner (builds A's unit) — correctness ordering owned by Engineering Lead (B's dependency finding and D's kill condition forced the after-T7.6 order)
Effort: M (B §3 audit discipline; audit row for E-ds-07 not separately re-priced — §1 M governs)
Money path: NO
Protected decision referenced (if any): EGE-ADV #8 — day math on fixed Addis UTC+3 (server/lib/timezone.ts:1).
EGE-ADVANTAGE collision (if any): None — the walk-in queue board (QueueStatus.tsx) remains the physical-line surface; this badge sits beside it.
Merchant evidence: OBSERVED-workaround — computed-but-never-surfaced; consumers book tomorrow because they cannot see today, and walk-ins use the queue board instead; Day-1: y.
Confidence: MEDIUM
CEO ruling (final): Not escalated — council ruling stands.
