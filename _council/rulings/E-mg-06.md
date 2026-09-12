ID: E-mg-06 (+ Fresha pair F-sa-135)
Name: Referral program (client-to-client loop with referrer reward)
Surface: merchant SaaS + consumer marketplace (named pair; C names the client-to-client loop a CM surface, A/D file it merchant marketing — both declared per rule 15: consumer + merchant actors)
Category: marketing-growth
Class: PARTIAL (COMPARE-01:139)
Fresha behaviour: Clients refer friends; both sides earn rewards; referrer credited on the friend's first paid visit. (OBSERVED — fbv-barber; hc/603.)
Egebeya current state: Supply-side agent attribution exists (src/db/schema.ts:19-20 `acquired_via_code`; analytics.ts:22-41); no client-to-client loop, no referrer reward — the consumer→consumer half is absent.
Blockers: protected (COMPARE-03 #9 / loyalty gate LOYALTY_ENABLED + north-star ≥0.7 — reward half dark until the gate opens on real numbers; docs/loyalty-opening.md is the only path, AGENTS.md:24-25).
Debate summary: Unanimous DEFER of the reward half, Chair-logged CLEARED: A — referral depth is G1-dead until the gate opens, T7.18 agrees; B nonetheless specs M with an anti-gaming rule (credit only on first completed PAID booking, winback single-use mint precedent) and a money-gate case, noting a referral reward "lowers the next charge exactly like loyalty does" (public.ts:866-877); C files PROTECTED-DO-NOT-TOUCH — "a law violation dressed as product work" — while naming the rule-20 substitute that does not touch the gate; D confirms word-of-mouth runs on Telegram at zero product cost and refuses to fabricate a gate metric. C's framing is confirmation-requested, not a reopen request — the gate stands as written.
Council ruling: DEFER — reward half protected-gated; referee-only substitute may ship with promo surface (no payout to referrers) but is not scheduled this season.
Closure method (if BUILD): N/A — DEFER; re-entry requires the loyalty gate opening via a recorded decision in docs/loyalty-opening.md (rule 7 / AGENTS.md), then B's T7.18 shape applies: `?ref` carry through booking POST, credit on first completed paid booking, single-use recipient-locked mint, never wallet/cash (AGENTS.md), money-gate case: "referrer code lowers next charge once; self/same-phone referral refused."
Substitute method (if any): mechanic — C's rule-20 half: extend the existing supply-side `acquiredViaCode` to a referee-only discount code via the promo engine (schema.ts:302-318), with ZERO referrer payout. Named trade-off: no two-sided incentive loop → the referral earns nothing for the referrer, so the program is weaker than Fresha's — but it is legal today under #9 and keeps the gate untouched.
Owner: Product Owner
Effort: M (B's spec, for the day the gate opens; nothing buildable now)
Money path: NO while deferred (a reward would lower effectiveAmount → YES ⇒ CAUTION on gate-open; register B's gate case applies then)
Protected decision referenced (if any): COMPARE-03 item 9 — loyalty tiers/expiry/referral deferred WITH the gate, not ahead of it; gate condition changes require a recorded decision (docs/loyalty-opening.md); AGENTS.md:24-25 (no fabricated gate metrics).
EGE-ADVANTAGE collision (if any): none for the substitute (referee discount is promo-path, already shipped); the reward half collides with #9 until the gate opens.
Merchant evidence: DECISION-recorded (gate-ordered, D); frequency UNDOCUMENTED (word-of-mouth works off-platform today); day-1 n.
Confidence: HIGH
CEO ruling (final): Not escalated — council ruling stands (C's #9 restatement is a confirmation, not a reopen; no CEO action requested).
