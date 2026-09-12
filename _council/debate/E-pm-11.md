# Debate — E-pm-11 Packages & service bundles

**Surface (declared per persona):** A: merchant SaaS (section) | B: undeclared (per-row) | C: merchant SaaS | D: payments section — flag: B carries no surface (Rule 1).

## 1 · Product Owner
**DEFER + ESCALATE** — "prepaid liability with undefined refund semantics until T7.5 ships" (money-record + promise). No packages table (verified HIGH, schema scan). **MED**. (A's escalation #6.)

## 2 · Engineering Lead
Effort **L**. `packages` + `package_purchases` + per-visit redemption state; stacking rules against promo/loyalty/quiet discounts (public.ts:817-877) "must be written down before code." Dep: **E-pm-15; after T7.5 tax ledger.** CAUTION. **MED**. Gate case: package redemption can't illegally stack with promo/loyalty/quiet; expiry case.

## 3 · Council
**RED-needs-CEO-ruling (via gift-card sibling)** (MS). Prepaid visits = deferred merchant obligation + the refund-of-partially-used problem, "E-pm-15's missing rail pointed at the consumer." Options: (a) ship after refund semantics ruled, (b) "visit-credit" as merchant-tracked record — no money move at redemption, discount-at-charge like loyalty's `pendingRewardDiscount` (public.ts:866-877, OBSERVED); money moves once, at purchase, inside the booking rail. Redemption path must then allow effectiveAmount → 0 (Math.max floor already permits). Collision: NO if discount-at-charge; YES if a balance. **HIGH**.

## 4 · Support/CRM
Impact **LOW-MED**. Workaround (code path): the owner counts "5-visit gel package, pay once" on paper or in the punch-card loyalty shape that already gates (Gap.md:97). UNDOCUMENTED. Day-1: n. Money: **moves at sale, records a liability — CAUTION.** Agent sentence: "Sell five visits now, schedule them later."

## 5 · Challenge round
**C → A:** A defers the whole row behind T7.5's refund semantics; C's option (b) — discount-at-charge visit credits — deliberately needs no refund rail first, breaking A's dependency chain.
**B → C:** B's shape is a redemption ledger "after T7.5 tax ledger"; C's (b) shape is a merchant-tracked record with no ledger — the two designs are incompatible, not sequenced.

## 6 · Chair log
- **Agreed:** no stored-balance variant without a ruling; any first build must not stack with promo/loyalty/quiet without a written rule + chain case.
- **Contested:** defer-until-T7.5 (A, B) vs the (b) visit-credit shape that sidesteps the rail (C); D's demand evidence is UNDOCUMENTED either way.
- **Escalation:** ESCALATE (C ruling #4): discount-at-charge visit-credits vs stored balance, and the refund-of-unused policy for prepaid bundles. Register check: sale is inside the existing rail; redemption must never become a second move.
- **Closure state:** AWAITING-CEO
