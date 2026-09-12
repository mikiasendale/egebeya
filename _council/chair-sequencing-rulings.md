# Chair Sequencing Rulings — CONTESTED-DEFER rows

Session amendment CP4.1: the Chair resolves sequencing/scope clashes with written
rationale; money/legal/protected/strategy/infra rows are NOT here — they await the CEO.
Authority basis: `docs/feature-selection.md` §2 gates + §3 weights (funnel×3 market×2
effort×2 revenue×1 evidence×2, Season-0 funnel cap), COMPARE-04 scores, AGENTS.md law,
`_council/kb-ground-rules.md` (rules 1, 7, 8, 12, 17, 20), and the live tree ("files are
truth"). Transcripts: `_council/debate/{id}.md`.

## discovery-search

**E-ds-01 Category browsing — BUILD Band 2/13: widen `tenants.category` to the CEO-confirmed 14 + filter row. Landing hubs DEFER.**
Rationale: hubs are SEO grammar (rule 18) with zero measured input traffic; §10's honesty
rule says evidence-weight rewards "Fresha documented it", and the value column (total −
evidence) sides with A/D over B's M-pricing of hub copy. D's surface objection accepted:
this row is consumer marketplace only.

**E-ds-02 Treatment search — DEFER. Re-entry: first 20 treatment-shaped queries in
`search_intent`.**
Rationale: no canonical treatment entity while demand is unmeasured (C's condition
adopted); B's `services.name LIKE` join is pre-approved as the S-unit at re-entry,
read-only over active services. A/B agree on trigger-gating; §3's funnel cap makes any
NOW argument unverifiable.

**E-ds-03 Neighbourhood scoping — SPLIT: structured district field on settings save =
BUILD with E-ds-01 change (two-way door, invisible). Consumer-facing district filter =
DEFER with E-ds-02.**
Rationale: A's "collect the data, ship the UI later" survives D's code-proven-workaround
objection (the workaround is exactly what structured data ends), and costs nothing on its
own diff. The coordinate seed rides E-ds-04's ruling below.

**E-ds-04 Map view — Map UI REFUSED this session (B: L/DATA-BLOCKED; no coordinates
exist). Approved: additive optional lat/lng fields on the settings save, no UI.
Substitute (rule 20): merchants keep the existing per-site map block; directory orders
by activity blend when E-mg-05 seeds, not by distance. Trade-off named: proximity
discovery stays impossible until ≥50 listed tenants self-carry coords (A's trigger,
adopted).**

**E-ds-07 Same-day surfacing — BUILD, ordered AFTER T7.6 (closures writer). `openToday`
computed batched per request, no cache (D's condition).**
Rationale: B's factual finding — without a closure write path, "open today" actively
lies on closed dates (`public.ts:508-522` enforces closures nobody can write). The
ordering is a sequencing fact, not an opinion; it keeps both in Band 1.

## booking-core

**E-bc-03 Waitlist — DEFER (Band 3). Re-entry: one recorded tenant ask.
Substitute named: derived reclaimed-slot visibility in the merchant queue console
(C's idea — data that already exists via `cancels_at` sweep), trade-off: consumers get
no proactive offer, so the feature earns nothing until demand proves it. Boundary
enforced: separate `slot_waitlist` table only; `server/lib/queue.ts` untouched
(AGENTS.md:21, rule 8). B's M→L re-price and opt-in gate accepted.**

**E-bc-04 Group bookings — DEFER. Fact dispute resolved FOR B: N attendees multiply
`effectiveAmount` (`public.ts:877`), so the row re-flags CAUTION/money-adjacent — C's
"money: none" was prose-level. Re-entry with E-ml-01 ruling (capacity is a
multi-resource shape).**

**E-bc-08 Reschedule (merchant half) — BUILD inside the shared-calendar bundle only:
owner moves an appointment via button+grid in the new calendar (C's GREEN-with-
conditions), never as a standalone patch to the day-list (A's fork concern adopted).
Drag later. Merchant SaaS surface.**

**E-bc-09 Cancellation reason — BUILD with the first T7.11 PR (A's seam; B's timing —
it rides the same migration array, no extra entity). No money; records why. Rule 1
correction: capture = consumer marketplace surface, insight = merchant SaaS — both
declared, per rule 15 (consumer + owner actors).**

**E-bc-10 Assignment rules — DEFER unanimous; C's carve-out (merchant-selectable staff
subset per service) recorded as the substitute shape for re-entry. Consumer-picks-staff
is protected behavior (E-bc-02 SAME), not to be bypassed.**

**E-bc-11 Sell-online + lead controls — BUILD Band 2. Settings seam =
`GET/PUT /api/tenant/settings` blob (tenant.ts:1185-1204 — the repo-map/COMPARE citation
drift 623-714/:802 resolved against the tree). Availability-generator change only.**

## payments-money (non-money rows only — the moving ones await the CEO)

**E-pm-05 Per-appointment policy override — DEFER, with C's condition permanently
attached: any future override may only choose among the prepay-only policy shapes
(COMPARE-03 item 3 protected, rule 7). B's M spec recorded for that day.**

**E-pm-06 Terminals / E-pm-19 Merchant credit — DEFER unanimous (G2 rails-kill /
Gap.md:119 self-park). No substitute invented — neither is a blocked product feature;
they are absent rails.**

**E-pm-16 Void/raise/edit — BUILD as recorded-corrections INSIDE the offline-ledger
shape (B/C), not blocked behind the CEO's tax decision (A's full-deferral rejected):
E-pm-18 cleared unanimously and anchors the ledger; void = status flag + reprint, never
a gateway call. Reprint rides existing receipts plumbing. CAUTION (money record).**

## consumer-account / client-management (non-legal rows)

**E-ca-01 Client account depth — DEFER. A/D's rule-8 argument (identity-lite IS the
advantage, E-ca-03 SAME achieved without accounts) outweighs C's GREEN; B's scoped S/M
profile-editor is the re-entry unit if /my-bookings traffic appears.**

**E-cm-03 Intake forms — form engine DEFER. A's free-text "notes for the salon"
substitute REJECTED while E-cm-02 is unresolved (C's laundering argument stands:
free-text becomes shadow health data the PDPL matrix can't see). Substitute that holds:
post-visit notes written by the merchant inside T7.11, kept off the pre-booking capture
schema (PublicBooking.tsx:15-23 stays fixed zod). Re-entry gated on the E-cm-02 CEO
ruling.**

**E-cm-05 Import/export/merge/delete — SPLIT: export button NOW (T7.17, unanimous —
`tenant.ts:2122`, zero UI callers). Import/merge DEFER: C's append-only-ledger danger
(loyalty_ledger, notification_log) is a design requirement, not a mood — re-entry needs
a merge-safety doc. Per-client delete = fold into the existing PDPL erasure matrix work,
not a new surface.**

## merchant-scheduling

**E-ms-01 Smart calendar — BUILD read-only week grid as the shared-calendar bundle
(Band 2, CEO's E-ai-03 to-do). D's "canvas vs week" concern adopted as scope law:
v1 = rendered grid, no drag, no color-config UI; grid chrome later. E-ge-advantage
boundary: sits BESIDE the queue stack; queue.ts untouched.**

**E-ms-02 Staff roster — BUILD as C's read-scoping, NOT B's dated-shift entity: staff
login sees their own week on the same grid via existing role projection
(`bookings.ts:23-58`). This is literally the CEO's redefinition of E-ai-03. Trade-off:
no shift-swap/approval. Roster publishing to non-login staff DEFER.**

**E-ms-05 Buffers/extra time — DEFER behind T6.4 (dual expansion-logic consolidation —
repo-map verified both copies exist). Effort dispute resolved FOR B: M, not S
(three end-time writers: `public.ts:798`, walk-in `bookings.ts:345`, `v1.ts:158` +
availability generator). Re-entry automatic when T6.4 lands.**

## trust-safety / marketing-growth

**E-ts-03 Settings toggle naming the existing force-prepay policy — BUILD Band 2
(B/C over A): zero behavior change, names a live protection. The monetary half remains
PROTECTED (COMPARE-03 item 4) and is not in this ruling.**

**E-mg-01 Blast campaigns — fact dispute resolved by the tree: B is right that no plan
gate exists in code on `/marketing/blast` (`crm.ts:182` under owner+CSRF+limiter only —
Gap.md's "Pro gate" claim is stale; rule 17/tree-wins). Ruling: scheduling + per-template
performance view BUILD in Band 2, strictly after E-ca-02 (consent duty, A/C agreed).
Email campaigns blocked until SMTP is provisioned (repo-map infra constraint — do not
sell a stub). Whether blast SHOULD be Pro-gated is a pricing decision → noted for CEO
at CP5, not resolved here.**

**E-mg-05 Review engine — BUILD re-slotted to head of Band 3 (B's L re-price accepted:
new entity + consumer write UI + merchant reply + prompt job; A's "minimal" is the
right shape at the wrong cost estimate). Unblocks E-ds-05. Google sync excluded (G2).
Trade-off: directory shows no ratings through this season — NEW badge stays.**

**E-an-04 (tip/waitlist/slot-available message half) — BLOCKED with parents (A/B/D
majority over C's ship-now; a message for a nonexistent mechanic is a lie — T7.17
principle). did-not-show + thank-you ship in Band 1 via T7.4 (unanimous).**

## team-permissions

**E-tp-03 Timesheets — DEFER (A/C) over B's standalone-M offer: adjacent to the CEO-
struck pay-runs scope (E-pm-20) — building the hours-capture half invites the
compilation half. Re-entry only with the E-ml-01 strategy ruling. No conflict with
E-tp-05 (lifecycle), which clears separately.**

## internal conflicts resolved
- B §1 "E-bc-07 S" vs B §3 audit "M": the audit governs (B's own re-audit).
- E-bc-07 notes piece itself is NOT sequenced-escalted; its only gate is the E-cm-02
  CEO question about shipping the T7.11 bundle without the allergy field. Chair's
  recommendation to CEO: ship notes + cancel-reason + files first; allergy field
  waits — this decouples E-bc-07, E-cm-01, E-cm-06 from E-cm-02.
