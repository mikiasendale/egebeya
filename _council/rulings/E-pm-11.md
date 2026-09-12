ID: E-pm-11 (+ Fresha pair F-bh-51)
Name: Packages & service bundles
Surface: merchant SaaS
Category: payments-money
Class: GAP (COMPARE-01 — no packages table)
Fresha behaviour: Prepaid visit bundles sold POS-side and redeemed against appointments (fb-point-of-sale; hc/101256). KB provenance: OBSERVED.
Egebeya current state: No packages entity (schema.ts scan, verified HIGH); multi-service booking sums into one block (src/api/public.ts:755-779); the paper "5-visit gel package, pay once" runs off-platform.
Blockers: money + liability shape — resolved by ruling 7; sequencing: after the E-pm-09 pattern; precondition: ruling 1; location-aware first migration (ruling 10 impact)
Debate summary: A deferred the whole row — "prepaid liability with undefined refund semantics until T7.5 ships"; B costed L with packages/package_purchases/per-visit state and demanded written stacking rules before code; C's option (b) broke A's dependency chain — visit-credits as a merchant-tracked discount-at-charge record (loyalty's pendingRewardDiscount pattern, public.ts:866-877) move money only once, at purchase, inside the booking rail; D rated pain LOW-MED with a paper workaround. The clash: defer-until-refund-rail (A/B) vs discount-at-charge sidestep (C), and B's redemption ledger vs C's no-ledger record are incompatible designs, not sequenced ones.
Council ruling: BUILD NEXT (was AWAITING-CEO at session close)
Closure method (if BUILD): Build after the E-pm-09 pattern (ledger discipline, design-doc-first, location-aware first migration). Shape per ruling 7: prepaid visit-bundle sold at booking time, deposit upfront (money moves once, inside the existing rail); unused visits follow the merchant's reuse/expiry setting — a real tenant setting, not a platform default; no stored consumer balance beyond the package ledger. Entity: packages + package_purchases + per-visit redemption state (design doc: packages ledger). Money rule: redemption applies as discount-at-charge and must never become a second move; stacking against promo/loyalty/quiet discounts must be written down before code (public.ts:817-877); the effectiveAmount floor already permits a zero-charge "free" visit (Math.max(0,…) at public.ts:877 — untouched). Refund-of-unused follows ruling 2's posture: record the manual act, no gateway call. Tests (MONEY — NEW cases in server/tests/chain-payments-billing.test.ts): package redemption cannot illegally stack with promo/loyalty/quiet; expiry/reuse-setting case (unused visit expires or becomes reusable per merchant setting, never refunds automatically).
Substitute method (if SUBSTITUTE/DEFER-with-substitute): n/a (BUILD NEXT). Interim from the debate: the owner's paper tally / punch-card loyalty shape (Gap.md:97).
Owner: Engineering Lead
Effort: L (B; nobody re-priced it lower on ruled facts)
Money path: YES — CAUTION (moves at sale inside existing rail; redemption records only)
Protected decision referenced (if any): COMPARE-03 #6/#7 adjacency (C §5: "tips→payout→stored-value ladder is the single most likely backdoor") — held by ruling 7's "no stored consumer balance beyond the package ledger"
EGE-ADVANTAGE collision (if any): none
Merchant evidence: LOW-MED; workaround: owner counts the package on paper or in the punch-card loyalty shape that already gates (Gap.md:97); UNDOCUMENTED. Agent sentence: "Sell five visits now, schedule them later."
Confidence: MEDIUM (A/B MED; C HIGH on the discount-at-charge collision test; demand UNDOCUMENTED)
CEO ruling (final): Ruling 7 — "Packages — deposit upfront; merchant setting for reuse of unused appointment. Prepaid visit-bundle sold at booking time; unused visits follow the merchant's reuse/expiry setting; no stored consumer balance beyond the package ledger. Refund-of-unused follows ruling-2 posture: record the manual act."
