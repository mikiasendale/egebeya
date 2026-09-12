# Debate — E-cm-05 Client list import/export/merge/delete

**Surface (declared per persona):** A: merchant SaaS | B: undeclared (per-row) | C: MS | D: MS (client-management) — flag: B carries no surface (Rule 1).

## 1 · Product Owner
Split: **Export button NOW** inside T7.17 (`tenant.ts:2122` verified HIGH — live endpoint, zero UI callers). **Import/merge/per-client delete: DEFER.** **HIGH**.

## 2 · Engineering Lead
Effort **M**. Export exists but unwired (dead surface). Import = parse ≤2k rows in-request ("no queue needed at this scale"). Merge = re-point appointments/customer_stats — **one-way door**. Per-client "delete" **must map to anonymize** (payments are immutable money records), not row-drop — design doc first (feature-selection.md:136-140). Crons: none. **MED**.

## 3 · Council
**AMBER-with-conditions** (MS). Import = bulk third-party PII intake: merchant warrants consent (DPA-language in the import UI), platform is processor. Export gets a UI — "endpoint is live, dead surface — **free win**." **MERGE is the dangerous one**: customer_stats PK is (tenantId, phone) and loyalty_ledger is append-only with phone keys (accountDeletion.ts:44-49, OBSERVED) — merging must not orphan punches or double-count spend; per-client delete reuses the anonymize-not-delete money pattern. No CEO-ruling request. Collision: NO. **HIGH**.

## 4 · Support/CRM
Impact **MED — the *switching* pain**. Workaround (code path): export is buttonless (repo-map dead surface); no import at all — "re-type clients by phone over two weeks or keep the paper book parallel" (Gap.md:163). Displacement quote is a **KB-PATTERN SUBSTITUTE, not Egebeya evidence** ("Switch software without losing the book"). OBSERVED-workaround (dead export UI, code-proven). Day-1: n merchants, **y at every competitor displacement**.

## 5 · Challenge round
**A → B/C:** A defers import/merge/delete outright; B specs them as one M with named mechanics and C keeps them AMBER-with-conditions — defer vs buildable-with-rules on the same ticket.
**C → B (evidence):** C grounds merge risk in OBSERVED keys (customer_stats PK, append-only loyalty_ledger); B flags merge as one-way but with a lighter schema note — same conclusion, different citation weight.

## 6 · Chair log
- **Agreed:** export button ships NOW (T7.17, free win, all four); delete = anonymize-never-row-drop because payments are immutable money records.
- **Contested:** import/merge/delete — DEFER (A) vs M-with-conditions (B, C) vs "the switching pain" priority (D).
- **Escalation:** None. — Register check: the merge/delete rules exist precisely so money *records* stay immutable; no move is proposed.
- **Closure state:** CONTESTED-DEFER
