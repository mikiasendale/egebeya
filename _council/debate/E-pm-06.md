# Debate — E-pm-06 Card terminals

**Surface (declared per persona):** A: merchant SaaS | B: undeclared (per-row) | C: merchant SaaS | D: payments section, per-row undeclared — flag: B carries no surface (Rule 1).

## 1 · Product Owner
**DEFER / rails-dead** — G2 kill stands (FSD-002 kill table); `chapa.ts:81-136` verified HIGH as the only rail; no hardware surface is buildable or sellable here. **HIGH**.

## 2 · Engineering Lead
**NOT-feasible-without-rail** — Chapa/telebirr push + hosted checkout only (`chapa.ts:54-136`); no hardware integration surface; G2 rails gate (`feature-selection.md:66`). "Any 'terminal' built here is a cash-recording reskin — that's E-pm-18." Reclassify out of the effort debate entirely. **HIGH**.

## 3 · Council
**RED (rails)** (MS). G2-dead per LEDGER:62; chapa.ts exposes exactly initialize/directCharge/authorize/verify (OBSERVED, 173 lines). Terminal hardware + acquiring = NBE-adjacent license surface (COMPARE-03 #10 protected). Rule-20 substitute: QR of the Pay-Now link (E-pm-07) at the counter on telebirr rails. Named trade-off: card-paying tourists/corporate cards unserved. **HIGH**.

## 4 · Support/CRM
Impact **none-in-addis-today**. No card-present rail; Chapa/mobile-money is the only rail (Gap.md:81; LEDGER.md:62). Evidence: DECISION-recorded (G2). Day-1: n. Money: records nothing. "An agent demoing card terminals in Bole is a liability."

## 5 · Challenge round
**B → C:** C's Rule-20 substitute is charge-QR via the Pay-Now link — the very surface C itself rules RED-needs-CEO (E-pm-07); the substitute inherits an escalation. B's substitute instead points at E-pm-18 cash recording.

## 6 · Chair log
- **Agreed:** the row is dead in this stack; all four defer it (A DEFER, B reclassify, C RED, D "not here").
- **Contested:** None.
- **Escalation:** None. — Register check: no move/record/promise in this row itself; the money exposure lives in C's proposed substitute and is escalated under E-pm-07.
- **Closure state:** CLEARED
