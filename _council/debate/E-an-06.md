# Debate — E-an-06 Birthday / welcome / milestone / reward-loyal messages (GAP, Gap.md:269-272) — MONEY-REGISTER CAUTION (discount-bearing)
**Surface:** A: platform (messaging engine) | B: none declared per row | C: MS + CM | D: merchant SaaS. Flag: platform-vs-MS tag; C adds CM because messages land on consumers.

## 1 · Product Owner
Split unit. Welcome-new-clients (T7.1) = **NEXT-cycle first** (rides the winback mint+consent path; CAUTION single-use code). Birthday needs DOB capture that doesn't exist (customer_stats verified HIGH: no dob). **Reward-loyal waits on the gate (Rule 7)**; listed Deferred-as-a-ruling (E-an-06 birthday/reward-loyal — gate-protected). Protected-gate reminder in §5. **MED**.

## 2 · Engineering Lead
**M.** Welcome = T7.1 (reuse winback cron + state machine, S on its own). **Birthday needs a birthdate capture path** (no column, no form — customer_stats schema.ts:279-299). Milestone = visitCount thresholds exist. **Reward-loyal messages ship only with the loyalty gate (LOYALTY_ENABLED + north-star ≥0.7; AGENTS:24-25; loyalty.ts:28-31) — no fabricated gate metrics.** CAUTION: discount-bearing messages mint codes → single-use + consent rules (winback precedent). Crons: **W** extended. Money-gate case: "recipient-locked welcome/birthday code: maxUses=1, expiry, opt-in SQL gate." **MED**.

## 3 · Council
**AMBER (split) + one PROTECTED part** | MS+CM. Welcome and milestone = discount-bearing → consent-gated (E-ca-02 first) and money-path CAUTION (winback single-use pattern already complies). Birthday requires birth-date capture — new PII for marketing only → explicit consent at capture + erasure row (§3 register). **Reward-loyal: PROTECTED-DO-NOT-TOUCH while the gate is closed (COMPARE-03 #9)** — "firing 'you earned points' off a dark engine is fabricating the appearance of the program, AGENTS:24-25 territory." Collision: YES on the loyal half. Confirmation-requested, not reopened. **HIGH**.

## 4 · Support/CRM
Impact: **LOW-MED.** No birth date captured; no welcome/milestone template (Gap.md:272). T7.1 (21/24) waits on T7.4 plumbing — "correct order: a welcome discount message before a working message catalog is a second WIN10-class lie waiting to happen." Loyalty-flavored messages sit behind the LOYALTY_ENABLED gate (LEDGER.md:30; docs/loyalty-opening.md) — condition changes require a recorded decision; not this session. frequency: UNDOCUMENTED. Day-1: **n**.

## 5 · Challenge round
No clashes — D's catalog-first ordering, C's E-ca-02-first, and A's Band-1-T7.4-then-Band-2-T7.1 ladder all agree; the only gate statement is a confirmation (#9 stays dark), not a reopen.

## 6 · Chair log
- **Agreed:** welcome ships after catalog+consent (T7.4, E-ca-02), codes single-use/recipient-locked; birthday needs a DOB capture + PDPL erasure row first; reward-loyal dark until the gate opens on real numbers.
- **Contested:** None.
- **Escalation:** None (C's #9 restatement is confirmation-requested, not a protected-decision reopen).
- **Closure state:** CLEARED
