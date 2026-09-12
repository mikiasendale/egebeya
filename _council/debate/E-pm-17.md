# Debate — E-pm-17 Taxes, service charges, surcharges

**Surface (declared per persona):** A: merchant SaaS (section) | B: undeclared (per-row) | C: merchant SaaS | D: payments section — flag: B carries no surface (Rule 1).

## 1 · Product Owner
Smallest unit: tenant VAT/service-charge setting → additive line in the one place the amount is computed (`public.ts:877` verified HIGH: `max(0, total − promo − loyalty − quiet)`) + itemized ticket. **NEXT but CEO-gated** — "it changes what a consumer is charged = a money promise"; needs the design doc FSD-002 demands ("the order must be asserted, not assumed"). CAUTION. **HIGH**. (A's escalation #1.)

## 2 · Engineering Lead
Effort **M (risk-L trap)**. Additive line in `effectiveAmount` (:877) + receipt itemization + per-service exempt flag. The trap: **the webhook verifies provider amount vs `payments.amount` at 0.005-birr tolerance (payments.ts:~148-170) — tax must be in the stored amount or EVERY paid webhook logs `webhook_amount_mismatch` and no-ops.** Rounding order (discount-before-tax) must be pinned in a new gate case (T7.5 acceptance). CAUTION. **HIGH**. (§3 audit: "M kept, flag".)

## 3 · Council
**RED-needs-CEO-ruling (narrow)** (MS). Adding an ADDITIVE line changes the capture amount the webhook verifies (chain-webhook-amount exists, OBSERVED); service charges edge toward dynamic price-up semantics that COMPARE-03 #8 killed *as a platform behaviour* — a merchant-declared tax line is different, "but the ruling must say so explicitly." Options: (a) display-only "prices include TOT" per Ethiopian convention, zero money-semantics change — **recommended**; (b) additive line at capture (new chain test, webhook-amount parity, ETB-only preserved). Collision: YES-if-(b)-without-ruling. **HIGH**. (C ruling #6.)

## 4 · Support/CRM
Impact **HIGH for truth, not for features**. Addis menus are *inclusive*; "the pain isn't compliance math — it's that the platform literally cannot print the number the shop already charges" (`public.ts:877`; Gap.md:111). T7.5 pairs tax with the cash ledger at 22/24, WAITING on a money design doc (LEDGER.md:21). OBSERVED-workaround (inclusive pricing kept outside the app). Day-1: n (prices already read correctly *because* nothing is added). Money: **RECORDS — design doc first; do not let it become a promise machine.**

## 5 · Challenge round
**A → C:** A specs the additive line at public.ts:877 as its smallest unit (NEXT, gated); C's recommended (a) is display-only "prices include TOT" — a fundamentally different smallest unit with zero calc change.
**D → A:** D grades it HIGH-for-truth from day-1 salience; A's ladder places the money-semantics question above it and the build behind a doc — both agree no ungated ship.

## 6 · Chair log
- **Agreed:** nothing ships before the order-of-operations design doc; if additive ever ships, tax must be inside `payments.amount` (webhook parity) and pinned by a new gate case.
- **Contested:** smallest unit — additive line (A, B's M-scope) vs display-only convention (C's recommendation); D's HIGH-for-truth grades the merchant-visible problem, not the code change.
- **Escalation:** ESCALATE (C ruling #6): display-inclusive convention (a) vs additive capture line (b)? Register check: (b) changes what is charged = a *promise* with a new *record* semantics; only the existing telebirr capture moves money — no new move proposed.
- **Closure state:** AWAITING-CEO
