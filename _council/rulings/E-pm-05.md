ID: E-pm-05 (+ Fresha pair F-bh-44)
Name: Per-appointment payment-policy override
Surface: merchant SaaS
Category: payments-money
Class: GAP (COMPARE-01)
Fresha behaviour: Merchant overrides the payment policy on a single appointment (deposit %, timing) per hc/102333. KB provenance: OBSERVED (features.json F-bh-44).
Egebeya current state: Policy is tenant-setting + per-phone list only; no per-appointment column (src/api/public.ts:807-814; src/api/crm.ts:293-337).
Blockers: protected (COMPARE-03 #3, prepay-only) + money-semantics (timing) — no CEO reopen requested
Debate summary: B specs a buildable M (`appointments.pay_policy_override`, read at booking-create and walk-in, gate case on pending/`cancels_at`); A parks the row entirely as "override complexity on a policy that is deliberately one shape"; C permits a conditional build only between the two existing states; D prices the pain LOW and UNDOCUMENTED. All agree nothing fractional is ever built; the clash is DEFER (A) vs conditional-M (B/C) on identical GAP facts.
Council ruling: DEFER
Closure method (if BUILD): — (n/a; re-entry condition attached below)
Substitute method (if SUBSTITUTE/DEFER-with-substitute): existing lever stands — flip the per-phone force-prepay flag (crm.ts:293-337) or take the exception off-book; trade-off: no per-appointment granularity, and it must never become a partial deposit.
Owner: Council (condition guard)
Effort: M (B's spec recorded for the day it is built; nothing ships now)
Money path: YES (CAUTION per money-register — changes *when* money is demanded, never the amount)
Protected decision referenced (if any): COMPARE-03 #3 (prepay-only, never a fraction) — permanently attached condition: any future override may only choose among {none, FULL prepay} (public.ts:807-814's two existing states), pinned by a new chain-payments-billing.test.ts case asserting override ∈ {0, effectiveAmount} (C's condition, Chair-adopted).
EGE-ADVANTAGE collision (if any): none
Merchant evidence: LOW frequency; workaround code path = flip per-phone flag / off-book handling (public.ts:807-814; crm.ts:293-337); UNDOCUMENTED.
Confidence: MEDIUM
CEO ruling (final): Not escalated — council ruling stands (Chair: DEFER with C's condition; no persona requested the COMPARE-03 #3 reopen). General money precondition on file: ruling 1 flips ALLOW_UNVERIFIED_PAYMENTS=false (render.yaml:26).
