# Debate — E-cm-04 Tags & segments

**Surface (declared per persona):** A: merchant SaaS | B: undeclared (per-row) | C: MS | D: MS (client-management) — flag: B carries no surface (Rule 1).

## 1 · Product Owner
Smallest unit: free-form tags array on customer_stats + CRM filter beside the computed health tags (`customer-health.ts:27` verified MED). **NEXT**, T7.11 row-neighbor. **MED**.

## 2 · Engineering Lead
Effort **S**. Free-form **tenant tag table** + filter param on crm.ts:34-89; segments = saved filter presets (inactive_days already a param :39-60). "Feeds campaign audiences later (E-mg-01)." Crons: none; no money-path work. **HIGH**.

## 3 · Council
**AMBER-with-conditions** (MS). Computed health tags exist (customer-health.ts:27, OBSERVED) — "free-form tags become a **shadow clinical record**." Condition: tags are marketing/behaviour vocabulary; a moderation heuristic + doc rule against clinical text in tags. **Segments feed campaigns only after E-ca-02 exists.** No CEO-ruling request. Collision: NO. **HIGH**.

## 4 · Support/CRM
Impact **MED**. Workaround (code path): "the owner segments by eye ('the ones from church group')"; computed segments already power winback (Gap.md:159). Free-form tags "would land with multi-chair shops; founding cohort too small to feel it." OBSERVED-workaround (computed-only). Day-1: n. Agent sentence: "Message the ten clients who always fill Tuesdays — not all two hundred."

## 5 · Challenge round
**B → A (fact):** storage shape — A puts a tags *array on customer_stats*; B specs a separate *tenant tag table*; one of those is the wrong file (A's row-neighbor framing vs B's crm.ts filter).
**C → A/B:** the free-form unit both plan is exactly the shadow-clinical-record vector C conditions with a moderation heuristic + doc rule; C also sequences segments behind E-ca-02, which A's T7.11-neighbor plan doesn't mention.

## 6 · Chair log
- **Agreed:** tags/segments are marketing-vocabulary only; computed health tags stay the sanctioned derived set; small effort (B: S).
- **Contested:** storage shape (array-on-stats vs tag table); C's gating of segment→campaign use behind E-ca-02.
- **Escalation:** None. — Register check: no money (campaign audiences inherit E-ca-02's consent gate, which ships first per all).
- **Closure state:** CLEARED
