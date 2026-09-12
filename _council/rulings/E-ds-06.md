ID: E-ds-06 (+ Fresha pair F-mp-06)
Name: Price-visible menus pre-booking
Surface: consumer marketplace
Category: discovery-search
Class: PARTIAL (COMPARE-01 F-mp-06: prices on tenant page + booking flow, not on directory cards; no JSON-LD)
Fresha behaviour: Cards show "from" prices with priceRange structured data on bt-city listings (COMPARE-01 F-mp-06 — OBSERVED).
Egebeya current state: Discover payload carries id/name/slug/category/city/heroImage/isNew only (src/api/public.ts:175-192); prices exposed at public.ts:428-440 and rendered in the booking flow (PublicBooking.tsx:516-548).
Blockers: none
Debate summary: No challenges — the rare unanimous GREEN. A ranked it shortlist #1 (23/24), "pure payload+card, kills the click-away card"; B priced it S as a batched MIN(services.price) next to the existing booking-count join with zero schema change; C conditioned the card price on being the honest starting price (min over active services), not promo bait that recomputes at quiet-hours; D rated it the highest-impact consumer row (callers phone to ask price today).
Council ruling: BUILD NOW
Closure method (if BUILD): Scope: batched `MIN(services.price)` over ACTIVE services into the discover payload as `fromPriceEtbCents` (T7.13) + card render + JSON-LD priceRange. Entity changes: none. Endpoint changes: /api/public/discover response gains one field (join beside public.ts:152-165). UI changes: Discover.tsx card price row, null-not-zero (no "Br 0" on empty menus), ETB-only display preserved. Test additions: server/tests/discover.test.ts — new cases "card price equals min active-service price" and "empty menu renders null, never zero".
Substitute method (if SUBSTITUTE/DEFER-with-substitute): —
Owner: Product Owner (A's unit, uncontested; B's seam citation executes it)
Effort: S (B §1)
Money path: NO (display only; effectiveAmount at public.ts:877 untouched)
Protected decision referenced (if any): COMPARE-03 #12 ETB-only display preserved.
EGE-ADVANTAGE collision (if any): None.
Merchant evidence: OBSERVED-workaround — the payload lacks price (public.ts:175-192); consumers treat the directory as "a brochure, not a shop" and phone the owner; Day-1: y (changes what /discover prints).
Confidence: HIGH
CEO ruling (final): Not escalated — council ruling stands.
