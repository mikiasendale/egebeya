# FSD-NNN — <title>

**Date:** YYYY-MM-DD
**Season at decision:** <0 ship and activate | 1 funnel only | 2 parity and delight>
**Weights in force:** funnel ×_ · market-fit ×_ · effort ×_ · revenue ×_ · evidence ×_
**Supersedes / superseded by:** —
**Overrides:** — *(none, or the gate/law this record changes, with the reason)*

## Board

| Candidate | Gate result | Score /33 | Door | Outcome |
|---|---|---|---|---|
| `T7.x` <name> | G1 pass · G2 pass · G3 pass · G4 pass | — | one-way / two-way | PICKED / PASSED / DEAD(Gn) / PARKED(G3) / REMOVED(G4) |

*(Every candidate that entered the cycle appears here. A candidate missing from this table was
never really considered.)*

## Picked

**What:**
**Why (owner's reasons, verbatim where available):**
**Design doc required (one-way doors only):** `path` or `n/a`
**Ticket:** `EXECUTION_PLAN.md` §… *(appended, never inserted)*

## Passed over — with re-entry conditions

**`T7.x` <name>** — passed because <the actual reason, not "lower score">.
Returns when: <new evidence type — a measured leak, a tenant request, a changed law, a shipped
dependency>. Not before.

## Dead at a gate

**`T7.x` <name>** — killed by **G<n> <gate name>**, citing `<file:line>`.
Returns only if: the ruling itself is changed by a future record in this folder.

## Parked (G3 — cannot ride the current architecture)

**`T7.x` <name>** — needs <worker/queue/second process>. Revisit when: <condition>.

## Measurement commitment

**Question:** <falsifiable, one sentence — "did X move step Y">
**Instrument:** <which existing event/endpoint answers it, cited>
**Answer by:** <ship date + 2–4 weeks>
**Verdict (fill in later):** KEEP / ITERATE / KILL / **UNMEASURABLE** *(why)*
