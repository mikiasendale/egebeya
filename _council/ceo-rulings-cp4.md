# CEO Rulings — Checkpoint 4 (2026-09-12) — FINAL AUTHORITY

Issued by the CEO/Founder at the consolidated escalation stop. These are protected
session rulings (rule 7 path: explicit CEO ruling this session). Every Phase-4 ruling
file cites this document where applicable. Format: ruling → what it changes.

## The 12 rulings

1. **ALLOW_UNVERIFIED_PAYMENTS=false — flip now.** The unprovisioned-payment escape
   hatch (render.yaml:26) closes. It is a precondition for all money rows below.
2. **E-pm-15 Refunds — copy fix + one-tap "refund issued" record. No automation.
   Merchant allows it.** No Chapa refund-initiation call. The false landing-page
   promise (Landing.tsx:1029 / en.json:63 vs public.ts:1283-1285) is fixed in BOTH
   locales; owner gets an idempotent, tenant-scoped acknowledgement stamping
   payments.status/meta and emailing the consumer a bilingual note (T7.9 shape).
3. **E-pm-17 Taxes — tenant setting for tax %; if set, display "including TOT".**
   Display-only posture: NO additive capture line; `effectiveAmount` math unchanged
   (public.ts:877 stays max(0, total − promo − loyalty − quiet)). Receipt/booking
   copy shows the inclusive-TOT note when the rate is set. (C's recommendation, taken.)
4. **E-pm-08 Tips — record-only at checkout, no routing, written under the staff
   member, presets + percentages.** Full implementation spec below (§Spec A).
5. **E-pm-07 Payment links — narrow:** links may only charge against an existing
   booking balance or a platform/merchant invoice — never ad-hoc. QR of share-links
   ships as approved (no money). (C option a.)
6. **E-pm-09 Gift cards — ALLOWED:** merchant-funded, third-party buyer allowed,
   Egebeya holds the redemption records, UI is the selling point. **Explicit CEO
   carve-out from COMPARE-03 item 6** (client wallets remain DEAD; gift value is
   merchant liability recorded on-platform, not a consumer-held balance).
7. **E-pm-11 Packages — deposit upfront; merchant setting for reuse of unused
   appointment.** Prepaid visit-bundle sold at booking time; unused visits follow the
   merchant's reuse/expiry setting; no stored consumer balance beyond the package
   ledger. Refund-of-unused follows ruling-2 posture: record the manual act.
8. **E-tp-04 — SPLIT with a boundary test:** per-member service pricing ships alone;
   wages/commissions/payroll stay blocked behind the struck pay-runs scope (E-pm-20).
   (B/D carve-out, taken.)
9. **E-cm-02 Allergy & patch-test — store it, WITH a consent flow:** real product,
   real legal, real retention rules. Special-category data requires explicit capture
   consent, erasure wired into server/lib/accountDeletion.ts, and a retention period.
   Unblocks E-cm-03's form question (still: no free-text laundering — intake answers
   stored as structured fields) and decouples the T7.11 bundle split per the Chair.
10. **Multi-location is THE strategy.** E-ml-01/02/03 become planning targets:
    locations as first-class entities, chair-renter attribution, operator visibility.
    Per the CEO's own note in ruling 12, multi-location demands the Postgres decision
    (Ruling-12 Phase 2). Downstream ripple registered — see §Impacts.
11. **E-mg-07 Ranking — free quality-rank now; paid later, only with labeling + a
    written policy.** (C's recommendation, taken.) Directory ordering may leave
    alphabetical (`public.ts:135`) for quality signals once reviews exist; a paid
    boost product is a future CEO-decided policy surface, never silent ranking.
12. **Queue = OPTION 1: cron-lease + `job_outbox` now. Postgres decision this
    quarter. E-ai-05 substitute = weekly cron + pull-only.** Full implementation
    spec below (§Spec B).

## Spec A — Ruling 4 (Tips), as issued

Flow: consumer confirms booking → prepay sheet shows base (already computed), staff
(already chosen), tip row → presets `10/15/20 ETB` + `10%/15%/20%` + `No tip` +
`Other` (numeric input) → Chapa charge = **base + tip in one push** → on settle,
`payments.meta` gets `tip_amount_etb_cents:int`, `tip_staff_id`, `tip_input_mode:
"preset"|"percentage"|"custom"` → receipt prints base, tip, total, "Tip for {staff
name}" → merchant books show per-staff tip totals; merchant pays staff off-platform.

Merchant settings: `settings.tip_enabled` default **off**; `settings.tip_modes`
(presets only / percentages only / both) default both.

Egebeya does NOT: route money to staff, hold tips, pay out tips, pool/split tips,
or attach tips to subscription charges.

Required chain-payments-billing.test.ts cases: zero-tip booking byte-identical to
today; tipped booking charges base+tip; tip_staff_id matches booking staff; Pro
subscription charge untouched; settlement reports base/tip/total separately; per-staff
aggregation across multiple bookings.

Files to touch: `src/pages/PublicBooking.tsx:677-761`, `src/api/public.ts:877`,
`src/components/ReceiptTicket.tsx:128-138`, `src/api/tenant.ts:450-546`,
`src/pages/Dashboard/Settings.tsx:415-430`; no new column (payments.meta JSON).

## Spec B — Ruling 12 (Queue/infra), as issued

