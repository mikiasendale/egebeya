# Debate — E-tp-03 Timesheets & clock in/out
**Surface (declared per persona):** A: merchant SaaS | B: n.d. per row | C: MS | D: merchant SaaS

## 1 · Product Owner
- **DEFER** — no timesheet entity (verified HIGH); "payroll-adjacent, near the struck E-pm-20 boundary." Sits in A's "Deferred-as-a-ruling" list. **HIGH**

## 2 · Engineering Lead
- **M**. `clock_events` table + in/out endpoints + staff view; "the planned hours model stays as-is (staff_availability)." Rides the E-ms-02 view; dep graph: E-ms-01 grid → E-ai-03′ → E-ms-02/E-tp-03 views. Crons: none. **MED**

## 3 · Council
- **AMBER-with-conditions** | MS. Employment records: PDPL register entry; purpose = schedule management only; clock data "must NOT be silently used as wage computation input (E-tp-04 boundary; and it must not leak into platform metrics)."
- Confidence MEDIUM: "labour-law evidentiary role of timesheets in ET unresearched here — flag for owner counsel." C §4 ruling 11 notes E-tp-03 inherits the E-tp-04 boundary. Collision: NO.

## 4 · Support/CRM
- Impact **LOW**: "Staff live above the shop; 'clocking in' is walking up the stairs." Listed in §3 "What NOT to build" (HR-grade for 1-3 person shops).
- Evidence: UNDOCUMENTED. Notice day 1: **n**.

## 5 · Challenge round
**A → B:** A defers the row on payroll adjacency; B prices it as a plain M feature riding E-ms-02 — a `clock_events` table has to be built to hold A's adjacency worry off.
**C → B:** B's build needs C's no-wage-computation rule encoded as a purpose/schema constraint, not a convention, or E-tp-03 smuggles E-tp-04 in through the back door.

## 6 · Chair log
- **Agreed:** nothing ships this cycle (D: no demand; A: adjacent to struck scope; C: counsel-flagged; B: itself dep-gated on E-ms-01/E-ms-02).
- **Contested:** payroll-adjacent deferral (A) vs schedulable M build (B); C's labour-law counsel flag stays open and rides the E-tp-04 boundary ruling (C §4-11).
- **Escalation:** None. (Boundary question is escalated on the E-tp-04 row.)
- **Closure state:** CONTESTED-DEFER
