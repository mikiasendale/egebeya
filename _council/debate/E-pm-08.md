# Debate — E-pm-08 Tips

**Surface (declared per persona):** A: merchant SaaS (section) | B: undeclared (per-row) | C: **CM+MS** | D: payments section — flag: A says merchant SaaS, C adds consumer marketplace; B carries none (Rule 1).

## 1 · Product Owner
Smallest unit: preset/custom tip step on the existing prepay charge, stored in `payments.meta` (T7.10). **DEFER pending CEO** — "a tip is money the platform routes but cannot pay out"; FSD-002 says it "needs a staff-attribution decision first." Amount calc verified HIGH (`public.ts:877`, no gratuity term). CAUTION. **HIGH**. (A's escalation #3: inherits E-tp-04's ruling.)

## 2 · Engineering Lead
Effort **M** (COMPARE-04 said S — audit overrides). A gratuity term enters `effectiveAmount` (public.ts:877), the telebirr charge (:1002-1014), `payments.meta`, the ticket (ReceiptTicket.tsx:128-138), settlement reporting (settlements.ts). Money path = always one-way + CAUTION; T7.10's acceptance ("zero-tip booking byte-identical", base/tip reported separately) is M-sized discipline, not an afternoon. Gate test: tip raises booking charge only; zero-tip byte-identical; Pro checkout unchanged. **HIGH**.

## 3 · Council
**RED-needs-CEO-ruling** (CM+MS). Tips are unprotected (COMPARE-03 §"What is NOT in this file"), but the economics are a trap: a tip in effectiveAmount flows to the *merchant's* Chapa account; staff then expect payout — and platform payout is COMPARE-03 #7 (no custody). Options: (a) tip rides the merchant push with an explicit "settle to your staff offline" disclosure — platform never attributes or routes tips; (b) build after T7.10's staff-attribution prerequisite (LEDGER:29); (c) no tip UI on-platform. Silent-reversal risk if ignored. **HIGH**.

## 4 · Support/CRM
Impact **LOW**. Workaround (code path): cash handed to the stylist at the chair — invisible to the platform; T7.10 blocked on the staff-attribution decision *before* any money code (LEDGER.md:29). Evidence: UNDOCUMENTED. Day-1: n. Money: **would move — hard stop until attribution ruling.**

## 5 · Challenge round
**A → C:** A describes the tip as money the platform *routes* but cannot pay out; C's option (a) ships the identical UI with the platform explicitly *not* routing or attributing — two different money models, only one can ship.
**B → C:** B specs a concrete M build with named gate cases; C rules any tip UI CEO-blocked regardless of engineering readiness.

## 6 · Chair log
- **Agreed:** nothing ships before a staff-attribution/payout ruling (A, C, D concur); if it ships, B's gate discipline (zero-tip byte-identical, base/tip separate) is the acceptance shape.
- **Contested:** whether a tip is platform-routed (A) or merchant-pushed platform-blind (C option a); urgency split — D LOW/UNDOCUMENTED vs A's Band-3 slot.
- **Escalation:** ESCALATE: which of C's options (a) uninvolved tip + offline disclosure, (b) wait for the E-tp-04 staff-attribution ruling, (c) no on-platform tip UI? Register check: money *promise* today becomes a potential *move* into the payout wall (#7).
- **Closure state:** AWAITING-CEO
