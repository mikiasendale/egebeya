# Debate — E-cm-01 Client profiles & history

**Surface (declared per persona):** A: merchant SaaS | B: undeclared (per-row) | C: MS | D: MS (client-management) — flag: B carries no surface (Rule 1).

## 1 · Product Owner
Smallest unit: T7.11 (the bundle: E-cm-01/02/06 + E-bc-07/09 + E-cm-04 + E-cm-03-minimal) — "the profile is 100% derived today" (`customer_stats` columns verified HIGH: visits/spend/health/no-show only). **NEXT** — "one of the two sentences that close a merchant in person." Seam: `customer_stats` additive columns + `crm.ts`; one-way door; PDPL erasure assertion mandatory. COMPARE-01 F-sa-110. **HIGH**.

## 2 · Engineering Lead
Effort **M**. Additive: append-only notes table (loyalty_ledger precedent, schema.ts:481), fixed enums. "This is the T7.11 'authored-record schema' the other rows depend on" (deps: E-cm-02, E-cm-03, E-cm-06, E-an-06-birthday). PDPL erasure matrix update mandatory; staff projection must not leak phone/email (bookings.ts:23-41). No money-path work (outside the payments register). Crons: none. **HIGH**.

## 3 · Council
**AMBER-with-conditions** (MS). Derived stats exist; the authored half is T7.11 (LEDGER:24: "schema + PDPL erasure surface"). Sequence rule: **erasure design lands in the same PR as the first authored field.** No CEO-ruling request. Collision: NO. **HIGH**.

## 4 · Support/CRM
Impact **MED**. Workaround (code path): "the owner's contact-book and memory — which is why 'regulars' are a one-person failure mode when a stylist leaves with them in their head (feeds E-tp-05 too)" (Gap.md:147). OBSERVED-workaround (transaction-derived only). Day-1: **n** — "they trust their memory — until they don't." Agent sentence: "Your regulars belong to the shop, not to a phone's memory."

## 5 · Challenge round
**C → A:** A bundles erasure as "mandatory" inside a NEXT-cycle bundle; C hardens it into a same-PR sequence law (erasure design with the first authored field) — same direction, stricter rule.
**D → A:** A ranks E-cm-01 one of two sentences that "close a merchant in person"; D grades notice-day-1 **n** — the pain is real but invisible to owners on day one.

## 6 · Chair log
- **Agreed:** the authored record is the T7.11 seam the other client rows hang on; erasure matrix ships with the first authored field, not after.
- **Contested:** salience (A's close-argument vs D's day-1-n), sequencing strictness (C's same-PR rule vs A's bundle note). Effort M (B) vs no effort claim by A/C/D.
- **Escalation:** None. — Register check: no money move/record/promise; PDPL is handled by C's standing erasure condition, no special-category data here (that's E-cm-02).
- **Closure state:** CLEARED
