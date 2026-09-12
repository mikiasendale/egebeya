# Council Position Paper — Subagent C (strategy / legal / money)

Date: 2026-09-12 · Scope: the 68 in-scope Gap.md rows (E-pm-12, E-pm-20 struck; not debated).
Lawbooks: AGENTS.md (never-do = law) · COMPARE-03 (12 protected) · COMPARE-02 (17 EGE-ADVANTAGE)
· docs/loyalty-opening.md (gate + override template) · _council/kb-ground-rules.md (rules 1–20).
Every claim OBSERVED (tree/file) or INFERRED (absence ledger / KB gap); confidence H/M/L per rule 3.
Surfaces named per rule 1: **consumer marketplace (CM)** / **merchant SaaS (MS)** / **platform (PL)**.

Standing precondition (OBSERVED, H): `render.yaml` still ships `ALLOW_UNVERIFIED_PAYMENTS="true"`
(repo-map infra_constraints; FSD-001 §3). **Every RED money verdict below is independently blocked
until that flag is off.** Money integrity before money features.

---

## 1. Positions on all 68 features, by Gap.md section

### discovery-search (CM surface)

**E-ds-01 — Category expansion (14 verticals) | GREEN-with-conditions | MS+CM**
CEO-confirmed scoping (ground rules, Checkpoint 1). Conditions: all 14 strings in am.json AND
en.json same commit (AGENTS.md:36, law); hubs must honor the dark-site gate (EGE-ADV #11,
public.ts:339-398) — a vertical hub may not list a shop whose hours are unconfirmed; category
packs exist (`server/lib/siteTemplates.ts:39-82`) so supply side is ready. Collision: NO.
Do NOT replicate Fresha's 1,141-page category×geo programmatic machine — a solo operator shipping
doorway pages invites the SEO-GAP-10 trust penalty and can't service them. Confidence: HIGH.

**E-ds-02 — Treatment-level search | AMBER-with-conditions | CM**
Build treatment as a searchable label on existing service rows, not a new canonical entity with
its own pricing/SEO page grammar. Condition: search stays inside `/api/public/discover`
(public.ts:113-117) with inline `eq(tenantId)` intact (AGENTS law). Collision: NO, but the
treatment×geo page grammar (rule 18, 16 templates) is Fresha's distribution engine — Egebeya's
door opens only when real treatment inventory density exists; a grammar without inventory is
slop. Confidence: MEDIUM (merchant-app behavior unobserved, KB GAP 10).

**E-ds-03 — Neighbourhood scoping | AMBER-with-conditions | CM**
Structured sub-city text zones are fine; the current free-text substring on settings JSON
(public.ts:106-111) is the liability to fix. Condition: no lat/lon collection from consumers
(PDPL data-minimization); the gazetteer redesign is already parked at `EXECUTION_PLAN.md:442`
per LEDGER G2. Collision: NO. Confidence: HIGH.

**E-ds-04 — Map view | RED (rails) | CM**
G2-dead per LEDGER.md:65 — no coordinates collected anywhere; no geocoding rail. Rule 20:
substitute = sub-city zone browsing + "near Bole" textual badges. Named trade-off: no proximity
sort; consumers trade map-scan for zone-scan, acceptable in Addis where sub-city is the mental
map. Confidence: HIGH.

**E-ds-05 — Aggregate rating display | AMBER (dependency-blocked) | CM**
Nothing to aggregate — reviews table does not exist (schema scan, OBSERVED). Sequence after
E-mg-05. Condition when it lands: score+volume printed together (07-TRUST-MECHANICS2 rating
rules) and evidence hygiene — review counts must exclude demo tenants
(`server/lib/demoTenant.ts:63-95`). Collision: NO directly; inherits E-mg-05's UGC duties.
Confidence: HIGH.

