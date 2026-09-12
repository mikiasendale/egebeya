# Council KB Ground Rules

Non-negotiable for every subagent and every ruling this session. Derived from the mission
brief, `AGENTS.md`, `docs/feature-selection.md`, `_knowledge/00-INDEX2.md`, and
`_compare/COMPARE-00` → `COMPARE-04`.

## The 20 rules

1. **Surface discipline (KB Law 7).** Every ruling declares its surface: consumer
   marketplace / merchant SaaS / corporate / platform. Never blend.
   (`_knowledge/00-INDEX2.md:61-66`)
2. **Source priority.** help-center > feature pages > marketing claims.
   (`_knowledge/00-INDEX2.md:76`)
3. **Confidence tagging.** Every claim is OBSERVED or INFERRED. Every ruling carries
   HIGH / MEDIUM / LOW confidence. (`_knowledge/00-INDEX2.md:41,80-82`)
4. **Canonical files.** Cite v2 (`_knowledge/*2.md`, `11-FEATURE-INVENTORY.md`,
   `12-FULL-SERVICE-INVENTORY.md`) and `docs/Gap.md`. Never v1 (`_knowledge/0N-*.md`
   without the `2` suffix — superseded).
5. **Fixed taxonomy.** The 15 categories in `features.json` are not negotiable:
   discovery-search, booking-core, payments-money, consumer-account, client-management,
   merchant-scheduling, multi-location, trust-safety, marketing-growth,
   automation-notifications, analytics-reporting, team-permissions, content-site,
   api-integrations, localization. (`_knowledge/11-FEATURE-INVENTORY.md:8-77`)
6. **Money-path flag.** CAUTION → `server/tests/chain-payments-billing.test.ts` applies
   (AGENTS.md ritual step 4); any new money semantics require a new test case alongside
   the feature. (`_compare/COMPARE-00-METHOD.md:78-79`)
7. **Protected decisions.** COMPARE-03's 12 DIVERGENT-BY-DESIGN items are not reopened
   without an explicit CEO ruling this session.
   (`_compare/COMPARE-03-DIVERGENT-BY-DESIGN.md:8-21`)
