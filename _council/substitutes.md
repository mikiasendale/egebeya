# Substitutes — every creative closure method this session

Rule 20 (no bare SKIP where a mechanic can be substituted) + the session's closure
patterns. Each entry: what replaces the mechanic, the named trade-off (how it's worse),
and the protected decision or constraint it works around.

## Behavioural substitutes for monetary mechanisms
(protected: COMPARE-03 #4 no-show fees, #6 wallets, never-do stored cards)

- **E-ts-03 / E-pm-05** — force full prepay on the flagged phone (per-phone,
  `crm.ts:293-337`) replaces no-show/late-cancel fee capture and per-appointment policy
  override. *Worse:* no after-the-fact charge, no per-appointment granularity. *Protected:*
  no stored instrument ever (COMPARE-03 #2/#4; AGENTS.md:27). E-pm-05's future override
  may only choose among prepay-only shapes.
- **E-mg-06 referral** — referee-only discount code through the existing promo engine,
  ZERO referrer payout. *Worse:* no two-sided incentive loop; weaker than Fresha's.
  *Protected:* loyalty gate (COMPARE-03 #9) — any referrer *reward* waits for the gate.
- **E-pm-15 refunds** — one-tap "refund issued" RECORD, never a gateway call
  (ruling 2). *Worse:* consumer waits on the merchant's honesty, not a rail.
  *Protects:* webhook-idempotency and money custody lines.
- **E-pm-09 gift cards** — merchant-funded liability recorded on-platform; money lands
  with merchant at purchase; refunds off-platform, record-only (rulings 6 + CP5-4).
  *Worse:* no platform refund rail for unredeemed cards; consumer-trust burden on the
  merchant. *Protected:* explicit CEO carve-out from COMPARE-03 #6 (wallets stay DEAD).
- **E-pm-17 taxes** — "including TOT" display from a tenant tax-% setting; capture math
  pristine (ruling 3, CP5: tax-% only). *Worse:* no itemized VAT line for accountants.
  *Protected:* COMPARE-03 #8 (no upward price surprises) + webhook parity trap (B).

## Product substitutes for infra features
(protected: single-process law G3 / feature-selection §9; ruling 12 carve-outs)

- **E-ai-05 BI connector** — RECLASSIFIED INFRA-BLOCKED → SUBSTITUTE (ruling 12):
  weekly cron writes per-tenant per-location CSV to storage + Reports download +
  existing pull endpoint. *Worse:* up to 7 days stale; no streaming sink. *Unblocks
  when:* the Postgres decision this quarter (Phase 2) says yes.
- **E-ai-03 calendar sync** — internal half: shared staff/owner calendar (the CEO's
  Gap.md:354 redefinition, rides E-ms-01/02 bundle — zero infra). External half:
  per-staff one-way ICS subscription URLs riding `public.ts:1432-1478`. *Worse:*
  external calendars never write back; double-booking against Google/Apple events
  unprevented. *Deferred until:* queue Phase 3 with C's six floors (Spec B).
- **Cron double-run (the root infra risk)** — CEO ruling 12 Option 1: `cron_locks`
  lease table + `job_outbox` rows written by the web process. *Worse than a real queue:*
  polling latency, no DLQ; *better than:* Redis at 25 tenants (B: "mispriced").
  *Floors (C):* webhook transaction untouched; eq(tenantId) in every job; markers
  before locks; channels never throw; money gate frozen during migration.

## Process substitutes for legal constraints

- **E-cm-03 intake forms** — engine DEFERRED; typed-fields-only intake (allowlisted
  question types, no free-text clinical prompts) per ruling 9 + the no-laundering rule.
  *Worse:* merchants can't author arbitrary questionnaires. *Protected:* PDPL
  special-category data doesn't leak through a text box.
- **E-ca-02 consent centre** — ships as DUTY before any send expansion; inbound STOP
  handling replaces the honor-system suffix that lies today (B). *Trade-off:* merchant
  blasts shrink to opted-in lists — that's the point, not the cost.
- **E-cm-05 merge** — merge-safety design doc first (append-only ledger re-point rules);
  per-client delete served by the existing anonymize-never-row-drop erasure matrix.
  *Worse:* no quick de-dup button. *Protected:* loyalty_ledger/notification_log
  append-only law.

## Channel substitutes for metered ones

- **E-mg-01 email campaigns** — SMS-only campaigns until SMTP is provisioned.
  *Worse:* no email builder/perf view this season. *Protected:* EGE-ADVANTAGE #2
  (unmetered messaging) — metering email to merchants would reverse it; CEO posture
  parked (C ask 7).
- **E-ai-04 Google/Meta booking** — SKIP; substitute = Telegram booking flow on the
  existing bot + shareable deep link/QR (rides E-cs-06), and the strategic direction:
  build OUT from the protected /v1 API (E-ai-01) instead of imitating big-tech panels.
  *Worse:* no presence in the places Fresha's consumer funnels live.
- **E-pm-06 terminals** — chair-side telebirr push on the merchant's own phone +
  approved counter QR (ruling 5 half). *Worse:* card-paying tourists unserved.
  *Protected:* single local rail (COMPARE-03 #10).

## Derived-data substitutes for authored entities — and when they're worse

- **E-bc-03 waitlist** — DEFER with substitute: derived reclaimed-slot visibility in
  the merchant queue console from the existing `cancels_at` sweep (`public.ts:942`).
  *Worse:* no consumer-facing proactive offer; the feature earns nothing until demand.
  *Protected:* `server/lib/queue.ts` (AGENTS.md:21) — a separate table or nothing.
- **E-ms-04 time-off types** — closures + per-weekday windows cover bookability.
  *Worse:* the WHY of an absence never on record; no approval trail.
- **E-ds-05 ratings** — NEW badge + "No bookings yet" stays the honest signal until
  E-mg-05 ships. *Worse:* consumers misread absence (D: day-1 noticed).
- **E-mg-07 boosting** — free organic quality-rank (booking counts, media, profile
  completeness) replaces alphabetical; paid boost SKIP until the labeling+policy
  ruling (CP5-11b). *Worse:* no purchasable visibility lever — *and* no review signal
  usable in the blend until E-mg-05.
- **E-ds-04 map view** — address text + existing per-site map block; lat/lng collected
  silently as a location attribute of the locations design doc (ruling 10 ripple).
  *Worse:* no proximity sort until ≥50 tenants carry coords.
- **E-bc-10 assignment rules** — DEFER; re-entry shape recorded: rules apply only to
  merchant-created + no-preference bookings; consumer-picks-staff never bypassed.
- **E-ca-01 account depth** — the advantage itself is the substitute: "your phone
  number is your ticket" (opaqueId+phone self-service, E-ca-03 SAME). *Worse:* no
  cross-device continuity or marketplace profile.
- **E-ml-01 locations** — interim: multi-shop owners run N accounts (C/D). *Worse:*
  fragmented client history and reporting — until the design doc turns the strategy
  (ruling 10) into schema.
- **E-tp-02 custom roles** — staff-visibility settings inside the three fixed roles.
  *Worse:* enterprise permission checklists stay unchecked.
- **E-ar-04 ad pixels** — owned `?src=` attribution riding the existing
  `appointments.bookingSource` column. *Worse:* no ad-platform conversion signals —
  fine, because Season 0 runs no paid acquisition.

## The three the council could NOT substitute (honest register)

- **E-pm-06 card-present for tourists** — telebirr push is not a card reader. No
  product answer inside the rails; recorded as market-shape limitation.
- **E-bc-04 true group booking capacity** — one-customer-N-services is a workaround,
  not a substitute: it cannot express per-seat capacity. Re-entry coupled to locations
  design doc.
- **E-ml-02 chair-renter payout** — attribution ships (ruling 10 + record-only half);
  payout machinery is CEO-struck (E-pm-20) and stays struck. *Worse:* renters trust
  the merchant's own math from the platform's ledger printouts.