**E-ds-06 — Price-visible menus pre-booking | GREEN-with-conditions | CM**
Prices already render on tenant page + booking flow (public.ts:428-440); directory cards need
the same read. ETB-only display preserved (COMPARE-03 #12). JSON-LD priceRange = Fine. Collision:
NO. Condition: card price must be the *starting* price honestly (min over active services), not
a promo bait that then recomputes at checkout via quiet-hours (public.ts:847-864). Confidence: HIGH.

**E-ds-07 — Same-day availability surfacing | GREEN-with-conditions | CM**
Availability is already computed per day (public.ts:477-591, OBSERVED); surface a boolean
"opens today" badge. Conditions: N×directory reads must not fan out full availability queries —
cache per tenant-day; all day-math on fixed Addis UTC+3 (`server/lib/timezone.ts:1`, EGE-ADV #8).
Collision: NO. Confidence: HIGH.

### booking-core (CM + MS)

**E-bc-03 — Waitlist | AMBER-with-conditions | CM**
Do NOT import Fresha's appointment-shaped waitlist as a parallel construct — the chair-shaped
queue is EGE-ADV #5/#6/#7 (COMPARE-02 §B) and AGENTS.md:21-22 forbids touching queue derivation.
Shape it as T7.7 already ledgered (LEDGER:28): a *reclaimed-slot offer list* derived from
cancelled/expired appointments (public.ts:942 cancelsAt sweep), no queue.ts refactor. Collision:
YES-if-built-as-Fresha-does-it — protects EGE-ADV #5. Confidence: HIGH.

**E-bc-04 — Group bookings | AMBER-with-conditions | MS**
One booker, N seats. Condition: rides the same BEGIN IMMEDIATE conflict transaction
(public.ts:731-734, 896, 902-914 — repo-map constraint: booking correctness is app-enforced);
per-seat capacity is a new constraint the single-writer model does not have today. Money: none
(one consumer pays effectiveAmount, prepay-only preserved, COMPARE-03 #3). Collision: NO.
Confidence: MEDIUM (local demand for group booking unobserved — telemetry GAP 10).

**E-bc-06 — Service sequencing | AMBER (defer) | MS**
Ordered steps + resources need an entity model that fights the fixed-30-min grid
(public.ts:571) and depends on the same `expandSeries()` extraction that blocks T7.15
(LEDGER:27). Strategic substitute already live: multi-service sums into one contiguous block
(public.ts:798-800, OBSERVED) — covers the salon "cut-then-colour" job. Named trade-off: no
mid-appointment staff handoff. Revisit after E-ms-01/E-ms-05 land. Collision: NO. Confidence: HIGH.

**E-bc-07 — Statuses & notes | AMBER-with-conditions | MS**
Status lifecycle exists (schema appointments.status, OBSERVED); notes column is new
consumer-record data → PDPL register row: merchant-authored notes about a person are their
personal data; erasure matrix must anonymize/delete notes (see §4). Condition: notes never
carry allergy/clinical text (route to E-cm-02's ruling). Collision: NO. Confidence: HIGH.

**E-bc-08 — Reschedule (merchant drag) | GREEN-with-conditions | MS**
Client self-serve path already exists and validates server-side (public.ts:1293-1369, OBSERVED —
including the multi-service duration fix). Drag UI must call the same conflict-checked endpoint;
never trust a client-sent endTime. Condition: reschedule of a *paid* booking must not re-charge
or silently re-price — effectiveAmount at booking time is the ledger truth. Money-path CAUTION:
add a chain test that reschedule leaves payments rows untouched. Collision: NO. Confidence: HIGH.

**E-bc-09 — Cancellation reason capture | GREEN-with-conditions | MS**
No money moves (ground-rules register already notes: reason→policy, no money). Condition: the
reason must NEVER become a gate for a fee/charge — COMPARE-03 #4 protects behavioural-only
no-show/late-cancel defence (crm.ts:293-337 force-prepay is the sanctioned deterrent). Collision:
YES-if-reason-gates-money. Confidence: HIGH.

**E-bc-10 — Assignment rules | AMBER-with-conditions | MS**
Round-robin/seniority conflicts with the marketplace's explicit staff pick (E-bc-02 SAME,
public.ts:441-465 — consumers here choose their stylist; that is the trust model). Shape:
rules apply only to merchant-created bookings (walk-in, phone-in, E-ms surfaces) and
"no-preference" marketplace bookings. Collision: NO if consumer pick stays first-class.
Confidence: MEDIUM.

**E-bc-11 — Online availability controls | GREEN-with-conditions | MS+CM**
Per-service sellable-online flag + lead/max-notice windows, enforced in `assertSlotAllowed`
(public.ts:802, OBSERVED path). Condition: min-notice must compose with the pending-payment
slot-expiry reclaim (sendReminders expired-slot sweep) — do not create windows where a slot
is bookable but always expires unfunded. Collision: NO. Confidence: HIGH.

### payments-money (MS + CM; all rows money-path CAUTION, rule 6)

**E-pm-05 — Per-appointment policy override | AMBER-with-conditions | MS**
Override allowed only between *none* and *FULL prepay* (the existing two states,
public.ts:807-814, OBSERVED). A fractional-deposit override would directly reverse COMPARE-03 #3
(prepay-only, never a fraction) — protected, not reopenable this session without CEO ruling.
Money-path: new test in chain-payments-billing.test.ts pinning "override ∈ {0, effectiveAmount}".
Collision: YES if partial deposits sneak in. Confidence: HIGH.

**E-pm-06 — Card terminals | RED (rails) | MS**
G2-dead per LEDGER:62 — no card-present rail; chapa.ts exposes exactly initialize/directCharge/
authorize/verify (OBSERVED, 173 lines). Terminal hardware + acquiring = NBE-adjacent license
surface (COMPARE-03 #10 protected). Rule 20 substitute: QR of the Pay-Now link (E-pm-07) at the
counter covers the same job on telebirr rails. Trade-off named: card-paying tourists/corporate
cards unserved. Confidence: HIGH.

**E-pm-07 — Pay links / QR / self-checkout | RED-needs-CEO-ruling | MS**
This MOVES money outside a booking — LAW 5 in the ground-rules register: every "move" is CEO
territory. Mechanics would reuse the directCharge flow (chapa.ts:81-136) + existing webhook,
and MUST route through `processed_webhook_events` idempotency exactly as bookings do (AGENTS
never-do: don't touch webhook idempotency — the feature must conform to it, not fork it).
Options for the CEO: (a) merchant-amount links with booking-less payments rows (new
`payment_kind`), (b) defer until refunds (E-pm-15) semantics settle, since a link sale that must
be refunded hits the same missing refund rail. Collision: NO direct, but it dilutes "money moves
only inside a booking" clarity that advantage §A rests on. Confidence: HIGH on exposure, MEDIUM
on Chapa link capability (INFERRED — rail docs not in corpus).

**E-pm-08 — Tips | RED-needs-CEO-ruling | CM+MS**
COMPARE-03 §"What is NOT in this file" confirms tips are unprotected. But the economics are a
trap: a tip added to effectiveAmount (public.ts:877, OBSERVED no gratuity term) flows to the
*merchant's* Chapa account; staff then expect payout — and platform payout is exactly
COMPARE-03 #7 (no custody, no payout engine). Options: (a) tip rides the merchant push with an
explicit "settle to your staff offline" disclosure — platform never attributes or routes tips;
(b) build after T7.10's staff-attribution prerequisite (LEDGER:29 — "needs a staff-attribution
decision first"); (c) no tip UI on-platform. Silent-reversal risk if ignored: published posture
has zero platform money-movement beyond subscription. Confidence: HIGH.

**E-pm-09 — Gift cards | RED-needs-CEO-ruling | CM+MS**
Stored value is the one shape of money COMPARE-03 #6 + AGENTS.md:27 (no wallets) killed for
*platform-held* balances. A **merchant-funded gift code** (value lives as the merchant's
liability; platform only issues/redeems a code, like promo_codes with a value column —
schema.ts:302-318 shape, OBSERVED) is arguably NOT a wallet. That reading needs a recorded CEO
decision in the docs/loyalty-opening.md pattern, not a stealth reclassification. If approved:
redemption ledger = money-recorded (chain test; redemption must floor at zero like
effectiveAmount), buyer+recipient phones are PII (PDPL §4), expiry never (consumer-protection
posture in ET market — no expiry = no breakage liability, trade-off: merchant float risk).
Collision: YES with #6 unless the ruling separates merchant-liability codes from platform
balances. Confidence: HIGH on exposure.

**E-pm-11 — Packages & bundles | RED-needs-CEO-ruling (via gift-card sibling) | MS**
Prepaid visits = deferred merchant obligation + refund-of-partially-used problem, which is
E-pm-15's missing rail pointed at the consumer. Options: (a) ship after refund semantics ruled,
(b) "visit-credit" as merchant-tracked record (no money move at redemption, discount-at-charge
like loyalty's `pendingRewardDiscount` pattern — public.ts:866-877, OBSERVED). (b) preserves
posture: money moves once, at purchase, inside the booking rail. Named trade-off: redemption
path must then allow effectiveAmount → 0 charge (a "free" visit) — the Math.max(0,…) floor
already permits this (public.ts:877). Collision: NO if discount-at-charge; YES if a balance.
Confidence: HIGH.

**E-pm-15 — Refunds | RED-needs-CEO-ruling + one mandatory fix | CM+MS**
Two separate things the debate must not blend. (1) **The lie**: Landing ticket promises
"Refunded automatically if the business cancels" (en.json:63, OBSERVED) while cancel says
"A refund must be issued manually by the business" (public.ts:1283-1285, OBSERVED). A public
claim the code contradicts is a DUTY per LEDGER:20 (T7.9), not a feature choice — fix the copy
or make it true; consumer-protection + PDPL-fairness exposure either way. (2) **The rail**:
chapa.ts exposes no refund call (OBSERVED); whether Chapa offers a refund API is absence-ledger
territory (INFERRED, L-confidence on cadence). CEO options: (a) copy fix only (manual stays),
(b) verify-then-instruct flow (platform records refund-owed, merchant executes in Chapa
dashboard, platform reconciles via settlement rows — money *recorded*, not moved), (c) full
API refunds (needs Chapa capability + chain tests + custody posture review). Recommend (a)+(b).
Collision: NO with COMPARE-03 (refunds explicitly unprotected), but (c) flirts with #1/#7
if Egebeya ever becomes the refunding party. Confidence: HIGH on the contradiction, LOW on
Chapa refund availability.

**E-pm-16 — Void / raise / edit sale; receipts | AMBER-with-conditions | MS**
Platform invoices exist for *subscription* charges only (tenant.ts:720-836, schema invoices,
OBSERVED); booking "receipts" are tickets, not a ledger. Building a sale-level ledger is
money-recorded (allowed, cf. E-pm-18 precedent) but must never mutate settled payment rows —
void = compensating entry, append-only discipline like loyalty_ledger (accountDeletion.ts:44-49,
OBSERVED pattern). Condition: receipts keep Amharic-first ("ደረሰኝ", COMPARE-02 #9). Collision:
NO. Confidence: HIGH.

**E-pm-17 — Taxes / service charges | RED-needs-CEO-ruling (narrow) | MS**
Today charged = price − discounts floored at zero (public.ts:877, OBSERVED). Adding an ADDITIVE
line changes the capture amount the webhook verifies against (chain-webhook-amount test exists —
repo-map services, OBSERVED), and service charges edge toward dynamic price-up semantics that
COMPARE-03 #8 killed *as a platform behaviour*; a merchant-declared tax line is different from
surge pricing, but the ruling must say so explicitly. Options: (a) display-only "prices include
TOT" per Ethiopian convention (zero money-semantics change — recommend), (b) additive line at
capture (money-path: new chain test, webhook-amount parity, ETB-only preserved). Collision:
YES-if-(b)-without-ruling. Confidence: HIGH.

**E-pm-18 — Offline/cash recording | AMBER-with-conditions | MS**
COMPARE-03 §NOT-in-file: cash recording is unprotected; payments.method enum anticipates it
(schema.ts:180-181, OBSERVED). This RECORDS money (allowed). Conditions: offline rows must be
visibly excluded from settlement reconciliation (settlements.ts:25-47 tracks gateway truth —
cash has none) and from gate metrics/north-star if they'd inflate (AGENTS:24-25: never fabricate
gate metrics — cash rows counted as completed bookings could push the loyalty gate; the gate
counts appointments, not payments, but the funnel must be checked: confirmed-appointment credit
for an offline sale is real business, yet must be flagged `method='cash'` everywhere downstream).
Never lets a cash row mark a pending Chapa payment completed. Collision: NO. Confidence: HIGH.

**E-pm-19 — Merchant credit | RED (keep deferred) | PL**
Gap.md:119 itself records the deferral pending data + licensing. Lending is a licensed NBE
activity; Egebeya holding repayment flows via platform = custody-adjacent (#1/#7 territory).
Not a ticket; returns with a license conversation (same pattern as the Ethio Telecom issuer
meeting in LEDGER:38). Collision: YES with licensing posture. Confidence: HIGH.

### consumer-account (CM)

**E-ca-01 — Account & profile | GREEN-with-conditions | CM**
Bookings list + profile editor on the existing phone-keyed JWT (consumer.ts, OBSERVED).
Condition: the Fresha description says "wallet" — the wallet half is COMPARE-03 #6, DO-NOT-BUILD;
ship bookings/profile only. New editable fields join the erasure matrix (§4). Collision:
YES-if-wallet-creep. Confidence: HIGH.

**E-ca-02 — Preference centre | GREEN — classify as DUTY, ship before marketing expansion | CM**
PDPL 1321/2024 makes withdrawal-of-consent a right, not a rankable feature (LEDGER:19 already
flags T7.12 as DUTY?). Today only the merchant can toggle opt-in (crm.ts:246-291, OBSERVED) —
that is backwards for PDPL. Conditions: consumer-side toggle + STOP handling with recorded
timestamps; `marketing_opt_in` stays real consent only (loyalty-opening.md Do-Not: never
fabricate); gate E-mg-01 blasts and E-an-06 marketing sends on it. EGE-ADV #13 (PDPL-as-product)
is *strengthened*, not collided. Confidence: HIGH.

### client-management (MS)

**E-cm-01 — Client profiles & history | AMBER-with-conditions | MS**
Derived stats already exist (customer_stats, OBSERVED); the authored-record half is T7.11
(LEDGER:24: "schema + PDPL erasure surface"). Sequence: erasure design lands in the same PR as
the first authored field. Collision: NO. Confidence: HIGH.

**E-cm-02 — Allergy & patch-test | RED-needs-CEO-ruling (PDPL special-category) | MS**
This is HEALTH DATA about consumers under PDPL 1321/2024 — the single largest legal exposure
in the 68-row scope. Current tree has zero clinical fields (OBSERVED). Options: (a) don't store:
patch-test outcomes as a checkbox + free-text prohibition ("kept on the shop's paper card"),
(b) store with explicit separate consent at capture, purpose-limitation (visible only to staff
on that appointment), retention rule tied to visit history, and erasure-matrix row. Even (b)'s
minimum viable: breach-notification stakes rise the moment allergies sit in a booking DB.
Recommend CEO ruling before any code; do NOT let a build slip in as "a notes field". Collision:
NO with COMPARE-03; heavy with PDPL. Confidence: HIGH.

**E-cm-03 — Custom intake forms | AMBER-with-conditions | MS**
Custom fields = arbitrary PII capture (health answers arrive in "any questions?" boxes —
laundering E-cm-02 past its ruling). Conditions: question-type allowlist (no free-text clinical
prompts), per-form retention label, answers stored phone-keyed → erasure matrix, and the fixed
zod booking capture (PublicBooking.tsx:15-23) stays the identity contract. Collision: NO.
Confidence: MEDIUM.

**E-cm-04 — Tags & segments | AMBER-with-conditions | MS**
Health tags are computed (customer-health.ts:27, OBSERVED) — free-form tags become a shadow
clinical record. Condition: tags are marketing/behaviour vocabulary; a moderation heuristic +
doc rule against clinical text in tags. Segments feed campaigns only after E-ca-02 exists.
Collision: NO. Confidence: HIGH.

**E-cm-05 — Import/export/merge/delete | AMBER-with-conditions | MS**
Import = bulk third-party PII intake: merchant warrants consent (DPA-language in the import UI),
platform is processor; export gets a UI (endpoint is live, dead surface per repo-map
dead_surfaces:4 — free win); MERGE is the dangerous one: customer_stats PK is
(tenantId, phone) and loyalty_ledger is append-only with phone keys (OBSERVED,
accountDeletion.ts:44-49) — merging phones must not orphan punches or double-count spend, and
per-client delete must reuse the anonymize-not-delete money pattern. Collision: NO.
Confidence: HIGH.

**E-cm-06 — Files on client profiles | AMBER-with-conditions | MS**
Media library is tenant-scoped (schema.ts:217-225, OBSERVED); a customer FK is additive.
Conditions: consent-form photos are *the* legal record pair to E-cm-03 answers — retention
differs (keep signed consent, purge clinical photos on request); file-type/size limits; erasure
matrix must delete customer-linked media objects, not just rows. Collision: NO. Confidence: HIGH.

**E-cm-07 — Block clients | AMBER-with-conditions | MS+CM**
The inverse vector of consumer→merchant blocks (trust.ts:110-152, OBSERVED). Conditions:
(a) transparency — a blocked consumer MUST learn they're blocked at booking time with a stated
reason + platform-appeal route; a silent block is a PDPL fairness/automated-decision problem
and a dark-pattern accusation Egebeya's trust brand (EGE-ADV #12, #13) cannot afford; (b) block
is tenant-scoped refusal, not a platform-wide identity action; (c) block record lives platform-side
with appeal — note this is deliberately the *opposite* of the report-a-merchant evidence rule
(#12): there the accused must not hold the evidence; here the accused IS the consumer and due
process says tell them. Collision: NO; complements EGE-ADV #12. Confidence: HIGH.

### merchant-scheduling (MS)

**E-ms-01 — Smart calendar | GREEN-with-conditions | MS**
Data exists; it's a render + drag surface over /api/bookings. Conditions: low-end Android law
(COMPARE-02 #10 — a 7×N grid on a deviceMemory<2 phone must degrade to the current day-list,
motionGuard pattern); both locales; drag commits go through server conflict checks (as E-bc-08).
Collision: NO. Confidence: HIGH.

**E-ms-02 — Shifts / rosters | AMBER-with-conditions | MS**
Staff availability rows exist (staff_availability, OBSERVED); publishing them to staff logins is
read-scoping, not new entity. Conditions: staff see only their tenant's roster (inline eq(tenant)
law applies to every new query); no compensation surfaces ride along (E-tp-04 boundary).
Collision: NO. Confidence: HIGH.

**E-ms-03 — Blocked time & breaks | GREEN | MS**
The closure table is write-orphaned (dead_surfaces, OBSERVED: enforced at read, no writer);
T7.6 is scored 22/WAITING (LEDGER:18). Ship the write endpoint + UI. Condition: after closures
become real, update the quiet-hours fill-rate honesty note (analytics.ts:252-255 — closures
*still* not subtracted; keep the caveat true or fix the denominator, never let it drift silently).
Collision: NO. Confidence: HIGH.

**E-ms-04 — Time-off types | AMBER-with-conditions | MS**
Employment-adjacent PDPL: absence types that encode health status (sick vs leave) are staff
special-category data. Condition: types are non-medical labels only; request/approval log is
tenant-scoped and staff-visible-to-self. Collision: NO. Confidence: MEDIUM.

**E-ms-05 — Buffers / extra time | AMBER (dependency-blocked) | MS**
T7.15 is BLOCKED on T6.4 expandSeries extraction (LEDGER:27). Every duration change touches the
fixed 30-min grid (public.ts:571), ETA maths (queue.ts:100-114), and overlap checks — that is
booking-correctness territory; regression-suite-first, queue.ts read-only per AGENTS:21-22.
Collision: YES-if-it-touches-queue-derivation. Confidence: HIGH.

### multi-location (MS + PL)

**E-ml-01 — Multiple locations | RED-needs-CEO-ruling (schema law) | MS**
One tenant = one location is structural: `tenants.slug` unique, every query carries inline
eq(tenantId) (AGENTS law). A location entity is either a parent-above-tenant refactor (touches
all 41 tables' tenancy semantics) or intra-tenant scope (touches every booking/availability read
in public.ts). Both are schema-migration events with money-path parity requirements. This is
also the honest downstream of the DB decision in Gap.md:401-411 — if multi-location is the
strategy, the Turso single-writer ceiling matters now, not later. Recommend: rule the *want*
first (Season 0 was density-first per ROADMAP:23 "one vertical with paying density"); defer the
build. Collision: NO; prerequisite for E-ml-03. Confidence: HIGH.

**E-ml-02 — Independent merchants / workspace | RED-needs-CEO-ruling | MS**
Chair-rental is a real Addis structure. The safe half — *attributing* a sale to a person — is
money-recorded (bookingSource precedent, schema appointments.bookingSource, OBSERVED). The
dangerous half — splitting/paying money between renter and shop through Egebeya — is wallet/
payout custody, COMPARE-03 #7 territory. Options for CEO: attribution-only ledger (recommend),
or deferred to the payouts conversation. Silent-reversal risk: attributed sales read as
"Egebeya settles between parties." Collision: YES-at-payout-half. Confidence: HIGH.

**E-ml-03 — Cross-location operator view | RED (defer) | MS+PL**
Meaningless before E-ml-01; the superadmin console (admin.ts:42-568) is platform-operator, not
shop-operator (OBSERVED distinction in COMPARE-01). No substitute needed beyond the honest
answer: multi-shop owners today run N accounts. Collision: NO. Confidence: HIGH.

### trust-safety (CM + PL)

**E-ts-02 — Report/reply to reviews | AMBER (dependency-blocked) | CM+PL**
No reviews table exists (OBSERVED) — nothing to moderate. Sequence after E-mg-05 and inherit
its duties: platform holds report evidence away from the accused merchant (EGE-ADV #12,
schema.ts:525-542 rationale), stated SLA like the 7-day report path (trust.ts:75-79, OBSERVED).
Collision: NO. Confidence: HIGH.

**E-ts-03 — No-show policy engine | PROTECTED-DO-NOT-TOUCH (monetary half) | MS**
The row's own text says monetary fee capture is prohibited by design — COMPARE-03 #4 (#2 for the
instrument). What the debate may still open: making the *behavioural* half configurable (the
no-show threshold that flags a phone into crm.ts:293-337 force-prepay is currently computed —
surfacing the threshold as merchant setting is policy config, still zero money movement).
Flagging: any proposal that re-opens fees = protected-item reopen request, CEO ruling required.
Collision: YES — this row will attract fee-capture proposals. Confidence: HIGH.

### marketing-growth (MS + CM)

**E-mg-01 — Blast campaigns (email & text) | AMBER-with-conditions | MS**
SMS blast exists (crm.ts:182-244, "Reply STOP", Pro gate, OBSERVED); email campaigns would
introduce the platform's first per-send *cost* against EGE-ADV #2 (unmetered messaging —
COMPARE-02 §A2, the moat that "every automation Fresha charges per send, Egebeya gives away").
Options in §3/§5. Conditions regardless of cost posture: (a) E-ca-02 consent centre ships
FIRST (blasting without consumer withdrawal = PDPL exposure on a marketing surface);
(b) the >10k bulk throttle stays parked per LEDGER:50 unless the queue to-do lands;
(c) mailer stub-truth bug (mailer.ts:31-34 records stub sends as success, OBSERVED §G caveat)
must be fixed before any email performance claim, else delivery stats lie;
(d) merchant-authored email content = consumer-facing UI → consume telegram-config pattern
doesn't apply but the "failures logged never thrown" rule (AGENTS) does. Collision:
YES-if-metered-to-merchant (reverses #2/#12 published posture). Confidence: HIGH.

**E-mg-02 — Deals & promotions | AMBER-with-conditions | MS**
Promo engine exists (schema.ts:302-318 + validation in public.ts:816-845, OBSERVED); flash
deals = time-windowed promos, additive discounts only — the Math.max(0,…) floor and
down-only direction (COMPARE-03 #8 protects the direction: discounts fill idle, no surge).
Condition: deal-performance view rides E-ar-02. Collision: NO. Confidence: HIGH.

**E-mg-05 — Review engine | AMBER-with-conditions | CM+MS**
Post-visit review invites ride free messaging (no #2 collision — transactional, not marketing).
New duties land with it: (a) consumer-authored public UGC — deletion of a consumer must delete
their reviews (erasure matrix, §4); (b) fake-review and extortion-review moderation is a
standing labour cost for a solo operator — honestly price that; (c) static testimonials on
tenant pages (puck.config.tsx:303, OBSERVED) must be visually separated from real reviews or
the trust surface is decorative. Google sync deferred (no rail in corpus, rule 9 INFERRED).
Collision: NO, but sequencing rule: after E-ca-02. Confidence: MEDIUM (merchant-app review UI
unobserved, KB GAP).

**E-mg-06 — Referral program | PROTECTED-DO-NOT-TOUCH (reward half) | CM**
Ledger:30 and LEDGER:41: loyalty tiers/expiry/referral depth return only when the gate opens on
real numbers (AGENTS:24-25; COMPARE-03 #9). A referrer *reward* is a loyalty-adjacent money
promise — building it while the gate is closed is "a law violation dressed as product work"
(COMPARE-03 §why, verbatim risk). Rule 20 substitute available today: supply-side
`acquiredViaCode` mechanism (tenants.acquiredViaCode, OBSERVED) extended to a referee discount
code (promo engine) with zero referrer payout; named trade-off: no two-sided loop → weaker
incentive. Collision: YES with #9. Confidence: HIGH.

**E-mg-07 — Marketplace visibility boosting | RED-needs-CEO-ruling | CM+PL**
Selling rank is a new monetization posture (not a booking %, so COMPARE-03 #1 isn't violated —
but it converts the directory's alphabetical honesty (public.ts:120-191, ORDER BY name, OBSERVED)
into an auction, and thin-supply boosting sells air: a boosted unfinished shop contradicts
EGE-ADV #11's dark-site promise and poaches the trust sequence (07-TRUST §BT_CITY facts).
Options: (a) defer; (b) free quality-rank (photo, confirmed hours, service count) — ranks toward
exactly the activation funnel E-ar-03 gates; (c) paid boost with "Promoted" labels +
profile-quality floor. Recommend (b) now, (c) only as a post-density revenue ticket.
Collision: YES-if-paid-boost-without-quality-floor. Confidence: HIGH.

### automation-notifications (MS + CM; rule 13: the catalog is one system)

**E-an-01 — Merchant-set reminder lead time | GREEN | MS**
T7.2 shortlist 22 (LEDGER:16). Current window is hardcoded now+2h..2h30 (sendReminders.ts:51-52,
OBSERVED class in COMPARE-01). Condition: `reminderSent` flag idempotency preserved
(sendReminders.ts:63,148, repo-map crons, OBSERVED); a merchant-set window must not schedule
reminders inside quiet hours. Templates in both scripts (EGE-ADV #9 — Amharic-authored).
Collision: NO. Confidence: HIGH.

**E-an-03 — Reschedule/cancel notices | GREEN-with-conditions | MS**
Transitions exist, templates don't (mailTemplates.ts:9-44, OBSERVED). Conditions: notify() never
throws (AGENTS law); cancel notice for a paid booking must state the *manual* refund truth —
do not template-write "refund on its way" while E-pm-15 is unresolved (same lie as en.json:63).
Collision: NO. Confidence: HIGH.

**E-an-04 — Lifecycle messages ×5 | AMBER (split) | MS**
Ship now: did-not-show (behavioural tone, no fee language), thank-you-for-visiting (pairs with
E-mg-05 when reviews arrive), slot-available (pairs with E-bc-03's reclaimed-slot shape).
Defer: thank-you-for-tipping (upstream E-pm-08 ruling), waitlist-joined (upstream E-bc-03).
Rule 13: build the template registry + trigger table once, as a set. Collision: NO.
Confidence: HIGH.

**E-an-06 — Birthday/welcome/milestone/reward-loyal | AMBER (split) + one PROTECTED part | MS+CM**
Welcome (T7.1) and milestone = discount-bearing messages → consent-gated (E-ca-02 first) and
money-path CAUTION (the single-use recipient-locked code pattern from win-back already
complies — runWinbackAutomations, OBSERVED). Birthday requires capturing birth date — new PII
for marketing purpose only → explicit consent at capture + erasure row (§4).
**Reward-loyal message: PROTECTED-DO-NOT-TOUCH** while the gate is closed (COMPARE-03 #9;
firing a "you earned points" message off a dark engine is fabricating the appearance of the
program, AGENTS:24-25 territory). Collision: YES on the loyal half. Confidence: HIGH.

### analytics-reporting (MS + PL)

**E-ar-01 — Render merchant analytics | GREEN | MS**
Pure render of an endpoint that already computes (tenant.ts:450-546 fetched-and-never-rendered,
OBSERVED dead surface). T7.8 shortlist 23 (LEDGER:14). Conditions: demo/seed exclusion preserved
(analytics demo-exclusion pattern, OBSERVED); am/en labels. This is the cheapest honesty win in
the 68 — it stops the dashboard from *looking* dead. Collision: NO. Confidence: HIGH.

**E-ar-02 — Automation performance | GREEN-with-conditions | MS**
notification_log (schema.ts:438-450, OBSERVED) + delivery-ledger advantage EGE-ADV #10 already
carry the raw material; per-message/per-template aggregates from refType are additive queries,
tenant-scoped. Condition: success-rate claims must inherit the mailer-stub caveat until
mailer.ts:31-34 is fixed (EGE-ADV §G honesty, OBSERVED). Full attribution lands better after the
job ledger in the infra to-do. Collision: NO. Confidence: HIGH.

**E-ar-04 — Source attribution + ad pixels | AMBER (split) | CM+MS**
Attribution half: `appointments.bookingSource` column already exists (schema, OBSERVED) —
surface it per booking (T7.16, LEDGER:26 notes it's worth more when paid acquisition exists;
Season 0 forbids that — attribution is still free and honest). Pixel half (GA/Meta): third-party
tracking on consumer pages with no consent banner is PDPL exposure + cross-border transfer —
RED-needs-CEO-ruling before any tag ships. Collision: NO. Confidence: HIGH.

### team-permissions (MS)

**E-tp-01 — Staff profiles (bio/image) | GREEN-with-conditions | MS**
Columns exist; UI picker missing (StaffPage.tsx:35-36, OBSERVED dead type surface). Upload path
exists (tenant.ts:1401). Conditions: staff photos = employee personal data → consent at hire-
onboarding + deletion on staff delete (verify media cleanup in the delete path lands in same PR);
marketplace-visible bio text = UGC on a consumer surface — same hygiene as E-mg-05 lite.
Collision: NO. Confidence: HIGH.

**E-tp-02 — Custom permission roles | AMBER (recommend defer) | MS**
Three fixed roles with server-side checks (schema.ts:31 + middleware/auth.ts, OBSERVED) is an
auditable security posture; a per-member matrix multiplies auth-bug surface for a solo codebase
where one missed check is a tenant-isolation breach (the inline-eq law exists because isolation
is existential). Substitute: ship "staff visibility" settings (which nav/data a staff login
sees) *within* the fixed roles. Trade-off: enterprise-ish checklists unchecked. Collision: NO.
Confidence: HIGH.

**E-tp-03 — Timesheets / clock in-out | AMBER-with-conditions | MS**
Employment records: PDPL register entry; purpose = schedule management only, and clock data
must NOT be silently used as wage computation input (E-tp-04 boundary; and it must not leak
into platform metrics). Collision: NO. Confidence: MEDIUM (labour-law evidentiary role of
timesheets in ET unresearched here — flag for owner counsel).

**E-tp-04 — Wages, commissions, per-member pricing | RED-needs-CEO-ruling | MS**
Wage data is the highest-sensitivity employee PII a booking SaaS can hold, and commissions are
the ledger half of pay-runs (struck) plus the staff-attribution prerequisite tips needs
(LEDGER:29). Recording-only is defensible; anything resembling platform computation invites
"Egebeya controls my stylists' pay" perception that poisons the marketplace supply trust.
Options: (a) defer entirely, (b) merchant-owned encrypted-at-rest notes with export, (c) full
model — recommend (a) until (b) has a counsel-reviewed PDPL basis. Collision: NO; adjacent to
#7 if payouts ever attach. Confidence: HIGH.

**E-tp-05 — Invite/archive/suspend/offboard | GREEN-with-conditions | MS**
Invite+delete exist (tenant.ts:129-260, OBSERVED); archive-with-history is a soft-delete flag
+ tokenVersion kill (users.tokenVersion exists, OBSERVED). Condition: appointment attribution
(staffId) survives archive — history intact is the whole point; delete path keeps working.
Collision: NO. Confidence: HIGH.

### content-site (MS + CM)

**E-cs-05 — Custom domain | AMBER-with-conditions | MS**
The gap named is DNS-ownership verification (tenant.ts:406-448 format-check only, OBSERVED):
an unverified domain claim is a takeover vector (point a competitor's domain at platform infra /
cert issuance abuse). Condition: TXT challenge before serving, idempotent migration for any new
column (AGENTS:38 — guarded plain ADD COLUMN). Domain *purchase* = RED (registrar rail, money
move outside booking — and E-pm-07's ruling covers the payment mechanic first). Collision: NO.
Confidence: HIGH.

**E-cs-06 — Book button / QR / one-link | GREEN-with-conditions | CM**
Embed + share links exist (EmbedBooking.tsx, OBSERVED); QR is client-side encoding of the
tenant booking URL — no new data, no PII in the URL (no phone/token in QR payloads). Condition:
QR works on the low-end Android share flow (EGE-ADV #10). Collision: NO. Confidence: HIGH.

### api-integrations (CM)

**E-ai-04 — Google Reserve / Meta booking | RED (rails) | CM**
LEDGER:64 G2-dead: the integrations don't exist for this market (and EGE-ADV #17 already makes
Egebeya API-*out*, not API-dependent-in). Rule 20 substitute: the Ethiopian social surface is
Telegram — deepen the existing bot (EGE-ADV #15, OBSERVED linking/webhook) into a book-from-
Telegram chat flow + a shareable deep link/QR for Instagram-bio culture. Named trade-off:
zero Google/Meta panel presence; acceptable while the market lives on Telegram. Confidence: HIGH.

### localization (CM + MS)

**E-l10n-01 — Bilingual parity, Amharic-first | GREEN — treat as DUTY | CM+MS**
Fix: default resolution + English-only surfaces (Gap.md:344, OBSERVED in i18n.ts:3-12 class).
The parity test already gates commits (AGENTS:36 ritual; server/tests/i18n.test.ts, OBSERVED).
Do NOT chase locale breadth — COMPARE-03 #11 protects two-locales-deep over 37-wide. Collision:
YES-if-scope-creeps-past-am/en (37-locale parity is permanently outside the funnel, LEDGER:42).
Confidence: HIGH.

### INFRA-BLOCKED (2 rows — rule 20; CEO to-do, verdict in §6)

**E-ai-03 — (CEO re-scoped: shared business calendar) | GREEN for the re-scope; original two-way sync = AMBER behind infra ruling | MS**
The re-scope is strategically correct *because it unblocks a real merchant job (staff seeing
their schedule, owner seeing all of it) with zero new infrastructure*: it is E-ms-01's grid + a
staff read view over existing appointments/staff_availability (OBSERVED tables). It must derive
from appointment columns — AGENTS:21-22: the queue/derivation discipline applies; do not build a
parallel schedule table that becomes a second truth. The original two-way Google/Apple sync
stays deferred to the queue to-do (§6); do not let the re-scoped UI promise sync it can't do —
"publish-only feed" copy stays honest (public.ts:1432-1478, OBSERVED one-way).
Collision: NO if it rides appointments; YES if it forks a second calendar truth. Confidence: HIGH.

**E-ai-05 — Continuous BI export | AMBER substitute; full row deferred to §6 | MS**
Rule-20 substitute shipping now without a worker: give the live CSV endpoint a UI (it is a dead
surface today, OBSERVED) + a "regenerate" button + export events written to security_events
(OBSERVED table). Trade-off named: no scheduled/continuous push, no object sink — merchants get
pull-on-demand, which serves the actual job ("monthly numbers") at current scale. The full ETL
awaits the queue decision; building it inside a request handler would regress the <500ms web
principle the CEO plan itself states (Gap.md:375). Collision: NO. Confidence: HIGH.

---

## 2. Unit-economics impact on NOW-candidates

Published posture at stake (COMPARE-03 + COMPARE-02 §A): **no platform % of bookings · unmetered
messaging · ETB-only · no stored instruments · no custody · 1,000 ETB flat subscription**.

| Feature | Cost/economics effect | Silent-reversal risk |
|---|---|---|
| E-pm-08 tips | Adds gratuity into the consumer→merchant push; platform sees nothing but owns the expectation. Staff-payout pressure → the wallet/payout door (#7) walks in through a UI. | HIGH — posture "we move zero booking money" survives only if tips never need platform routing. |
| E-pm-09 gift cards | Merchant-liability codes: no platform balance-sheet. Platform-held value: NBE custody wall + the −2..−17 ETB/txn arithmetic that killed wallets (ROADMAP:16, cited in COMPARE-03 #6). Breakage revenue temptation (unredeemed value) is a fairness trap the PDPL brand cannot afford. | HIGH if held centrally; LOW if code-model ruled. |
| E-pm-11 packages | Prepaid obligation ledger on merchant books; refund-of-unused points at the missing refund rail; redemption-to-zero visits (free-visit charges) must still clear webhook-amount parity tests (chain-webhook-amount, OBSERVED suite). | MEDIUM. |
| E-mg-01 email campaigns | First per-send *platform* cost (SMTP/bulk provider). Absorbing it at flat 1,000 ETB makes cost-per-tenant volume-dependent (SMS already is — SMSEthiopia is a real paid call, repo-map OBSERVED); the answer "meter it to merchants" directly inverts EGE-ADV #2 and COMPARE-03 #12 (unmetered messaging is the moat, not a free-rider accident). Options: merchant-brings-SMTP (posture survives, PDPL processor-chain paper needed) or absorb-with-fair-use-caps (posture survives, cost capped) or meter (CEO must say the quiet part). | HIGH. |
| E-mg-07 paid boost | New revenue class (ads) vs zero-take posture; quality floor required or trust assets (#11/#12/#18) degrade into the revenue line they undercut. | MEDIUM. |
| E-ai-04 substitute (Telegram booking) | Telegram bot send cost ~zero; preserves "giveaway automation" economics. | LOW. |
| T7.19 queue-advance push (live candidate, not in the 68) | Each advance SMS is real platform cost — route Telegram-first when linked, SMS as fallback; unmetered-to-merchant stays true only because the platform absorbs per-SMS cost at current volume. Watch: push automations scale cost *with usage*, unlike subscription. | MEDIUM. |
| E-pm-07 pay links | Direct-charge pending/failure noise (authorize/verify flow is push-based, OBSERVED) multiplies support cost per link; no take-rate change. | LOW. |
| E-ml-02 attribution | Attribution-only adds no cost; any sale-split settlement = payout engine (#7) = custody economics reverse. | HIGH at payout half. |

---

## 3. Consent & PDPL register (rows where consumer/staff data gets authored or stored)

**Gate: each row's erasure-matrix extension must ship in the same PR as the capture, verified
against `server/lib/accountDeletion.ts` (OBSERVED current matrix: appointments anonymize,
customer_stats anonymize, punch_cards destroy, loyalty_ledger retained-by-trigger, otp/telegram
anonymize, consumers delete).** Append-only + money-record retention (accounting law) remain the
two sanctioned retentions; everything else anonymize-or-delete.

| Row | Data | PDPL posture | Erasure-matrix extension required BEFORE ship |
|---|---|---|---|
| E-cm-02 allergy/patch-test | **health data (special category)** | explicit separate consent; purpose-limitation (staff on that appointment); breach stakes high | new table → anonymize/delete by phone AND by tenant path |
| E-cm-03 intake forms | arbitrary answers incl. health leakage | question allowlist; retention label per form | answers table in both matrices |
| E-cm-06 files | photos/consent-form images on person | consent artifact vs clinical photo: opposite retention defaults; linked | customer-linked media rows + blobs (tenant path deletes media; consumer path has no media today — add) |
| E-ca-02 prefs | consent state itself | the withdrawal *right*; STOP log; never fabricate (loyalty-opening Do-Not, OBSERVED) | consumer-writable log rows; anonymize on delete |
| E-an-06 birthday | marketing-PII | capture only with opt-in; no inferred DOB | column on consumers/customer_stats → covered by existing anonymize path once added |
| E-pm-09 gift cards | buyer + recipient phones; value | third party (recipient) has no account — notice at issue | redemption ledger = money-record → anonymize-keys-retain-value pattern (loyalty_ledger precedent, OBSERVED) |
| E-cm-05 import | bulk third-party PII | merchant warrants consent; processor role | per-client delete must hit imported rows without consumer accounts (bare-phone path exists, OBSERVED) |
| E-mg-05 reviews | public UGC | notice at authoring; deletion duty on public display | reviews table: delete-on-erasure (not anonymize — attributed content anonymized is still content) |
| E-bc-07 notes | merchant-authored person-data | subject-access (export shows them) | appointments.notes joins the anonymize set |
| E-tp-01/03/04 staff | photo, work-hours, wages | employment consent; 04 alone may be counsel-gated | staff delete path (existing) must purge media + timesheet rows |
| E-ar-04 pixel | third-party transfer | consent banner or no tags | n/a — don't ship without ruling |
| E-cm-07 block | refusal decision about a person | transparency + appeal | block table is consumer-visible; anonymize on consumer delete |

---

## 4. Requested CEO rulings (questions with options — 12)

1. **E-pm-15 refunds** — (a) fix the landing promise only; (b) record-refund-owed + merchant
   executes off-platform; (c) automate via Chapa (capability INFERRED-unverified, custody review).
   Either way (a) is mandatory: the current public claim contradicts the code (OBSERVED).
2. **E-pm-08 tips** — platform-uninvolved tip (offline staff settlement disclosed), wait for
   staff-attribution decision, or no tip UI? (Touches COMPARE-03 #7 economics.)
3. **E-pm-09 gift cards** — is a *merchant-liability* gift code meaningfully distinct from the
   never-do "wallet"? Recorded-decision format per docs/loyalty-opening.md, or remains DEAD.
4. **E-pm-11 packages** — discount-at-charge visit-credits vs stored balance; refund-of-unused
   policy for prepaid bundles.
5. **E-pm-07 pay links/QR** — authorize a money *move* outside booking+subscription (LAW 5),
   contingent on `ALLOW_UNVERIFIED_PAYMENTS=false` first.
6. **E-pm-17 taxes** — display-inclusive convention (no money-semantics change) vs additive
   capture line (webhook parity + chain test + service-charge ≠ surge confirmation).
7. **E-mg-01 email cost posture** — merchant-SMTP / platform-absorbed-with-caps / metered
   (the third inverts EGE-ADV #2 and COMPARE-03 #12 and must be said publicly if chosen).
8. **E-mg-07 paid ranking** — free quality-rank now; paid boost yes/no/when, and with what
   disclosure + quality floor.
9. **E-ml-01/02 locations & chair-renters** — is multi-location/multi-merchant *the strategy*?
   Attribution-only vs any platform-touched sale-split. (This also sets the urgency of the DB
   decision in §6.)
10. **E-cm-02 allergy data** — store with special-category consent apparatus vs paper-card
    convention vs prohibit the field.
11. **E-tp-04 wages/commissions** — defer / merchant-owned record / model. (E-tp-03 timesheets
    and E-ms-04 absence types inherit this boundary.)
12. **E-ar-04 ad pixels** — third-party tracking consent posture (banner + opt-in or no tags).

Plus one **confirmation requested** (not a reopen): E-mg-06 reward half and E-an-06 reward-loyal
stay dark until the loyalty gate opens — restating COMPARE-03 #9, per rule 7's "you may FLAG
that a ruling is requested" allowance.

---

## 5. Protected rows that appear in the debate anyway (collisions)

- **E-ts-03** → COMPARE-03 #4 (fees) — behavioural config allowed, fee language = reopen.
- **E-pm-05** → #3 (prepay-only) — override ∈ {none, full} only.
- **E-pm-08/09/11** → #6/#7 (wallets/payouts) — the tips→payout→stored-value ladder is the
  single most likely backdoor around the never-do list in this entire scope.
- **E-mg-06, E-an-06(reward)** → #9 (loyalty gate) — no loyalty-looking messages from a dark
  engine.
- **E-mg-01** → #12 + EGE-ADV #2 (unmetered messaging) — metering is a posture reversal, not a
  pricing detail.
- **E-bc-03** → EGE-ADV #5/6/7 (queue) — waitlist must be a reclaimed-slot offer derived from
  appointment columns, never a queue restructure (AGENTS:21-22).
- **E-ml-02 (payout half)** → #7. **E-l10n-01 (breadth creep)** → #11. **E-ds-01 hub build** →
  EGE-ADV #11 dark-site gate (list quality over coverage).

---

## 6. The two INFRA rows — strategic verdict on the stack-switch to-do

**Verdict: queue+worker — CONDITIONAL YES. Postgres — NOT YET. Order matters more than the
answer.** (OBSERVED constraint base: repo-map infra_constraints — single process, no distributed
lock, double-firing crons on a rolling deploy is a *real current bug*; the CEO plan's own
one-line answer, Gap.md:506-507, is aligned with this verdict.)

**Must NOT regress (acceptance conditions for any queue phase):**
1. **Webhook idempotency** — `processed_webhook_events` dedupe + the raw transactional webhook
   update (AGENTS:34-35, never-do). At-least-once delivery + retries makes *replay the default*;
   the dedupe table is what converts that into safety. Any worker that consumes payment events
   must pass through the same event-id gate. Money gate:
   `npx vitest run server/tests/chain-payments-billing.test.ts` green on every phase, plus a new
   "double-deliver the same webhook job" case (rule 6).
2. **Inline `eq(tenantId)` law** — workers are just new DB readers/writers; AGENTS:36-37 applies
   to every query in every worker. The job ledger must carry tenant_id (the CEO plan already
   says this, Gap.md:440-448 — adopt it as law, not suggestion).
3. **Single-writer discipline** — today's booking correctness is BEGIN IMMEDIATE + withBusyRetry
   (OBSERVED public.ts:731-734). "Web enqueues, workers write" (Gap.md:480) *preserves*
   single-writer on one libSQL primary — that is the safe topology. The forbidden intermediate is
   web-and-workers-both-write-directly. Do not run two web instances with in-memory rate limiters
   (repo-map: limiters don't share) or double-fired crons — deploy topology must be fixed even in
   Phase 0.
4. **Cron idempotency markers** — reminderSent / automation_state / UNIQUE(tenant,stage,cycle)
   marker-first-delete-on-failure (OBSERVED repo-map crons). A distributed lock WITHOUT these is
   strictly worse than today's unlocked double-run; locks are additive safety, never a
   replacement for idempotency. Phase-0's proof ("two web instances + one worker, no
   double-sends/double-crons") must be a *test*, not a demo.
5. **Notification channels never throw** (AGENTS) — a dead Redis must degrade to logged failure,
   never block a booking response. Enqueue-must-not-fail-the-request is the whole web<500ms
   principle.
6. **Money-gate semantics frozen during migration** — no feature work touching effectiveAmount,
   settlement, loyalty gate ships in the same window as a queue phase.

**Postgres decision: defer.** The EXCLUDE-gist double-booking constraint is genuinely attractive
(structural vs app-enforced correctness, Gap.md:401-411) — but it is a dialect rewrite of the
money layer *while the money layer is still running with ALLOW_UNVERIFIED_PAYMENTS=true*, and it
puts every guarded-migration habit (AGENTS:38-39) through a breaking rewrite with the 12-item
COMPARE-03 semantics pinned only by tests. Measure first: the queue answers whether replica lag
or write throughput is even real at current volume. Named trade-off: if E-ml-01 rulings come
back "multi-location is the strategy," the Postgres case upgrades from defer to now.

**Strategic doors the queue opens (why say yes):** E-ai-03's original two-way sync (mapping-table
+ echo-loop design in Gap.md:427-438 is sound — adopt origin-tagging and save-before-call),
E-ai-05 continuous export, E-mg-01 bulk sends beyond ~10k (the parked G3 line, LEDGER:50), and a
job ledger that finally answers E-ar-02 per-tenant ("which automations fail for whom"). It also
removes a deploy footgun we already have.

**If the CEO defers infra entirely:** the rule-20 substitutes stand as written —
E-ai-03 re-scoped shared calendar (E-ms-01 + staff read view; no new table) and E-ai-05
pull-on-demand CSV + UI + audit, with the honest copy that sync is publish-only. Both substitutes
are genuinely useful product; the deferral costs only the future automations at scale.

**Sequencing opinion (strategy):** the loyalty-gate north-star ≥0.7 needs *real confirmed
bookings* — nothing in the 68 does more for that than E-ar-01 (render the analytics merchants
can see value in), E-ms-03 (closures: stop booking into closed shops), E-an-01/03 (reminder +
cancel notices: cut no-shows), E-ca-02 (consent centre), E-pm-15(a) (stop promising automatic
refunds the code can't do). The queue is the right *next* infra; the refund/rails honesty and
the unverified-payments flag are the right *now*.

---

*Prepared by Subagent C. No files outside `_council/` modified. Every RED-but-wanted row above
carries a named trade-off per rule 20; no row was bare-SKIPped.*