8. **EGE-ADVANTAGE.** COMPARE-02's 17 protected advantage records — copying Fresha's
   version of a protected capability (walk-in queue, Ethiopian calendar core, PDPL
   surfaces, public /v1 API, dark-site gate, Amharic-first docs, unmetered messaging,
   dunning-lite, Market Pulse, delivery ledger, north-star funnel, Instant Empire, block
   doc, builder pipeline, AI-copy consent, Ge'ez scheduling, consumer report-a-merchant)
   is invalid. (`_compare/COMPARE-02-ADVANTAGES.md`, `_compare/COMPARE-01-GAP-MATRIX.md:213-233`)
9. **Absence ledger.** The 7 unpublished Fresha numbers (processing rates, enterprise
   pricing, marketplace new-client fee value, client-side fees, numeric policy windows,
   public developer program, payout cadence). Rulings resting on them are INFERRED.
   (`_knowledge/11-FEATURE-INVENTORY.md:186-195`)
10. **KB GAPS.** The 5 corpus blind spots (live booking telemetry, venue pages `/a/*`,
    logged-in merchant app UI, payment rates/fee schedules, blog article bodies).
    Rulings depending on them are provisional. (`_knowledge/00-INDEX2.md:67-78`)
11. **Reading order.** `_knowledge/` 00 → 12, then COMPARE-00 → 04. Never out of order.
12. **Policy-as-feature.** A policy is a feature: behavior + edge case + money.
    (`_knowledge/11-FEATURE-INVENTORY.md:80-94`)
13. **Automation catalog as a set.** Fresha's 20 automated messages are one system, not
    20 tickets. (`_knowledge/11-FEATURE-INVENTORY.md:96-107`)
14. **Money-movement ledger.** Trace the 14 moments where money moves; a ruling touching
    one inherits its edge cases. (`_knowledge/11-FEATURE-INVENTORY.md:110-128`)
15. **5-actor matrix.** Consumer, owner, staff, independent merchant, operator,
    platform — name which actor(s) a ruling changes.
    (`_knowledge/11-FEATURE-INVENTORY.md:130-138`)
16. **JTBD map.** Argue from jobs (calendar / catalog / clients / marketing /
    online-presence / payments / sales / team), not features.
    (`_knowledge/11-FEATURE-INVENTORY.md:155-162`)
17. **118-record join.** Argue from joined `features.json` (118 Fresha records) ×
    `egebeya-features.json` (104 Egebeya records) via COMPARE-01's per-record classes.
    Do not debate from prose alone. (`_compare/COMPARE-00-METHOD.md:42-63`)
18. **16 URL templates.** The Fresha SEO engine is a grammar (HOME, LOCALE_HOME,
    BT_LANDING, BT_CITY, BT_AREA, TT_PAGE, FB_ROOT, FB_FEATURE, FB_VERTICAL,
    HELPCENTER_*, BLOG, CAREERS, PRICING, AUTH, +2 utility), not a page list.
    (`_knowledge/05-SEO-ENGINE2.md:6-19`)
19. **Displacement pattern.** Testimonials naming previous tools are a trust mechanic
    (verdict headline + first name + city; owner quotes quantify outcomes). Do not
    reproduce rival names. (`_knowledge/06-BRAND-SYSTEM2.md:42-61`,
    `_knowledge/07-TRUST-MECHANICS2.md:53-62`)
20. **INFRA-BLOCKED substitute.** Every blocked GAP (E-ai-03, E-ai-05) requires a
    creative substitute. "SKIP because infra" is invalid.
    (`_compare/COMPARE-04-BACKLOG-PROPOSAL.md:381-397`)

## Session ruling amendments — CHECKPOINT 4.1 (CEO, 2026-09-12)

1. **Chair default authority.** CONTESTED-DEFER rows (sequencing/scope clashes with no
   money-move, legal, or protected-decision content) are resolved by the Session Chair
   with written rationale in `_council/chair-sequencing-rulings.md`, per
   `docs/feature-selection.md` weights, G1–G4 gates, and COMPARE-04 scores. CEO reviews
   them at Checkpoint 5.
2. **Pace.** Debate advances in blocks of 10; the council pauses for the CEO only where
   rows are AWAITING-CEO (money move / legal / protected reopen / strategy / infra
   funding). No batching past an AWAITING-CEO row.
3. **Deferred rule change.** The "no NOW-ruling without code-proven workaround or
   recorded ask" evidence bar was NOT adopted; the CEO may impose it at CP5.

## Rule 21 (added at CP5, CEO "impose now", 2026-09-12)

**Evidence bar.** No BUILD NOW ruling stands without either a code-proven workaround
(a cited dead surface, write-orphan, unread payload, lie-in-the-UI, or duty like PDPL
consent parity) or a recorded ask. Fresha-documented need alone earns NEXT at most.
Retroactive audit passed: every Band-1 row cites its workaround.

## Scope census (`docs/Gap.md`, the CEO's authoritative list)

- **70 feature lines** total across 16 groupings.
- **68 in scope**: E-pm-12 (BNPL) and E-pm-20 (Pay runs) are struck by the CEO in
  `docs/Gap.md:99,121` ("Not in scope of EGEEBYA").
- Of the 68: 66 carry a COMPARE-01 class of PARTIAL or GAP; 2 carry INFRA-BLOCKED
  (E-ai-03, E-ai-05) — both get mandatory creative substitutes per Rule 20, and both
  already carry CEO directives written into `docs/Gap.md` itself.
- Grouping counts: discovery-search 7 · booking-core 8 · payments-money 11 ·
  consumer-account 2 · client-management 7 · merchant-scheduling 5 · multi-location 3 ·
  trust-safety 2 · marketing-growth 5 · automation-notifications 4 ·
  analytics-reporting 3 · team-permissions 5 · content-site 2 · api-integrations 1 ·
  localization 1 · INFRA-BLOCKED 2.

## CEO directives embedded in the scope file — CHECKPOINT 1 RULINGS (2026-09-12)

CEO answered Checkpoint 1: rules stand as written (items 1–2 of the report accepted);
item 3 REFRAMED; item 4 confirmed deliberate.

- **E-ai-03** (`docs/Gap.md:354`) and the **queue+worker target architecture**
  (`docs/Gap.md:359-507`) are treated as **to-do lists, not protected rulings**. The
  debate this session is *how to shape and implement them in the Egebeya stack*, and
  further, **whether to switch to a better infrastructure (change the tech stack)**.
  Subagents must debate implementation shape and the stack-switch question on their
  merits; the CEO remains final authority on any actual migration.
- **E-ds-01 category list** (`docs/Gap.md:7`) — the 14-category expansion target
  (Fresha's 15 minus `weight-loss`) is confirmed as intentional CEO scoping. Debate
  is how to get there, not whether.
- Path corrections accepted as recorded.

## Path corrections recorded (files are truth)

- The mission cites `docs/gap.md`; the file on disk is **`docs/Gap.md`** (capital G).
- COMPARE-00→04 and both feature JSONs live at
  `/media/mikias/27E5BCBF704A2696/Workstation/subware/fresha-clone/_compare/` and
  `/media/mikias/27E5BCBF704A2696/Workstation/subware/fresha-clone/features.json` —
  not inside this repo's `_knowledge/`.
- `EXECUTION_PLAN.md` and `ROADMAP.md` are **absent from the working tree** (staged for
  deletion — see `docs/feature-selection.md:23-29`). Where prior artifacts cite them by
  line, this session cites the surviving law files instead: `AGENTS.md`,
  `docs/feature-selection.md`, `docs/decisions/`, and the tree.

## Money-path register for this session (Rule 6)

GAP/PARTIAL rows touching money semantics (CAUTION): E-pm-05, E-pm-07, E-pm-08,
E-pm-09, E-pm-11, E-pm-15, E-pm-16, E-pm-17, E-pm-18, E-pm-19, E-ts-03, E-mg-01,
E-mg-02, E-an-06 (discount-bearing messages), E-bc-09 (reason→policy, no money),
E-ml-02 (sale attribution), plus T7.5/T7.9/T7.10/T7.14/T7.18 ticket lineages in
COMPARE-04. Every ruling on these answers: does it move money, record money, or
promise money? Any "move" is CEO territory per LAW 5.
