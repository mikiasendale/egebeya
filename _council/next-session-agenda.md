# Next Session Agenda

Produced 2026-09-12 by the council (Phase 5). All CP5-approved rulings stand; this file
lists what remains contested, deferred, undecided, and needed from the CEO.

## 1 — Gates the CEO already set that block work (order of operations, CP5 item 6)

1. **Flip `ALLOW_UNVERIFIED_PAYMENTS=false`** (ruling 1) — ops action, precondition for
   all 15 CAUTION rows.
2. **Three FSD decision records** (rulings 6, 10, 12) in `docs/decisions/`, loyalty-opening
   pattern. Record 6 must state the gift-card carve-out from COMPARE-03 #6 and its scope
   boundary. Record 12 supersedes feature-selection §9's G3 parking language.
3. **Locations schema design doc** (ruling 10 — "THE strategy"). One-way door. It re-prices:
   E-ds-03/04 (coords as location attributes), E-bc-04 (per-seat capacity), E-ms-01/02
   (location-aware grid columns), E-ai-05 (per-location CSVs), every money ledger's first
   migration (gift/packages/cash/tax-display must be location-aware DAY 1 or re-shape later).
4. **Ledgers design doc** (T7.5 cash-record + gift + packages — one paper, one money-gate
   test plan). E-pm-18 anchors it.
5. **`cron_locks` + `job_outbox` design doc** (Spec B Phases 0–1) BEFORE any consumer code.
6. **Allergy consent + retention doc** (ruling 9) — "real product, real legal, real
   retention": consent capture, typed fields only, erasure wired into
   `accountDeletion.ts`, stated retention period.

## 2 — Decisions only the CEO can make (parked this session)

- **Postgres yes/no — THIS QUARTER** (ruling 12 Phase 2). Load-bearing for ruling 10;
  multi-location on single-writer Turso is capped; decide before the locations doc hardens.
- **Email cost posture** (C ask 7): merchant-SMTP / platform-absorbs / metered — metering
  reverses EGE-ADVANTAGE #2 (unmetered messaging). Blocks E-mg-01's email half + E-ar-02
  email stats honesty.
- **Paid ranking policy** (ruling 11b): labeling rules + quality floor before any boost
  product. Free quality-rank (11a) proceeds.
- **E-pm-17 surcharge half**: explicitly NOT authorized at CP5 (tax-% only). Needs a fresh
  ask if merchants want service charges.
- **Season 1 weights** (feature-selection §0): rule 21 (evidence bar) now live — the
  funnel×3/evidence×2 board may need re-weighting; §10 already predicted evidence-weight
  inflation that rule 21 counteracts.

## 3 — Re-debate queue (triggers are now defined)

| Row | Re-entry trigger |
|---|---|
| E-bc-03 waitlist | one recorded tenant ask |
| E-ds-02 treatment search | 20 treatment-shaped queries in `search_intent` |
| E-ms-05 buffers | T6.4 (dual expansion-logic consolidation) lands |
| E-tp-03 timesheets | locations design-doc phase (trigger ALIVE — ruling 10) |
| E-ca-01 account depth | measured /my-bookings traffic |
| E-bc-10 assignment rules | ≥10-staff tenant exists; carve-out shape recorded |
| E-ai-03 external sync | queue Phase 3 funded + C's six floors adopted |
| E-ml-02 payout half | struck (E-pm-20) — reopen only by CEO reversing the strike |
| E-mg-06 referrer rewards | loyalty gate opens (docs/loyalty-opening.md path) |
| E-an-06 birthday/milestone | ruling-9 consent flow ships; DOB rides it |
| E-ds-04 map UI | ≥50 listed tenants carrying self-entered coords |
| E-pm-07 ad-hoc links | struck by ruling 5 — do not reopen |

## 4 — Open engineering choices (owner: named persona, decide inside the build PR)

- **T7.4 dispatch shape**: inline-now-migrate-later vs outbox-day-one (Engineering Lead
  proposes; CEO §Impacts r12 bullet).
- **Naming drift**: Spec B says `cron_locks`; B's paper proposed `cron_leases`. CEO name
  stands in filings; unadjudicated otherwise.
- **ICS serialization**: `public.ts:1432-1478` is a JSON feed, not ICS — per-staff ICS is
  new work at that seam (noted in E-ai-03).
- **E-cm-04 tags storage shape** (array-on-customer_stats vs table) — unresolved in debate.
- **E-tp-01/E-tp-05 banding** (Band 2 #9 vs first-weeks-eligible) — same diff, two slots.
- **E-ar-02 email stats**: mailer-stub-truth bug (mailer.ts:31-34 records stub as success)
  must be fixed before any per-template performance claim ships.

## 5 — Defects found by the council, outside any ruled row (candidates for new tickets —
the owner's doors per feature-selection §1 are the ONLY intake path)

- Discover's "Search" button `onClick` clears the query (`setSearch('')`) — real defect.
- `GET /api/tenant/ai/weekly-posts` client call with no route (ruled under T7.17 sweep).
- WinBackWidget/MoneyPulse invite discounts that don't mint (ruled, T7.14/T7.17).
- Landing auto-refund promise (ruled, duty copy fix).
- `queue.ts:9-12` docstring contradicts `booking_source` ordering code (COMPARE-02 §G —
  fix the docstring, the behaviour is the advantage).

## 6 — Session artifacts inventory

`_council/`: kb-ground-rules.md (21 rules after CP5) · repo-map.json · positions/{A,B,C,D} ·
debate/ ×68 · rulings/ ×68 · chair-sequencing-rulings.md · ceo-rulings-cp4.md (+ CP5
addendum) · rulings-summary.md · substitutes.md · this file. Uncommitted — the council
cannot commit under its own authority; if the record should persist, commit `_council/`
with explicit paths (AGENTS.md ritual).
