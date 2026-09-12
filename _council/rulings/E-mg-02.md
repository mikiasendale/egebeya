ID: E-mg-02 (+ Fresha pair F-sa-131)
Name: Deals & promotions
Surface: merchant SaaS (A/C/D declared; no clash)
Category: marketing-growth
Class: PARTIAL (COMPARE-01:136, :332)
Fresha behaviour: Flash sales, last-minute deals, and deal-performance reporting built on the promo engine. (OBSERVED — hc/103914,101316-101320,518.)
Egebeya current state: Promo codes + quiet-hours discounts ship (src/db/schema.ts:302-318; validation public.ts:816-845; in-tx re-check :921-927) but they are separate unmanaged things; two dashboard widgets print discounts that mint no real code — WinBackWidget.tsx:56-62 (`WIN10`) and MarketPulseWidget.tsx:126-130 ("15% off") both fail at booking; CustomerHealth does mint correctly (crm.ts:98).
Blockers: money (register CAUTION — price semantics; in-tx promo re-check is law); protected (#8 — upward price adjustment stays impossible).
Debate summary: Unanimous, Chair-logged CLEARED — all four split the row into a bug and an engine, confirming FSD-002's T7.14→T7.17 split: the lying widgets are a day-1 defect (D: "a merchant who sends a dead code to 40 clients learns twice: the product lied, and their name is on it — fix first, engine later"), so the honesty fix ships NOW inside T7.17; the deal wrapper (window + audience + redemption counts from usedCount) is NEXT as T7.14. C bound the engine to additive, down-only discounts (flash deals = time-windowed promos, COMPARE-03 #8 protects the direction), with the deal-performance view riding E-ar-02. B verified the bug in-tree (T7.14's bug-half promoted into T7.17) and flagged the deal wrapper's remaining T7.14 scope as independent of any CEO money ruling except where discount math touches effectiveAmount — which stays down-only.
Council ruling: Two rulings in one file. (a) Lying-widgets fix: BUILD NOW (T7.17 — WIN10/"15% off" must mint real codes or be removed). (b) Deal wrapper engine: BUILD NEXT (T7.14 minus anything that depends on CEO money rulings — the effectiveAmount floor and down-only direction are protected, gift-card/package ledger interactions from rulings 6/7 are out of this scope).
Closure method (if BUILD): (a) T7.17 half: scope = every UI-produced discount becomes redeemable via POST /api/tenant/promo-codes or the string is deleted; entity changes: none; endpoint changes: none (existing promo-codes API); UI: two widgets; test: the T7.14 acceptance verbatim — share text → code → booking succeeds at the discounted amount. (b) T7.14 half: scope = deal wrapper over promo_codes — name, window, percent, audience, redemption counts; entity changes: additive deal columns on promo_codes (guarded idempotent ADD); endpoint changes: deal CRUD on tenant routes, validation rides public.ts:816-845/:921-927 in-tx re-check; UI: deals list + quiet-hours merged surface + perf view (rides E-ar-02), both locales. Tests both halves: chain-payments-billing — "every UI-string discount redeems at the discounted amount; upward adjustment still impossible"; in-tx PROMO_EXHAUSTED re-check not bypassable.
Substitute method (if any): none — the row already half-ships; this closes the lie and wraps the engine.
Owner: Engineering Lead (T7.17 fix) / Product Owner (deal wrapper)
Effort: M (B, wrapper; fix is S-sized inside T7.17)
Money path: YES ⇒ CAUTION (records and promises discount semantics; moves nothing beyond the existing promo path)
Protected decision referenced (if any): COMPARE-03 item 8 — dynamic up-pricing killed; discounts fill idle slots (quiet-hours precedent), no surge; this ruling does not reopen it: up-pricing stays impossible.
EGE-ADVANTAGE collision (if any): none; #12 (no messaging meter) untouched — deals ship as codes, not sends.
Merchant evidence: OBSERVED-workaround, day-1 y via the bug (D; code-proven — FSD-002:119-121); flash-sale demand UNDOCUMENTED; promo-code use OBSERVED.
Confidence: HIGH
CEO ruling (final): Not escalated — council ruling stands (no new money semantics; promo path already gated).
