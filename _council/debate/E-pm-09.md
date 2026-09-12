# Debate — E-pm-09 Gift cards (sell & redeem)

**Surface (declared per persona):** A: merchant SaaS (section) | B: undeclared (per-row) | C: **CM+MS** | D: payments section — flag: A says merchant SaaS, C adds consumer marketplace (the buyer is a consumer); B carries none (Rule 1).

## 1 · Product Owner
**DEFER + ESCALATE** — stored value sold to consumers "sits next to COMPARE-03 item 6 (client wallets DEAD permanently, NBE wall)"; a legal/council ruling is required **before any schema**. No gift-card table exists (verified HIGH). **HIGH**. (A's escalation #5.)

## 2 · Engineering Lead
Effort **L**. Stored value = new sell flow (payment `purpose='gift_card'`) + balance table + redemption ledger + expiry + fraud surface; `punch_cards`/`loyalty_ledger` are shape precedents (schema.ts:481-507) "but gift value is a liability, not a discount." Dep: **E-pm-15 refunds must exist first — an unsold-card refund today is literally unanswerable.** CAUTION; crons: S semantics only. Failure: unredeemed balances with no refund rail. **MED**.

## 3 · Council
**RED-needs-CEO-ruling** (CM+MS). Platform-held stored value is what COMPARE-03 #6 + AGENTS.md:27 killed. But a **merchant-funded gift code** (value lives as the merchant's liability; platform only issues/redeems a code, like promo_codes with a value column — schema.ts:302-318, OBSERVED) is arguably NOT a wallet — needs a recorded CEO decision in the docs/loyalty-opening.md pattern, not a stealth reclassification. If approved: redemption ledger = money-recorded (chain test; floors at zero like effectiveAmount), buyer+recipient phones are PII (PDPL §4), no expiry (trade-off: merchant float risk). Collision: YES with #6 unless the ruling separates. **HIGH**.

## 4 · Support/CRM
Impact **LOW-MED** (cultural hook: Epiphany/weddings). Workaround (code path): promo codes exist, no stored value (Gap.md:93); "a gift card is a liability that walks like a wallet." If ever built: merchant-funded discount-at-charge shape, never balance. UNDOCUMENTED. Day-1: n. Money: **records promised value — flag to CEO.**

## 5 · Challenge round
**B → C:** B specs a platform balance table + redemption ledger — the exact custody shape C says sits behind the #6 wall; C's merchant-liability-code variant is a different (possibly legal) build nobody costed.
**A → B:** A blocks all schema until a ruling; B's L estimate and E-pm-15 prerequisite presume the ruling has not happened but the design has.

## 6 · Chair log
- **Agreed:** no platform-held balance; if it ever ships it is merchant-funded, no-expiry, refund-gated-behind-E-pm-15 (A, C, D converge on the code shape).
- **Contested:** whether a merchant-liability code is meaningfully distinct from the dead wallet at all (C's "arguably" vs A's adjacency warning); B's L-vs-nobody's-ruling design.
- **Escalation:** ESCALATE (C ruling #3): is a *merchant-liability* gift code meaningfully distinct from the never-do "wallet"? Recorded decision per docs/loyalty-opening.md, or remains DEAD. Register check: records/promises money; platform custody would cross a legal line.
- **Closure state:** AWAITING-CEO
