# Debate — E-ar-02 Automation performance
**Surface (declared per persona):** A: merchant SaaS | B: n.d. per row | C: MS | D: merchant SaaS

## 1 · Product Owner
- Smallest unit: per-template delivery rollup from `notification_log` for the owner; the platform-wide stats already exist (`notificationStats.ts`, matrix-cited).
- **NEXT**; "grows naturally out of the T7.1/T7.4 template expansion." Bands it in step 12 after E-mg-05/E-mg-01 seed. **MED**

## 2 · Engineering Lead
- **M**. notification_log carries channel/template/status/refType (schema.ts:438-449); missing: campaign identity + booking-attribution join (refId→appointments→completed).
- The CEO plan's "job ledger" (§observability) is the same table widened — "do it when a worker exists, not before." Dep: E-mg-01 for campaign rows. Crons: none. **MED**

## 3 · Council
- **GREEN-with-conditions** | MS. Raw material = notification_log + delivery-ledger advantage EGE-ADV #10; per-template aggregates are additive queries, tenant-scoped.
- Condition: success-rate claims must inherit the mailer-stub caveat until `mailer.ts:31-34` is fixed, "else delivery stats lie"; full attribution lands better after the job ledger in the infra to-do. Collision: NO. **HIGH**

## 4 · Support/CRM
- Impact **LOW**: platform-wide channel success only (Gap.md:285); per-message attribution needs the catalog first.
- Delivery stats already overstate email via the stub-id bug (COMPARE-02 §G) — "fix the ledger before selling the graph."
- Evidence: UNDOCUMENTED frequency. Notice day 1: **n**.

## 5 · Challenge round
**A → B:** A grows the per-template view out of T7.1/T7.4 expansion alone; B gates the meaningful version on campaign identity (Dep: E-mg-01) and defers the job-ledger widening to a worker — same rollup, different pre-conditions.

## 6 · Chair log
- **Agreed:** additive per-template rollup on notification_log is the right next shape; no delivery claims ship before the mailer-stub fix.
- **Contested:** whether E-mg-01 campaign rows are a hard dependency (B) or the view "grows naturally" (A).
- **Escalation:** None.
- **Closure state:** CLEARED
