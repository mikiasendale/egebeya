# Debate — E-ds-06 Price-visible menus pre-booking
**Surface (declared per persona):** A: consumer marketplace | B: not declared per row | C: CM | D: consumer marketplace (paper-level)

## 1 · Product Owner
- Smallest unit: `fromPriceEtbCents` on the discover payload + card render (T7.13).
- **NOW** — shortlist #1 (23/24), "pure payload+card, no schema change, kills the click-away card".
- Cites `public.ts` discover payload verified HIGH (returns id/name/slug/category/city/heroImage/isNew only); COMPARE-01 F-mp-06. HIGH.

## 2 · Engineering Lead
- **S**: `MIN(services.price)` as a batched aggregate next to the booking-count join (public.ts:152-165); `/api/public/services` already exposes prices (public.ts:428-440). New columns: none; crons: none.
- Failure: "Br 0" on empty menus — render rule is null-not-zero (T7.13 discipline). Listed independent-of-everything, first-weeks-eligible. HIGH.

## 3 · Council
- **GREEN-with-conditions**: prices already render on tenant page + booking flow (public.ts:428-440); JSON-LD priceRange = Fine; ETB-only display preserved (COMPARE-03 #12).
- Condition: card price must be the *starting* price honestly (min over active services), "not a promo bait that then recomputes at checkout via quiet-hours (public.ts:847-864)". Collision: NO. HIGH.

## 4 · Support/CRM
- Impact HIGH (consumer side). frequency: OBSERVED-workaround — payload lacks price (public.ts:175-192); the caller phones to ask the price.
- Workaround: consumers treat the directory as "a brochure, not a shop with prices" and bounce to asking the owner (§4). Day-1 notice: **y** — changes what /discover prints.

## 5 · Challenge round
No challenges. B's null-not-zero rule and C's min-over-active-services condition reinforce A's NOW; D rates it the highest-impact consumer row.

## 6 · Chair log
- **Agreed:** ship now (S / NOW / GREEN / HIGH) as a batched min-price read on the existing discover join, ETB-only, honest starting price, no money semantics changed.
- **Contested:** None.
- **Escalation:** None.
- **Closure:** CLEARED
