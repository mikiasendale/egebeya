ID: E-pm-08 (+ Fresha pair F-bh-48)
Name: Tips
Surface: consumer marketplace + merchant SaaS (named pair: consumer tips at checkout; merchant sees per-staff totals)
Category: payments-money
Class: GAP (COMPARE-01 — effectiveAmount has no gratuity term)
Fresha behaviour: Tips captured at POS/checkout with platform tip routing to staff (fb-point-of-sale; hc/352; hc/589). KB provenance: OBSERVED.
Egebeya current state: No gratuity term anywhere — `effectiveAmount` = max(0, total − promo − loyalty − quiet) (src/api/public.ts:877); tip UI absent from the prepay sheet (src/pages/PublicBooking.tsx:677-761).
Blockers: money — resolved by ruling 4 (record-only); payout wall (COMPARE-03 #7) avoided by design; precondition: ruling 1
Debate summary: A deferred pending CEO — "a tip is money the platform routes but cannot pay out"; C ruled RED with three options and picked (a) merchant-pushed with offline-settlement disclosure; B demanded M-sized gate discipline (zero-tip byte-identical, base/tip separate), overriding COMPARE-04's S; D rated demand LOW/UNDOCUMENTED (cash at the chair). The core clash: A's routed-money model vs C's platform-blind merchant push — only one can ship, and the CEO chose a third precise shape (recorded under the staff member, no routing).
Council ruling: BUILD NEXT (was AWAITING-CEO at session close)
Closure method (if BUILD): Implement Spec A verbatim (CEO-rulings-cp4 §Spec A). Flow: consumer confirms booking → prepay sheet shows base (already computed), staff (already chosen), tip row → presets `10/15/20 ETB` + `10%/15%/20%` + `No tip` + `Other` (numeric input) → Chapa charge = base + tip in one push → on settle, `payments.meta` gets `tip_amount_etb_cents:int`, `tip_staff_id`, `tip_input_mode: "preset"|"percentage"|"custom"` → receipt prints base, tip, total, "Tip for {staff name}" → merchant books show per-staff tip totals; merchant pays staff off-platform. Merchant settings: `settings.tip_enabled` default **off**; `settings.tip_modes` (presets only / percentages only / both) default both. Egebeya does NOT: route money to staff, hold tips, pay out tips, pool/split tips, or attach tips to subscription charges. Files to touch (exactly five): src/pages/PublicBooking.tsx:677-761; src/api/public.ts:877; src/components/ReceiptTicket.tsx:128-138; src/api/tenant.ts:450-546; src/pages/Dashboard/Settings.tsx:415-430; no new column (payments.meta JSON). Tests — SIX required NEW cases in server/tests/chain-payments-billing.test.ts: (1) zero-tip booking byte-identical to today; (2) tipped booking charges base+tip; (3) tip_staff_id matches booking staff; (4) Pro subscription charge untouched; (5) settlement reports base/tip/total separately; (6) per-staff aggregation across multiple bookings.
Substitute method (if SUBSTITUTE/DEFER-with-substitute): n/a (BUILD NEXT). Off-platform interim from the debate: cash at the chair remains how tips happen until this ships.
Owner: Engineering Lead
Effort: M (B §3 audit overrides COMPARE-04's S — "money path never ships as S energy")
Money path: YES — CAUTION (raises the consumer charge; one push; never a platform move)
Protected decision referenced (if any): COMPARE-03 #7 (no custody/no payout) — skirted by design: tip rides the merchant's own Chapa push; tips are otherwise unprotected (COMPARE-03 §NOT-in-file)
EGE-ADVANTAGE collision (if any): none; FSD-002's "staff-attribution decision first" is satisfied by ruling 4's written-under-staff shape
Merchant evidence: LOW; workaround: cash handed to the stylist at the chair — invisible to the platform; UNDOCUMENTED.
Confidence: HIGH
CEO ruling (final): Ruling 4 — "Tips — record-only at checkout, no routing, written under the staff member, presets + percentages. Full implementation spec below (§Spec A)." Spec A above is transcribed verbatim from the CEO directive.
