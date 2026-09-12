# Debate — E-pm-05 Per-appointment payment-policy override

**Surface (declared per persona):** A: merchant SaaS | B: undeclared (per-row) | C: merchant SaaS | D: payments section, per-row undeclared — flag: B carries no surface (Rule 1).

## 1 · Product Owner
No smallest unit — A refuses one. **DEFER**: "override complexity on a policy that is deliberately one shape" (`public.ts:807-814`). Must not become a partial deposit — COMPARE-03 item 3 (prepay-only) is protected (Rule 7). **MED**.

## 2 · Engineering Lead
Effort **M**: add `appointments.pay_policy_override`, read at booking-create and walk-in (policy today = tenant setting + phone list, `public.ts:807-814`; `crm.ts:293-337`). CAUTION: override changes *when* money is demanded, never the amount; gate case asserts pending/`cancels_at` per override (`public.ts:942`). Touches cron **R**. **MED**.

## 3 · Council
**AMBER-with-conditions** (MS). Override allowed only between *none* and *FULL prepay* — the existing two states (`public.ts:807-814`, OBSERVED). Fractional-deposit reversal hits COMPARE-03 #3 — not reopenable without CEO. Demands a new chain-payments-billing case pinning override ∈ {0, effectiveAmount}. Collision: YES-if-partial-sneaks. No CEO ruling requested on this row. **HIGH**.

## 4 · Support/CRM
Impact **LOW**. Workaround (code path): flip the per-phone flag or take it off-book (`public.ts:807-814`; `crm.ts:293-337`). Evidence: UNDOCUMENTED. Day-1 notice: n. Money: none — policy shape only.

## 5 · Challenge round
**A → B:** B specs a full M build with a gate case; A parks the row entirely behind protected-shape risk.
**A → C:** C permits a conditional build within the two existing states; A sees even that as complexity a one-shape policy shouldn't carry.

## 6 · Chair log
- **Agreed:** nothing fractional is ever built; any override stays inside {none, full prepay} and is pinned by a chain test.
- **Contested:** DEFER (A) vs buildable M (B) vs AMBER-with-conditions (C) on identical GAP facts; D says the pain is UNDOCUMENTED and LOW.
- **Escalation:** None. — Register check: no *move*; nothing here records or promises money beyond existing prepay timing. CEO territory only if someone requests the COMPARE-03 #3 reopen — none does.
- **Closure state:** CONTESTED-DEFER
