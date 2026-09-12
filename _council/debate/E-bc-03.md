# Debate — E-bc-03 Waitlist
**Surface (declared per persona):** A: consumer marketplace (owner actor secondary) | B: not declared per row | C: CM | D: paper-level CM+MS

## 1 · Product Owner
- Smallest unit: T7.7 `slot_waitlist` table + join-CTA on full day + first-in-line SMS offer with single-use claim token.
- **NEXT-cycle back / LATER** — one-way door; ledger scores 19/24 with "demand unobserved locally". Do NOT bend the walk-in queue: waitlist is a *separate* table beside `queueState` columns (schema.ts:135-136 verified), never a re-cut of `server/lib/queue.ts` (EGE-ADV, Rule 8).
- Cites COMPARE-04 T7.7; grep-zero waitlist verified. MED.

## 2 · Engineering Lead
- **L** (COMPARE-04 scored M — B's audit row 10: new entity + claim-token state machine + race-acceptance test). Reclaim hook exists (sendReminders.ts:154-184); race via BEGIN IMMEDIATE + withBusyRetry (public.ts:900-914).
- Crons: touches **R**. Consent: "offered slots are marketing → opt-in gate as in winback (runWinbackAutomations.ts:111; AGENTS.md:26)". Deps: E-ms-03, E-an-04. Failure w/o infra: none at 25 tenants. MED.

## 3 · Council
- **AMBER-with-conditions**: do NOT import Fresha's appointment-shaped waitlist as a parallel construct — the chair-shaped queue is EGE-ADV #5/#6/#7; AGENTS.md:21-22 forbids touching queue derivation.
- Shape per T7.7 as ledgered (LEDGER:28): a *reclaimed-slot offer list* derived from cancelled/expired appointments (public.ts:942 cancelsAt sweep), no queue.ts refactor. Collision: **YES-if-built-as-Fresha-does-it**. HIGH.

## 4 · Support/CRM
- Impact LOW. frequency: DECISION-recorded — LEDGER.md:28: "demand unobserved locally; returns with a tenant request". In Addis the waitlist *is* the physical line, which the queue already serves (COMPARE-02 §B.5).
- Workaround: take-a-number queue + expired-slot reclaim (server/lib/queue.ts:127-217). Agent sentence: "don't — sell the live queue board". Day-1: **n**.

## 5 · Challenge round
**C → A:** A's new `slot_waitlist` table + join-CTA is the parallel-construct shape C forbids; both cite T7.7 but read it oppositely — A "separate table beside queueState" (schema.ts:135-136) vs C "reclaimed-slot offer list derived from appointment columns" (public.ts:942; AGENTS.md:21-22).
**B → A:** A leans on the ledger's M-adjacent 19/24; B re-prices **L** (audit table) and adds a consent dependency absent from A's unit — the SMS offer is marketing, gated as in winback (B: runWinbackAutomations.ts:111 | A: "first-in-line SMS offer").

## 6 · Chair log
- **Agreed:** defer until a tenant request (LEDGER.md:28); build beside the queue, never a queue.ts refactor; T7.7 is the reference shape.
- **Contested:**
  - Effort: B **L** vs COMPARE-04 **M** (named in B's own audit).
  - Shape: A's separate waitlist table vs C's derived offer list — both claim T7.7.
  - Consent ordering: B requires the opt-in gate (E-ca-02 duty) before slot-offer SMS.
- **Escalation:** None — EGE-ADV #5 is honored by all four, not reopened; C's conditional ruling settles the shape boundary.
- **Closure:** CONTESTED-DEFER
