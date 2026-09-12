ID: E-bc-09 (+ Fresha pair F-mp-28)
Name: Cancellation with reason capture
Surface: consumer marketplace (capture) + merchant SaaS (insight) — both declared per rule 15 (Chair rule-1 correction)
Category: booking-core
Class: PARTIAL (COMPARE-01 F-mp-28: cancel present; reason capture absent)
Fresha behaviour: Cancellation reason capture feeding reorderable reason lists and policy (features.json; help-center hc/286, hc/545 — OBSERVED at doc level).
Egebeya current state: public.ts:1267-1291 sets status='cancelled' with zero reason fields; merchant flip at bookings.ts:81; no reason column (schema.ts:117-148).
Blockers: none
Debate summary: Sequencing was the only real clash: A bundled the row into the T7.11 cycle, while B listed it "independent-of-everything and first-weeks-eligible" at S — it rides the same migration array and needs no extra entity. The Chair fused both: BUILD with the first T7.11 PR (A's seam, B's timing). C conditioned both plans identically rather than clashing: the reason must NEVER become a gate for a fee/charge — COMPARE-03 #4 protects the behavioural-only no-show defence. D rated it LOW-MED, UNDOCUMENTED, phone-call-and-memory workaround.
Council ruling: BUILD NEXT (with the first T7.11 PR)
Closure method (if BUILD): Scope: fixed reason enum + optional free text on BOTH cancel paths (consumer public.ts:1267-1291; merchant bookings.ts:81); one CSV export column (tenant.ts:2122). Entity changes: additive guarded column(s) on appointments in the same T7.11 migration array. Endpoint changes: both cancel endpoints accept the optional reason; response refundNote wording unchanged. UI changes: consumer cancel dialog reason picker + merchant cancel control; strings in am.json AND en.json, same commit. Test additions: server/tests/chain-payments-billing.test.ts — register guard case "reason column export-only assertion; cancel response refundNote wording stable" (proves no money semantics); booking-crud cases in server/tests/booking-crud.test.ts.
Substitute method (if SUBSTITUTE/DEFER-with-substitute): —
Owner: Product Owner (A's T7.11 seam held; B's timing accepted as "rides the same migration array")
Effort: S (B §1; the row is not re-priced in the §3 audit, and the Chair adopted B's timing as "rides the same migration array, no extra entity")
Money path: NO — "records why, never charges" (money register: reason→policy, no money); register case attached as the invariant guard
Protected decision referenced (if any): COMPARE-03 #4 (behavioural no-show defence; reason may never gate a fee — C's condition, adopted).
EGE-ADVANTAGE collision (if any): None.
Merchant evidence: UNDOCUMENTED — the owner asks in the phone call and remembers; re-entry note: reason feeds policy only after data exists; Day-1: n.
Confidence: HIGH
CEO ruling (final): Not escalated — council ruling stands.
