# Debate — E-bc-06 Service sequencing
**Surface (declared per persona):** A: merchant SaaS | B: not declared per row | C: MS | D: paper-level CM+MS

## 1 · Product Owner
- Ordered steps + resource concept: "company-shaped".
- **DEFER** — "no Addis salon is losing bookings to missing consult-then-treat enforcement".
- Cites COMPARE-01 F-mp-25. MED. Listed in A's Deferred-as-a-ruling set.

## 2 · Engineering Lead
- **L, defer**: ordered steps break the "sum durations into one block" model (public.ts:777-779, :800); needs a resources table + availability generator rewrite.
- Crons: touches **E** (recurring expansion assumes single service). Failure: half-built sequencing "silently corrupts the calendar that everything else reads". Dep: T6.4, after buffers (E-ms-05). HIGH (that it's L).

## 3 · Council
- **AMBER (defer)**: entity model fights the fixed 30-min grid (public.ts:571) and depends on the same `expandSeries()` extraction that blocks T7.15 (LEDGER:27).
- Substitute already live: multi-service sums into one contiguous block (public.ts:798-800, OBSERVED) — covers the salon "cut-then-colour" job. Named trade-off: no mid-appointment staff handoff. Revisit after E-ms-01/E-ms-05. Collision: NO. HIGH.

## 4 · Support/CRM
- Impact LOW. frequency: UNDOCUMENTED — consult-then-treat matters to med-spas; "the single-chair shop does it by hand and would never configure a resource model".
- Workaround: manual ordering at the chair. Agent sentence: none. Day-1: **n**.

## 5 · Challenge round
No challenges. All four defer; B's L and C's dependency chain (T6.4 → E-ms-05 → here) align with A's "company-shaped" ruling; C's live substitute (public.ts:798-800) is the same fact A cites for deferral.

## 6 · Chair log
- **Agreed:** DEFER across the board; prerequisite chain T6.4/E-ms-05 first; contiguous-block behavior is the honest substitute with its trade-off named.
- **Contested:** None.
- **Escalation:** None.
- **Closure:** CLEARED
