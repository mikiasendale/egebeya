# Debate — E-mg-06 Referral program (PARTIAL, Gap.md:244-247)
**Surface:** A: merchant SaaS (section header) | B: none declared per row | C: CM | D: merchant SaaS. Flag: C names the consumer-marketplace surface (client-to-client loop); A/D file it under merchant marketing.

## 1 · Product Owner
**DEFER** — referrer rewards are loyalty tiers/referral depth: G1-dead until the gate opens (COMPARE-03 item 9 protected, Rule 7; LEDGER G1 table). T7.18 agrees. `acquired_via_code` supply-side verified HIGH (schema.ts tenants). Protected-gate reminder in §5. Listed Deferred-as-a-ruling. **HIGH**.

## 2 · Engineering Lead
**M** (T7.18). consumers row exists (schema.ts:455); `?ref` carry + credit on first **completed paid** booking (anti-gaming rule already applied to agents) + single-use code mint (winback path runWinbackAutomations.ts:148-169). CAUTION: reward lowers next charge exactly like loyalty does (public.ts:866-877) → new gate case. Never wallet/cash (AGENTS.md). Crons: none, event-driven at completion. Money-gate case: "referrer code lowers next charge once; self/same-phone referral refused." **MED**.

## 3 · Council
**PROTECTED-DO-NOT-TOUCH (reward half)** | CM. Ledger:30/LEDGER:41: referral depth returns only when the loyalty gate opens on real numbers (AGENTS:24-25; docs/loyalty-opening.md; COMPARE-03 #9). Building a referrer reward while the gate is closed is "a law violation dressed as product work." Rule-20 substitute available today: extend supply-side `acquiredViaCode` to a referee discount code (promo engine) with ZERO referrer payout; trade-off: no two-sided loop → weaker incentive. Collision: YES with #9. Files reward half as confirmation-requested, not reopened. **HIGH**.

## 4 · Support/CRM
Impact: **LOW.** Supply-side agent attribution exists; consumer-to-consumer absent (Gap.md:247; T7.18 WAITING behind the loyalty gate, LEDGER.md:30). Word-of-mouth already runs on Telegram at zero product cost. "Referrer rewards touch the loyalty gate — do not fabricate a gate metric here." frequency: DECISION-recorded (gate-ordered). Day-1: **n**.

## 5 · Challenge round
No challenges — all four defer the reward half; no position asks to reopen the gate (C's substitute keeps referrer payout at zero).

## 6 · Chair log
- **Agreed:** reward half dark until the LOYALTY_ENABLED + north-star ≥0.7 gate opens on real numbers; no fabricated gate metrics.
- **Contested:** None.
- **Escalation:** None (C's confirmation that #9 stays dark is a restatement, not a reopen request).
- **Closure state:** CLEARED
