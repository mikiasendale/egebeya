ID: E-bc-04 (+ Fresha pair F-mp-23)
Name: Group bookings
Surface: consumer marketplace (C contested this as merchant SaaS; Chair recorded the dispute, ruling did not re-declare — the booking act is consumer-side)
Category: booking-core
Class: GAP (COMPARE-01 F-mp-23: one customer, N services only)
Fresha behaviour: Group/party booking with per-seat capacity (features.json fb-scheduling; help-center hc/262 — OBSERVED at doc level).
Egebeya current state: One appointment = one staff interval (src/api/public.ts:755-779; conflict check :902-914 assumes a single block; availability grid :570-583 has no seat concept).
Blockers: money (if ever built: N×price multiplies effectiveAmount — CAUTION) + design-doc dependency (locations schema, ruling 10)
Debate summary: A DEFERred ("nothing in the funnel needs it; single customer + N services covers the local party pattern informally"); D kept it honest — real in wedding/burial culture but zero recorded asks. B and C clashed on facts at the same cited lines: B says N×price changes `effectiveAmount` (public.ts:877) so the row needs a money-gate case; C says "Money: none — one consumer pays effectiveAmount, prepay-only preserved." The Chair resolved the dispute FOR B and re-flagged the row CAUTION/money-adjacent, rejecting C's prose-level "none." A/D's DEFER vs C's AMBER-with-conditions shade was the only other split.
Council ruling: DEFER
Closure method (if BUILD): — (re-entry now coupled to the locations design-doc: capacity-per-location is a multi-resource shape, and any build must carry a NEW chain-payments-billing.test.ts case asserting the N×price amount, per the Chair's resolution for B)
Substitute method (if SUBSTITUTE/DEFER-with-substitute): — (informal substitute is the existing one-customer-N-services pattern; D's agent sentence: "better say nothing")
Owner: Engineering Lead (Chair resolved the operative fact dispute — the money semantics — FOR B)
Effort: L (B §1; not re-priced in §3)
Money path: YES ⇒ CAUTION (re-flagged by the Chair: N attendees multiply effectiveAmount, public.ts:877; a future build is a gate case)
Protected decision referenced (if any): COMPARE-03 #3 prepay-only preserved (C).
EGE-ADVANTAGE collision (if any): None.
Merchant evidence: UNDOCUMENTED — zero recorded asks (Season 0); workaround: the party books four back-to-back slots by phone, or one person books four times; Day-1: n (phone absorbs it).
Confidence: MEDIUM
CEO ruling (final): Ruling 10 — re-entry now coupled to the locations design (capacity per location); the DEFER itself is the Chair's, unchanged.
