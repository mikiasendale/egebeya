# Debate — E-ai-05 Data export / BI connector — INFRA-BLOCKED
**Surface (declared per persona):** A: n.d. (content: merchant SaaS) | B: n.d. per row | C: MS | D: merchant SaaS

## 1 · Product Owner
- Rule-20 substitutes: (a) **NOW** — the Export button in T7.17 surfaces the live one-shot CSV (`tenant.ts:2122`, verified HIGH, zero callers); (b) **NEXT** — "a nightly snapshot job riding the *existing* cron + media-storage pattern (no queue needed at 25 tenants)."
- Continuous ETL = behind queue; G3 PARKED: "I refuse to sell a 'connector' the single process can't carry." Queue stance (§4): Phase 0-lite lease only (1–2 days, server.ts:243-310); Redis at first real queue-consumer; stay libSQL/Turso, Postgres = one-way door, revisit on measured double-run/throughput evidence. **MED**

## 2 · Engineering Lead
- **S substitute, L real.** Continuous ETL "genuinely wants a worker (streaming inside a request handler is the anti-pattern; tenant.ts:2122-2347 already streams one-shot CSV with **no UI caller**)."
- Rule-20 substitute that fits this stack: an **8th cron** weekly export (isDirectRun precedent, settlementReconciliation.ts:51-60) writing CSV + emailing a link; tenant-scoped, bounded, logged. "Crons: adds one." Real connector stays post-queue — "the first legitimate consumers of the split" (Phase 3).
- De-classification/infra stance (shared with E-ai-03): reject Phase-0 shape, accept goal → **0a cron_leases** + **0b in-process job_outbox**; "the queue should fund itself by then, not before."

## 3 · Council
- **AMBER substitute; full row deferred to §6** | MS. Substitute shipping now without a worker: live CSV endpoint given a UI + a "regenerate" button + export events written to security_events.
- Rule-20 trade-off, named: "no scheduled/continuous push, no object sink — merchants get pull-on-demand, which serves the actual job ('monthly numbers') at current scale." Building ETL inside a request handler "would regress the <500ms web principle the CEO plan itself states (Gap.md:375)." Collision: NO. **HIGH**
- Stack-switch floors (C §6, recorded on this row too): conditional-yes queue behind six acceptance floors (webhook idempotency; eq(tenantId)/tenant_id job ledger; single-writer topology; markers-before-locks with test-not-demo proof; channels-never-throw enqueue; money-gate freeze), Postgres NOT YET, ALLOW_UNVERIFIED_PAYMENTS precondition; "if the CEO defers infra entirely, the rule-20 substitutes stand as written."

## 4 · Support/CRM
- Impact **MED, "substitute available now."** "The merchant's actual sentence is never 'BI connector' — it's 'give me my bookings in a file I can open'" (INFERRED-from-JTBD: "Own the data").
- Substitute per D: ship the export *button* (part of T7.17, 22/24) **and "a monthly emailed CSV as a cron"**; defer connectors to the worker plan honestly. Evidence: OBSERVED-workaround (endpoint without button). Day 1: **n** — "until first reconciliation / first threat of leaving."

## 5 · Challenge round
**C → A:** three substitute shapes for one blocked row: C's Rule-20 substitute is explicitly pull-on-demand-only, trading away scheduled push; A (nightly snapshot on existing crons) and B (new 8th cron weekly + email) both *include* a scheduled export today — D's monthly emailed CSV sides with A/B. C reads scheduled export as the worker's job; A/B read it as riding the existing cron pattern.
**A → B:** cadence and mechanism split within the same stack — A's nightly snapshot reuses existing schedules; B deliberately adds an 8th cron to the set that A's own Phase 0-lite exists to lease — B's substitute grows the exact surface the migration debate is arguing about.
**B → C / A → C (migration triple, per the E-ai-03 record):** the same queue question lands differently here — A defers ETL "until a design-partner tenant actually asks" (Phase 3), B books the continuous half as Phase 3's first legitimate consumer behind 0a/0b, C approves that split only behind its six floors. No "SKIP because infra" survives in any of the three.

## 6 · Chair log
- **Agreed:** the INFRA-BLOCKED label now covers only the continuous/streaming half; the export button is a unanimous now (dead-surface resurrection in T7.17); Rule-20 substitute + trade-off recorded (pull-on-demand; no object sink, no streaming).
- **Contested:** whether a scheduled snapshot ships pre-queue (A nightly / B weekly+email+8th cron / D monthly email) or the substitute stays pull-only (C); cron-count growth before the lease exists.
- **Escalation:** ESCALATE: same infra-funding call as E-ai-03 — lease-only (A), lease+outbox (B), conditional queue with floors (C) — the stack-switch is strategy → CEO.
- **Closure state:** AWAITING-CEO
