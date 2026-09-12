# Debate — E-ms-05 Processing & finishing times / extra time (GAP, Gap.md:194-197)
**Surface:** A: merchant SaaS | B: none declared per row | C: MS | D: merchant SaaS. No clash.

## 1 · Product Owner
Smallest unit: `bufferMinutes` on services (T7.15). **DEFER** behind T6.4 (duplicate expand-series consolidation — repo-map cron note verified HIGH): "the ledger's BLOCKED status is correct; it's an engineering pre-requisite, not product sequencing." Single duration verified HIGH (`schema.ts:71`). Ladder: T7.15 returns when T6.4 lands. **HIGH**.

## 2 · Engineering Lead
**M** — effort audit flips COMPARE-04's S: "columns S; correctness is not". End-time computed in THREE places (public.ts:800, bookings.ts:345 walk-in, v1.ts:158); availability must pad (:570-583); recurring expansion exists twice (cron/expandRecurring.ts:39 vs tenant.ts:1803 — T6.4). T7.15 itself says land T6.4 first. Crons: touches **E**. Dep: T6.4. **HIGH**.

## 3 · Council
**AMBER (dependency-blocked)** | MS. T7.15 BLOCKED on T6.4 expandSeries extraction (LEDGER:27). Every duration change touches the fixed 30-min grid (public.ts:571), ETA maths (queue.ts:100-114), and overlap checks — booking-correctness territory; regression-suite-first. **EGE-ADV collision: YES-if-it-touches-queue-derivation** — queue.ts read-only per AGENTS:21-22. **HIGH**.

## 4 · Support/CRM
Impact: **LOW-MED**. One duration per service, fixed 30-min grid (Gap.md:197). Local truth: clients arrive/leave late, but chair time in a walk-in-dominant shop is already fluid — the queue's ETA engine tolerates slip by design (queue.ts:100-114, degrades to category default). "Buffers matter for prepay-booked med-spa sequences, not for a barber's day." frequency: UNDOCUMENTED. Day-1: **n**.

## 5 · Challenge round
**B → COMPARE-04:** recorded effort clash, S vs M (B's §3 audit row 16).
**C → B/A (implied):** the queue-collision guard (ETA maths in queue.ts) is a constraint on HOW buffers land, above the shared T6.4 gating.

## 6 · Chair log
- **Agreed:** blocked behind T6.4; queue.ts stays read-only; correctness > column-add.
- **Contested:**
  - Effort class S (COMPARE-04) vs M (B: three end-time writers, dual expansion).
- **Escalation:** None.
- **Closure state:** CONTESTED-DEFER
