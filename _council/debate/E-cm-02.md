# Debate — E-cm-02 Allergy & patch-test records

**Surface (declared per persona):** A: merchant SaaS | B: undeclared (per-row) | C: MS | D: MS (client-management) — flag: B carries no surface (Rule 1).

## 1 · Product Owner
Smallest unit: inside T7.11 — clinical fields on the customer record + surfaced on the QueueConsole card ("at the chair"). **NEXT** (T7.11 bundle). Verified HIGH: no clinical column anywhere in schema.ts. **HIGH**.

## 2 · Engineering Lead
Effort **S, after E-cm-01**. Two fields on the record + visible on the queue chair card (QueueConsole.tsx:184-242). "Medical-adjacent PII → erasure matrix + **no print in notifications**." Dep: E-cm-01 (authored-record seam). Crons: none; no money-path work. **HIGH**.

## 3 · Council
**RED-needs-CEO-ruling (PDPL special-category)** (MS). "This is HEALTH DATA about consumers under PDPL 1321/2024 — **the single largest legal exposure in the 68-row scope**." Options: (a) don't store — patch-test as checkbox + free-text prohibition ("kept on the shop's paper card"); (b) store with explicit separate consent at capture, purpose-limitation (visible only to staff on that appointment), retention tied to visit history, erasure-matrix row. Even (b)'s MVP: breach-notification stakes rise the moment allergies sit in a booking DB. Recommend CEO ruling before any code; "do NOT let a build slip in as 'a notes field'." No COMPARE-03 collision; heavy PDPL. **HIGH**. (C ruling #10.)

## 4 · Support/CRM
Impact **LOW**. Workaround (code path): none needed — "In Addis today the client *tells you* at the chair; the record-what-you-heard instinct is strong in this market" (Gap.md:151). UNDOCUMENTED. Day-1: n.

## 5 · Challenge round
**C → A:** A ships clinical fields in the NEXT T7.11 bundle; C blocks the same fields until a CEO PDPL ruling — A's "NEXT" vs C's "no code before the ruling" on the identical bundle seam.
**C → B:** B's S ("two fields") presumes the storage question is open; C's option (a) — don't store at all — makes the S moot.
**D → A:** D's LOW/UNDOCUMENTED demand undercuts A's "surface it at the chair" urgency argument.

## 6 · Chair log
- **Agreed:** no clinical column exists today (schema-verified); any stored form needs the erasure matrix and no-notification-print (B, C).
- **Contested:** build-now-in-bundle (A, B: S/M-effort, NEXT) vs CEO-blocked-pending-PDPL-ruling (C: RED, largest legal exposure) vs don't-bother (D: LOW, chair conversation works).
- **Escalation:** ESCALATE (C ruling #10): store allergy/patch-test data with special-category consent apparatus, paper-card convention (checkbox + free-text prohibition), or prohibit the field? (Legal authority required, not money — LAW 5 spirit + PDPL 1321/2024.)
- **Closure state:** AWAITING-CEO
