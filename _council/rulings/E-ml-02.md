ID: E-ml-02 (+ Fresha pair F-sa-207)
Name: Independent merchants / workspace (chair-renter attribution)
Surface: merchant SaaS + platform (named pair; D files it merchant SaaS, the renter/split surface is platform-scale — debate flag carried)
Category: multi-location
Class: GAP (COMPARE-01:113, :317)
Fresha behaviour: Independent merchants (booth/chair renters) operate inside one workspace with attributed sales (OBSERVED — hc/223,224,225; fbv-salon booth renters).
Egebeya current state: Staff are logins scoped to one tenant, not attributable merchants (src/db/schema.ts:24-40,77-91); no attribution fields on bookings/payments.
Blockers: money (sale attribution is in this session's money-register — RECORDING only), protected boundary (payout/split half is COMPARE-03 #7 custody, dead); sequenced behind E-ml-01's design doc.
Debate summary: A/B/C/D escalated or deferred the whole row: A named the head-on collision with the struck E-pm-20 pay-runs; B priced L with a money-gate case; C split the row into a safe half (attributing a sale to a person — money-RECORDED, bookingSource precedent) and a dangerous half (splitting/paying money — wallet custody); D called it LOW-theater. CEO ruling 10 names "chair-renter attribution" as strategy, adopting C's safe half; pay-runs (E-pm-20) remain struck in Gap.md:121, so attribution must not pre-commit any payout shape.
Council ruling: BUILD NEXT — attribution half only, sequenced after the E-ml-01 locations design doc.
Closure method (if BUILD): Scope = sale attribution fields only; boundary stated in writing: attribution ≠ payout — Egebeya records who earned a sale and never settles between parties (the struck E-pm-20 half stays struck). Entity changes: additive attribution columns on the booking/sale record, riding the T7.5 offline-ledger foundation and location-aware in its first migration (CEO §Impacts; bookingSource is the shape precedent). Endpoint changes: booking/settlement payloads carry the attribution; no new money surface. UI changes: merchant sales view shows per-renter attributed totals. Test additions: chain-payments-billing new case — "attributed split sums to original amount exactly; no new money" (B); payments.amount ledger immutability preserved.
Substitute method (if any): none needed — the ruled half is the substitute for the deferred settlement product.
Owner: Council (strategy cluster); Engineering Lead executes the T7.5-riding half
Effort: L (B's price for the row; ruled scope is attribution-only and lands smaller, but rides E-ml-01)
Money path: YES ⇒ CAUTION (money-RECORDING per C's safe half; never "move")
Protected decision referenced (if any): COMPARE-03 #7 (no custody / no payout engine) bounds the ruling; E-pm-20 struck (Gap.md:121).
EGE-ADVANTAGE collision (if any): collision exists only at the payout half — struck, so the ruled build carries none (C: "YES-at-payout-half").
Merchant evidence: chair-rental exists in Addis (C, OBSERVED structure); consumer/merchant ask UNDOCUMENTED (D: frequency class UNDOCUMENTED; workaround = informal off-platform splits).
Confidence: MEDIUM (direction HIGH per ruling 10; shape depends on the locations doc and ledger)
CEO ruling (final): Ruling 10 (chair-renter attribution named as strategy; escalations #7 resolved: attribution is permitted money-recorded, payout is not).
