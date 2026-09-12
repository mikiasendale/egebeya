ID: E-ds-05 (+ Fresha pair F-mp-05)
Name: Aggregate rating display
Surface: consumer marketplace
Category: discovery-search
Class: GAP (COMPARE-01 F-mp-05: no reviews/ratings table to aggregate)
Fresha behaviour: Aggregate ratings printed on listings/venue pages with review schema markup (COMPARE-01 F-mp-05: bt-city meta paragraphs, schema/*.json — OBSERVED).
Egebeya current state: No reviews table in src/db/schema.ts (OBSERVED schema scan); directory prints the NEW badge + "No bookings yet" (src/api/public.ts:178-186; Discover.tsx:245-252).
Blockers: none (hard feature dependency: E-mg-05 reviews entity)
Debate summary: No challenges were raised. A DEFERred strictly behind E-mg-05 ("nothing to display until that table exists"); B priced display+avg as S once a reviews table exists, citing the proven batched-count join at public.ts:147-165, and named the rushed failure as fake ratings. C blocked the row as AMBER-on-dependency with display conditions (score + volume printed together; demo tenants excluded via server/lib/demoTenant.ts:63-95). D defended the honesty of the current NEW badge and warned a rating at n=3 is worse than none.
Council ruling: DEFER
Closure method (if BUILD): —
Substitute method (if SUBSTITUTE/DEFER-with-substitute): The NEW badge + "No bookings yet" (public.ts:178-186) remains the honest signal until E-mg-05 ships; trade-off: consumers get no aggregate trust proof and keep misreading absence (D's Day-1: y).
Owner: Product Owner (A's strict-defer sequencing framing carried; all four agreed)
Effort: M (B §1; display itself S once the entity exists)
Money path: NO
Protected decision referenced (if any): —
EGE-ADVANTAGE collision (if any): None (inherits E-mg-05's UGC duties when it lands).
Merchant evidence: UNDOCUMENTED — trust travels by Telegram word-of-mouth in a one-reputation market; Day-1: y (consumers misread absence).
Confidence: HIGH
CEO ruling (final): Not escalated — council ruling stands.