Phase 0: `cron_locks(name, locked_at, locked_by, expires_at)` — every cron acquires a
lease or skips; flip ALLOW_UNVERIFIED_PAYMENTS=false (ruling 1).
Phase 1: `job_outbox(id, job_type, payload_json, tenant_id, created_at, processed_at,
attempts, status, error)`; web writes rows and returns; a poller worker (separate
process) dequeues with BEGIN IMMEDIATE + withBusyRetry; **eq(tenantId) on every outbox
query**; **markers before locks**; **channels never throw**.
Phase 2: **Postgres decision THIS QUARTER** — yes: dialect migration + EXCLUDE USING
gist booking-overlap + read replicas for reporting; no: enforce Turso single-writer,
accept replica lag, cap multi-location throughput at one primary.
E-ai-05 substitute: weekly cron writes per-tenant, per-location CSV to storage →
Reports page download; same CSV on demand via existing export endpoint = pull-only.
E-ai-05 reclassifies INFRA-BLOCKED → SUBSTITUTE (trade-off: data is up to 7 days stale
between pulls; no streaming sink).
Still parked: two-way calendar sync (E-ai-03 external half), continuous ETL,
BullMQ/Redis.
Required tests: two instances one cron → one execution; same job twice → one effect;
cross-tenant leak impossible (eq(tenantId) audit); poller restart keeps unprocessed
jobs; weekly export ≡ pull endpoint output.

## Impacts — ripple registered by the Chair (for CP5 approval)

- Ruling 10 makes the locations schema a design-doc (one-way door, §6) BEFORE any
  E-ml-* build; E-tp-04's per-member pricing (ruling 8) and E-pm-* ledger rows must be
  location-aware in their first migration to avoid a re-shape.
- Ruling 10 → the Postgres decision this quarter (ruling 12 Phase 2) is load-bearing
  for it; single-writer Turso caps "one tenant, many chairs" throughput — recorded
  consequence, not a veto.
- Ruling 6/7 redefine money-record surfaces (gift-card ledger, package ledger) — both
  sit on the T7.5 offline-ledger foundation already sequenced in Band 2.
- Ruling 3 keeps public.ts:877 pristine — good: every other money ruling's test
  surface stays smaller.
- Ruling 12's job_outbox makes notification dispatch enqueue-shaped: the Band-1
  lifecycle messages (T7.4) may ship inline NOW and migrate later, or ride the outbox
  from day one — Engineering Lead to propose in the ruling closure method.

## CP5 ADDENDUM — approval + residual answers (CEO, 2026-09-12)

**All 68 council rulings APPROVED.** Residual register answered:

1. **E-mg-01 — blast SHOULD be Pro-gated.** Add `requirePlanLimit`/Pro-plan gate to
   `POST /api/tenant/marketing/blast` (crm.ts:182) — the tree currently has none.
   Money-adjacent (Pro conversion surface): closure gains one acceptance case
   (free-plan tenant → 403 PLAN_REQUIRED).
2. **E-tp-05 — archived staff STILL consume a paid plan slot.** Archive preserves
   history AND the plan seat; only DELETE frees the seat (`requirePlanLimit('staff')`,
   tenant.ts:101). Owners must be told this in the archive confirmation copy, both
   locales.
3. **E-pm-17 — tax-% ONLY.** The service-charge/surcharge half of the Fresha pair
   (F-bh-58) is explicitly NOT authorized this session; the row's scope is VAT/TOT
   display only.
4. **E-pm-09 — gift-card money lands with the merchant at purchase; redemption is the
   holder's and the merchant's affair.** The platform records sale + redemption and
   runs no refund rail: an unredeemed card refunds merchant-to-buyer off-platform,
   with the on-platform posture identical to ruling 2 (record the manual act).
5. **Evidence bar IMPOSED as session rule 21** (recorded in kb-ground-rules.md):
   no NOW ruling stands without a code-proven workaround or a recorded ask.
   Retroactive audit: every Band-1 BUILD NOW row qualifies — each is a write-orphan,
   dead call, lie-in-the-UI, unread payload, or PDPL duty with a cited code path.
6. **Design/record path (Chair recommendation, CEO asked for it):** order of
   operations = ① three FSD decision records (rulings 6, 10, 12) — one day, unblocks
   everything legally; ② locations schema design doc — gates E-ml-01/02, re-prices
   E-ds-03/04, couples to the this-quarter Postgres decision (ruling 12 Phase 2),
   forces ledger rows (gift/packages/cash/tax-display) to be location-aware in their
   first migration; ③ ledgers design doc (T7.5 + gift + packages, one paper, one
   money-gate plan); ④ job_outbox + cron_locks design doc BEFORE any consumer code;
   ⑤ allergy consent+retention doc with E-cm-02 build; ⑥ tips Spec A is design-doc
   exempt — it IS the design doc, needs only its FSD mention in ① for ruling 8
   (E-tp-04 boundary test).

## Required decision records BEFORE implementation (AGENTS.md:34-37 +
feature-selection §5; owners write them, Chair cannot — LAW 4)

1. FSD record for ruling 6 (gift cards vs COMPARE-03 #6 carve-out) — loyalty-opening
   pattern: names the protected item, the override, and the scope boundary.
2. FSD record for ruling 10 (multi-location strategy) + the strategy reversal it
   implies for every DEFER in the locations cluster.
3. FSD record for ruling 12 (execution-model change + Postgres-decision-this-quarter),
   superseding feature-selection §9's G3 parking language.
4. Design docs (one-way doors, feature-selection §6): locations schema, gift-card
   ledger, packages ledger, payment-link scope, tips meta-shape, job_outbox +
   cron_locks, allergy consent/retention matrix (ruling 9's "real legal").
5. Money-gate additions per ruling 2/4/5/6/7/8 test lists — all under
   chain-payments-billing.test.ts jurisdiction.
