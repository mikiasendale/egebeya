ID: E-cm-07 (+ Fresha pair F-sa-118)
Name: Block clients from booking
Surface: merchant SaaS + consumer marketplace (named pair: merchant blocks; the blocked consumer learns it at booking — C's declared CM side)
Category: client-management
Class: GAP (COMPARE-01 — consumer→merchant blocks exist; the inverse is absent)
Fresha behaviour: Merchant blocks a client from booking (hc/346). KB provenance: OBSERVED.
Egebeya current state: `consumer_blocks` (schema.ts:548-555) with endpoints at src/api/trust.ts:95-152/110-152 run the OTHER direction (consumer blocks merchant); no tenant→consumer block, no check in the booking POST (public.ts:736); the shipped deterrent is force-prepay per phone (crm.ts:293-337).
Blockers: none (PDPL fairness handled by C's build conditions; no protected authority touched)
Debate summary: A wanted the mirror at top of band 2 — "small, closes the asymmetry, real owner-safety story"; B priced it S (mirror reversed + a check before the booking tx) and volunteered the honest limit: phone-keyed identity is block-evasive with a new number, so require-upfront stays the real deterrent; C's condition reshaped the scope — a blocked consumer MUST learn they're blocked at booking time with a stated reason and a platform-appeal route (a silent block is a PDPL fairness/automated-decision problem and a dark-pattern accusation the trust brand cannot afford), and C noted B's S only holds for the silent version it forbids; D rated the pain MED but day-1 n since prepay absorbs the common case. The Chair cleared it with the prepay pairing as agreed fact.
Council ruling: BUILD NEXT (top of Band 2, A's placement, with C's transparency surface in scope)
Closure method (if BUILD): Scope: tenant→consumer block, checked in the booking POST. Entity changes: `tenant_client_blocks` mirroring consumer_blocks reversed (schema.ts:548-555), tenant-scoped. Endpoint changes: block/unblock on crm/tenant side + the refusal check before the booking tx (public.ts:736). UI changes: block action on the client profile (T7.11 neighbor); booking-time refusal message in BOTH locales stating the reason + the platform-appeal route (C's transparency condition — a silent 4xx is not acceptable); appeal record lives platform-side with due process, deliberately the opposite posture of EGE-ADV #12's evidence rule (there the accused merchant must not hold evidence; here the accused IS the consumer). Stays a tenant-scoped refusal — never a platform-wide identity action. Consumer deletion anonymizes the block record (C §3 register). Tests: no chain-payments-billing case (Money NO).
Substitute method (if SUBSTITUTE/DEFER-with-substitute): n/a (BUILD NEXT). Existing partial deterrent: force-prepay on the phone (crm.ts:293-337) — keep it; the block joins it, the new-number evasion trade-off stays named (B).
Owner: Engineering Lead (appeal route with Product Owner)
Effort: S for B's mirror+check; C recorded that the transparency+appeal surface is additional scope the S did not price (unresolved effort note, recorded)
Money path: NO
Protected decision referenced (if any): none — EGE-ADV #12 is complemented, not collided (C)
EGE-ADVANTAGE collision (if any): none; #12/#13 posture is the reason transparency is mandatory
Merchant evidence: MED; OBSERVED-workaround: force-prepay flag is the only lever — "an owner who wants *never again* has no lever; they 'lose' the slot anyway" (Gap.md:171); day-1: n.
Confidence: HIGH
CEO ruling (final): Not escalated — council ruling stands (Chair: cleared; mirror + booking-POST check, tenant-scoped, prepay remains the real deterrent).
