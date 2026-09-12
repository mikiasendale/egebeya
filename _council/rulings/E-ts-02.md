ID: E-ts-02 (+ Fresha pair F-mp-281)
Name: Report / reply to reviews (moderation)
Surface: consumer marketplace + platform (named pair; A/C declare CM+PL — reporting and moderation are marketplace/platform acts; D's merchant-SaaS tag recorded as a flag; the merchant-reply half becomes MS when reviews exist)
Category: trust-safety
Class: GAP (COMPARE-01:124, :323)
Fresha behaviour: Consumers report reviews; merchants reply; platform moderates the queue. (OBSERVED — hc/104096.)
Egebeya current state: No reviews table at all — there is literally nothing to report or reply to (src/db/schema.ts, verified HIGH); the shipped trust surface is consumer→platform report-a-merchant with evidence held off tenant storage (src/api/trust.ts:43-84; admin.ts:512-568 PATCH queue).
Blockers: sequenced — pure dependency-block behind E-mg-05 (no reviews entity exists).
Debate summary: Unanimous DEFER, Chair-logged CLEARED with no contest: A — nothing to report; B — M after E-mg-05, and content_reports + the admin PATCH queue are the moderation pattern to copy; C AMBER dependency-blocked — sequence after E-mg-05 and inherit its duties (platform holds report evidence away from the accused merchant per EGE-ADV #12, with a stated SLA like the existing 7-day path, trust.ts:75-79); D — "keep our consumer→platform reporting, don't clone the review-moderation product before reviews exist." No challenge round fired; every position routes through the missing reviews entity.
Council ruling: DEFER behind E-mg-05 (re-entry automatic once the reviews entity ships at the head of Band 3).
Closure method (if BUILD): N/A — DEFER; re-entry shape recorded by B/C: copy the content_reports pattern onto reviews, merchant reply thread, platform PATCH queue, stated SLA.
Substitute method (if any): none invented beyond the honest present — the shipped EGE-ADVANTAGE #12 path (consumer reports a merchant to the platform) continues to carry all trust moderation until reviews exist.
Owner: Product Owner (sequencing) / Engineering Lead (the build when reviews land)
Effort: M (B)
Money path: NO
Protected decision referenced (if any): none; EGE-ADV #12 (consumer report-a-merchant, evidence off tenant storage) is the pattern to preserve, not reopen.
EGE-ADVANTAGE collision (if any): collision avoided, not created — C: do not clone Fresha's review-moderation surface in a way that dilutes the report-a-merchant advantage.
Merchant evidence: structurally N/A (D — no reviews exist to moderate); frequency UNDOCUMENTED.
Confidence: HIGH
CEO ruling (final): Not escalated — council ruling stands.
