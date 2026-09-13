# FSD-001 — Feature selection workflow adopted; Season 0 declared

**Date:** 2026-09-12
**Season at decision:** 0 — ship and activate
**Weights in force:** funnel ×3 · market-fit ×2 · effort ×2 · revenue ×1 · evidence ×2
**Supersedes / superseded by:** —
**Overrides:** none. This record *creates* the process; it changes no law.

## What was decided

1. **The workflow exists and is binding** — `docs/feature-selection.md`, six stages: intake,
   kill gates, scorecard, briefs, decision record, build-then-measure.
2. **Separation of powers.** Agents prepare briefs and run gates. The owner picks. Recorded in
   `AGENTS.md` as a standing rule, not a convention.
3. **Season 0 declared.** Rationale, in the owner's framing: production is not live and the
   operator block is still open — `render.yaml` still ships `ALLOW_UNVERIFIED_PAYMENTS="true"`
   (`docs/REPO_MAP.md:303`, flagged TEMPORARY), the Telegram bot and SMTP are unprovisioned
   (`server/lib/mailer.ts:31`, `src/api/consumer.ts:54-66` returns 503 `TELEGRAM_UNPROVISIONED`),
   and the loyalty gate is closed on real numbers (`docs/loyalty-opening.md:31-40`).
4. **Weights 3 / 2 / 2 / 1 / 2**, chosen by the owner from the Season 0 preset, deliberately:
   heavy funnel and evidence, revenue de-weighted to ×1. What that means in practice: *make the
   existing promises true and provable before monetising new ones.*
5. **The gap matrix stays outside the repo**, referenced by absolute path from
   `docs/feature-selection.md` §0 —
   `/media/mikias/27E5BCBF704A2696/Workstation/subware/fresha-clone/_compare/`. The owner accepted
   the risk that a machine without that mount cannot read Stage 1 intake; the mitigation is that
   anything surviving intake is copied into a ticket in `EXECUTION_PLAN.md`, which is in-repo.

## Why the gates come before the scorecard

The Fresha comparison produced 68 GAPs and 29 PARTIALs against 104 Egebeya records. Ranking that
without gates first is how a solo operator ends up building card-on-file fee capture. Four
candidates were killed by law **before** they were ever scored (FSD-002 board), and the twelve
`DIVERGENT-BY-DESIGN` records in `COMPARE-03` are permanently outside the funnel: the never-do list
classifies, it is not a backlog item.

## Passed over — with re-entry conditions

**Weighting the funnel axis higher than ×3 in Season 0** — declined implicitly by the cap rule:
the funnel axis is capped at 1 until a leak is measured in production, so raising the weight raises
noise, not signal. Returns when: real traffic exists and `/api/admin/funnel` shows a measured drop.

**Moving the matrix into the repo (`docs/compare/`)** — considered and declined by the owner in
favour of an absolute-path reference. Returns when: the mount proves fragile, or the matrix needs
to be read by an agent on another machine. Not before.

## Dead at a gate

None. This record creates the gates; it does not exercise them. The first exercise is FSD-002.

## Measurement commitment

**Question:** does this workflow reduce decision churn — i.e. does a candidate passed over with a
written re-entry condition stay out until that condition is met?
**Instrument:** `docs/decisions/LEDGER.md` — count of rows whose status is `PASSED` that reappear
as discussion without their re-entry condition having been met.
**Answer by:** after three completed cycles (not calendar-based; cycle-based).
**Verdict (fill in later):** —

## Proposed addition, pending owner confirmation

The run surfaced a category the six stages do not place: **duties**. A consumer's ability to
withdraw consent (PDPL 1321/2024) and a landing page that promises a refund the code does not
perform are not rankable features — deprioritising them is a compliance and trust failure, not a
sequencing choice. Proposed rule (not yet in force):

> **Duties bypass ranking.** Items whose absence is a legal obligation or a false public promise
> are scheduled, not scored. They are recorded here when they appear and marked `DUTY`.

This record does **not** adopt that rule. It is listed for the owner to accept, amend or reject.
