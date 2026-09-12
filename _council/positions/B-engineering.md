# Position B — Engineering Lead

Council session: Egebeya backlog, 2026-09-12. Subagent B. Position paper only; nothing implemented.

**Effort bands (engineer-weeks against THIS stack):** **S** ≤ 1 wk · **M** 1–3 wks · **L** > 3 wks.
Every "S" claim must name the existing seam it rides; "what it rides" is a file:line, not an
adjective (docs/feature-selection.md:85-86). All citations are from files I opened this session:
`server.ts:239-327`, `src/api/public.ts:56-215,477-1429`, `server/lib/queue.ts`,
`server/lib/chapa.ts`, `server/lib/billing.ts`, `server/lib/notifications.ts`,
`src/api/crm.ts`, `server/cron/sendReminders.ts`, `server/cron/runWinbackAutomations.ts`,
`src/db/schema.ts:100-340`, `src/db/migrations.ts:1-60`,
`server/tests/chain-payments-billing.test.ts`, `src/api/bookings.ts:75-215`,
`src/api/payments.ts:60-180`, `ARCHITECTURE.md`, `render.yaml`, `_council/repo-map.json`.

The seven crons (server.ts:243,253,263,273,285,298,310): **R**eminders(*/15), **W**inback(23:00),
**E**xpand-recurring(03:00), **D**owngrade(03:05), **S**ettlements(04:00), **I**ntent(*/2h),
**B**illing-reminders(09:00). "Touches: none" means it adds no cron and edits none of those files.
"Money files" = public.ts:807-1058 (charge path), payments.ts (webhook), billing.ts, chapa.ts,
settlements, and the gate test `chain-payments-billing.test.ts`.

---

## 1. Feature positions (all 68, by Gap.md section)

### discovery-search (7)

- **E-ds-01 Category spine** — **M**. The 14-category list itself is S (enum on `tenants.category`,
  filter exists at public.ts:102-104, template map at server/lib/siteTemplates.ts:39); the cost is
  the vertical landing hubs — 14 pages of real copy (en+am, AGENTS.md:36), not stubs, or they are
  doorway pages. New: nothing schema-wise; a route + per-category content. Crons: none (aggregateIntent
  already stores category strings, schema.ts:368-376). Failure w/o infra: nothing — thin content on
  empty categories is the only failure. Dep: E-ds-06 first so cards have prices. **HIGH**.
- **E-ds-02 Treatment search** — **M** (true tt-spine tail is **L**). Today search is `tenants.name LIKE`
  only (public.ts:113-117); services exist per tenant with free-text `name` (schema.ts:67-75), so
  v1 = join services and LIKE — S/M. A canonical treatment taxonomy + treatment×geo page grammar is
  a content-system project. Crons: none. Failure: tenant-named services ("Special Gel-X") give junk
  results without the canonical layer. Dep: E-ds-01. **MED**.
- **E-ds-03 Neighbourhood** — **M**. City is `json_extract(settings,'$.city') LIKE` (public.ts:106-111).
  New: structured district field + enum per city + a capture path — no existing form collects it, so
  there is backfill friction. Crons: none. Failure: substring matching keeps silently misgrouping
  "Addis" vs "Addis Ababa" until the field is structured. **MED**.
- **E-ds-04 Map view** — **L, DATA-BLOCKED**. Zero lat/lng anywhere (schema.ts:3-22; public.ts:56-209
  has no geo). Needs coordinate capture + a geocoder that resolves Addis subcities — COMPARE-00
  market-fit explicitly flags street-address geocoding as an imported assumption. Reclassify:
  **NOT-feasible-without-address/coordinate collection**. Crons: none. **HIGH** (that it's not S).
- **E-ds-05 Aggregate rating display** — **M, blocked by E-mg-05**. Display + avg is S once a reviews
  table exists; discover already batch-joins per-tenant counts (public.ts:147-165) so the aggregate
  pattern is proven. Without the entity there is nothing to display — the NEW badge is not a rating.
  Failure if rushed: fake ratings. Dep: E-mg-05. **HIGH**.
- **E-ds-06 Price on cards + JSON-LD** — **S**. `MIN(services.price)` as a batched aggregate next to
  the booking-count join (public.ts:152-165); `/api/public/services` already exposes prices
  (public.ts:428-440). New columns: none. Crons: none. Failure: "Br 0" on empty menus — render rule
  is null-not-zero (T7.13 discipline). **HIGH**.
- **E-ds-07 Same-day surfacing** — **M**. Availability is computed per staff+day (public.ts:477-591);
  a directory needs a bounded per-tenant rollup ("any open slot today?"). At 25 tenants an on-read
  bounded scan is honest; at scale it needs a precompute job — that is an 8th cron or the future
  worker, and it is the **first genuine queue-benefit item in the 68** (not a correctness blocker).
  Crons: none today. Failure without infra: slow reads inside `discoverLimiter` at scale. Dep: E-ms-03
  (closures must be respected or "open today" lies). **MED**.

### booking-core (8)

- **E-bc-03 Waitlist** — **L** (COMPARE-04 scored M — see audit). New entity `slot_waitlist`
  (additive via migrations array, migrations.ts:1-17 convention); join UI when day is full; offer on
  reclaim hooks into sendReminders phase-2 sweep (sendReminders.ts:154-184) — the reclaim moment
  already exists; a single-use claim token state machine; race handled by the existing BEGIN IMMEDIATE
  + withBusyRetry pattern (public.ts:900-914, queue.ts:32-45). Crons: touches **R** (reclaim→offer).
  Consent: offered slots are marketing → opt-in gate as in winback (runWinbackAutomations.ts:111);
  AGENTS.md:26 applies. Failure w/o infra: none at 25 tenants — the 15-min sweep IS the retry loop;
  at volume, offer storms serialize on the single writer. Dep: E-ms-03, E-an-04(slot-avail msg). **MED**.
- **E-bc-04 Group bookings** — **L**. One appointment = one staff interval (public.ts:755-800,
  conflict check :902-914 assumes single block; availability grid :570-583 has no seat concept).
  Needs per-slot capacity accounting inside the write tx or it overbooks — this is a booking-core
  rewrite, not a form field. Money: total = N×price changes `effectiveAmount` (:877) → gate case.
  Crons: none. Failure: double-booked chairs, the one defect the stack cannot absorb quietly. **MED**.
- **E-bc-06 Sequencing / rooms** — **L, defer**. Ordered steps break the "sum durations into one
  block" model (public.ts:777-779, :800); resources table; availability generator rewrite.
  Company-shaped. Crons: **E** (recurring expansion assumes single service). Failure: half-built
  sequencing silently corrupts the calendar that everything else reads. Dep: T6.4, after buffers
  (E-ms-05). **HIGH** (that it's L).
- **E-bc-07 Statuses & notes** — **S** for notes. Status lifecycle real (bookings.ts:89-92 whitelist);
  `appointments` has no notes column (schema.ts:117-148). Additive column + write in status PUT +
  staff-role projection (precedent bookings.ts:23-41) + PDPL erasure matrix (accountDeletion.ts
  — notes are personal data). Crons: none. **HIGH**.
- **E-bc-08 Merchant drag reschedule** — **M**. Client self-serve reschedule exists (public.ts:1293-1369
  including the multi-service duration bugfix); merchant side is a day-list (Bookings.tsx:36-129).
  Work is a calendar grid + drag → same endpoint. Crons: none. Failure: drag conflicts must hit the
  same 409 path, or merchants create overlaps through the one UI that bypasses availability UX.
  Dep: E-ms-01 grid component. **HIGH**.
- **E-bc-09 Cancellation reason** — **S**. Enum + free text on `appointments`; two write points:
  public cancel (public.ts:1267-1291) and merchant flip (bookings.ts:81); one column in the CSV
  export (tenant.ts:2122). No money (rule: "reason→policy, no money"). Crons: none. **HIGH**.
- **E-bc-10 Assignment rules** — **M**. Consumer picks staff today (public.ts:441-465); rules mean
  server-side staff selection + per-staff fairness counter + fallback when none free — new branch
  inside the booking POST before the tx. Crons: none. Failure: round-robin that ignores
  staff_services capability edges books unqualified staff. Value at 5–8-staff shops: low. **MED**.
- **E-bc-11 Online-availability controls** — **S/M**. `services.active` + `staff.active` exist
  (schema.ts:74,85); add `sellable_online` + lead/max-notice on settings blob (tenant.ts:1185-1204
  pattern). Enforce in `assertSlotAllowed` (public.ts:623-714) + grid start offset; walk-in path
  (bookings.ts:345) must bypass "online" toggles by design (EGE-ADVANTAGE E-bc-12 semantics).
  Crons: none. **HIGH**.

### payments-money (11)

- **E-pm-05 Per-appointment policy override** — **M**. Policy today: tenant setting + phone list
  (public.ts:807-814; crm.ts:293-337). Add `appointments.pay_policy_override` read at booking-create
  and walk-in. CAUTION: override changes *when money is demanded*, never the amount — gate case
  asserts pending/`cancels_at` (public.ts:942) per override. Crons: **R** (stale-slot sweep reads
  cancelsAt). **MED**.
- **E-pm-06 Card terminals** — **NOT-feasible-without-rail**. Chapa/telebirr push + hosted checkout
  only (chapa.ts:54-136); no hardware integration surface, G2 rails gate (feature-selection.md:66).
  Any "terminal" built here is a cash-recording reskin — that's E-pm-18. Reclassify out of effort
  debate entirely. **HIGH**.
- **E-pm-07 Pay links / QR / self-checkout** — **M** (links only), **L** for self-checkout. Reuse
  `createCheckout` (chapa.ts:54-79); new `payment_links` table + hosted page + a webhook branch with
  `appointmentId=NULL`, `meta.purpose='payment_link'`. CAUTION/one-way: the webhook purpose
  discrimination must never let a link payment reach `activateProSubscription` or
  `countFoundingCohort` (billing.ts:146-153 filters `purpose='pro_subscription'` — assert it).
  QR code itself is S (client lib, rides E-cs-06). Crons: none. Failure: a mis-purposed webhook
  row grants Pro with ad-hoc money — the gate's exact failure mode (test:60-112). **MED**.
- **E-pm-08 Tips** — **M** (COMPARE-04 S — audit). A gratuity term enters `effectiveAmount`
  (public.ts:877), the telebirr charge (:1002-1014), `payments.meta`, the ticket
  (ReceiptTicket.tsx:128-138), settlement reporting (settlements.ts). Money path = always one-way
  + CAUTION (feature-selection.md:142); T7.10's own acceptance ("zero-tip booking byte-identical",
  base/tip reported separately) is an M-sized discipline, not an afternoon. Crons: none. **HIGH**.
- **E-pm-09 Gift cards** — **L**. Stored value = new sell flow (payment `purpose='gift_card'`) +
  balance table + redemption ledger + expiry + fraud surface; punch_cards/loyalty_ledger are shape
  precedents (schema.ts:481-507) but gift value is a liability, not a discount. Dep: E-pm-15
  refunds must exist first — an unsold-card refund today is literally unanswerable. CAUTION.
  Crons: **S** semantics only. Failure: unredeemed balances with no refund rail. **MED**.
- **E-pm-11 Packages / bundles** — **L**. `packages` + `package_purchases` + per-visit redemption
  state; stacking rules against promo/loyalty/quiet discounts (public.ts:817-877) must be written
  down before code. Dep: E-pm-15; after T7.5 tax ledger. CAUTION. **MED**.
- **E-pm-15 Refunds** — **copy S / recorded-M**. Landing promises "refunded automatically"
  (Landing.tsx:1029 ↔ en.json) while cancel says manual (public.ts:1283-1285) — fix both locales
  first, it's a defect (T7.9a). Chapa lib has **no refund call** (chapa.ts exports:
  create/initiate/authorize/verify — verified). So platform-initiated refund =
  **NOT-feasible-without-Chapa-refund-API-confirmation**; honest substitute = owner "refund issued"
  ack stamping `payments.meta` + bilingual email. CAUTION gate case per T7.9/T7.5. **HIGH**.
- **E-pm-16 Void/raise/edit + receipts** — **M**. Platform invoices exist with void status
  (schema.ts:324-340; gate test asserts void-never-grants :114-147); booking-level sale ledger does
  not exist — receipts are tickets. Scope to *recorded* corrections (raise-above-paid is
  COMPARE-03 item 8 territory, prohibited upward). CAUTION. Crons: none. **MED**.
- **E-pm-17 Taxes / service charges** — **M** (risk-L trap). Additive line in `effectiveAmount`
  (:877) + receipt itemization + per-service exempt flag. The trap: the webhook verifies provider
  amount vs `payments.amount` at 0.005-birr tolerance (payments.ts:~148-170) — tax must be in the
  stored amount or **every** paid webhook logs `webhook_amount_mismatch` and no-ops. Rounding order
  (discount-before-tax) must be pinned in a new gate case (T7.5 acceptance). CAUTION. **HIGH**.
- **E-pm-18 Offline payments** — **M**. `payments` already has gateway/method nullable columns
  nobody writes (schema.ts:180-181). Write cash rows `gateway=null,status='completed'` +
  settlement decision in writing: `settlementStatus='settled'` on entry or the 04:00 sweep marks
  them stale forever (settlements.ts; cron **S**). Revenue aggregate (tenant.ts:450-546) counts
  completed → include+label or exclude, not by accident (T7.5c). CAUTION. **HIGH**.
- **E-pm-19 Merchant credit** — **NOT-feasible-without-licensing**. Parked (COMPARE-01 →
  ROADMAP:134). Not an infra question; not ticketable this cycle. No gate work until a recorded
  decision changes the never-do posture. **HIGH**.

### consumer-account (2)

- **E-ca-01 Account & profile** — **M**. Consumer JWT + phone OTP exist (consumer.ts:49-215);
  `appointments.consumerId` is already backfilled (schema.ts:133-135) so a bookings-list endpoint
  is a scoped select — S. Profile editor is S. The Fresha record includes a **wallet: not buildable,
  prohibited** (AGENTS.md cashback/wallets never-do). Crons: none. Failure: account surface that
  shows another consumer's data if the scope slips — one eq(tenant…) law applies cross-consumer here. **HIGH**.
- **E-ca-02 Preferences / consent centre** — **M** (COMPARE-04 S — audit). Consent lives in three
  stores: `customer_stats.marketingOptIn` (schema.ts:288-292), `consumers.consentGivenAt` (:455-461),
  `telegram_links.consentGivenAt` (:420-429); a consumer PUT must lower all three consistently and
  stamp withdrawal (PDPL "withdrawal as easy as grant"). Telegram `/stop` hooks into the live
  webhook (telegram.ts:36). The SMS "Reply STOP" (crm.ts:206) has **no inbound path — sms.ts is
  send-only**; full SMS STOP handling = NOT-feasible-without-inbound-SMS provider. Ship consumer
  centre + Telegram stop; delete or footnote the SMS promise. Crons: none; affects **W** and blast
  (they read opt-in SQL-side, runWinbackAutomations.ts:111). **HIGH**.

### client-management (7)

- **E-cm-01 Authored record** — **M**. Today everything is derived (customer_stats, schema.ts:279-299;
  crm.ts:34-89). Additive: notes append-only table (loyalty_ledger precedent :481), fixed enums.
  This is the T7.11 "authored-record schema" the other rows depend on. PDPL erasure matrix update
  mandatory. Staff projection must not leak phone/email (bookings.ts:23-41). Crons: none. **HIGH**.
- **E-cm-02 Allergy / patch-test** — **S, after E-cm-01**. Two fields on the record + visible on the
  queue chair card (QueueConsole.tsx:184-242). Medical-adjacent PII → erasure matrix + no print in
  notifications. Crons: none. Dep: E-cm-01. **HIGH**.
- **E-cm-03 Intake forms** — **M**. Booking capture is fixed zod (public.ts:596-621;
  PublicBooking.tsx fixed schema). Ship 2–3 **preset** forms (consult, wax-aftercare) with JSON
  answers on the appointment — a merchant form *builder* is the Fresha depth and is L; don't confuse
  them. Dep: E-cm-01 identity. Crons: none. **MED**.
- **E-cm-04 Tags & segments** — **S**. Free-form tenant tag table + filter param on
  crm.ts:34-89; segments = saved filter presets (inactive_days already a param :39-60). Feeds
  campaign audiences later (E-mg-01). Crons: none. **HIGH**.
- **E-cm-05 Import/export/merge/delete** — **M**. Export exists but unwired (tenant.ts:2122,
  zero UI — repo-map dead_surfaces). Import = parse ≤2k rows in-request (no queue needed at this
  scale). Merge = re-point appointments/customer_stats — one-way door. Per-client "delete" must map
  to **anonymize** (payments are immutable money records), not row-drop — design doc first
  (feature-selection.md:136-140). Crons: none. **MED**.
- **E-cm-06 Files on profiles** — **S**. Upload + media exist (tenant.ts:1401-1470,
  schema.ts:217-225 tenant-scoped); add nullable `customer_phone` link. Dep: E-cm-01. PDPL erasure.
  Crons: none. **HIGH**.
- **E-cm-07 Block client** — **S**. Mirror `consumer_blocks` reversed (schema.ts:548-555) + a check
  before the booking tx (public.ts:736). Honest limit: phone-keyed identity is block-evasive with a
  new number — pair with require-upfront (crm.ts:293) as the real deterrent. Crons: none. **HIGH**.

### merchant-scheduling (5)

- **E-ms-01 Smart calendar** — **M**. Grid/drag/color is a frontend project on existing reads
  (`/api/bookings` GET bookings.ts:43; dashboard route server/api/tenantRoute.ts:56). Also the
  surface for the re-scoped E-ai-03. Crons: none. This is the component E-bc-08/E-ms-02/E-ai-03
  share — land it once. **HIGH**.
- **E-ms-02 Shifts/rosters** — **M**. `staff_availability` is per-weekday only (schema.ts:93-99,
  tenant.ts:373-404); add dated shift rows + a staff login view (staff role surface exists,
  StaffRedirect.tsx). Rides E-ms-01 grid. Crons: none. **MED**.
- **E-ms-03 Closures writer** — **S**. Table + read enforcement fully live
  (public.ts:508-514, :651-662; schema.ts:110-115); only `POST/DELETE /api/tenant/closures` +
  settings UI missing (repo-map: "write-orphaned"). Unblocks: fill-rate denominator honesty
  (analytics.ts:252-255 parked caveat), E-ds-07, waitlist "full-day" truth. Crons: none. **HIGH**.
- **E-ms-04 Time-off types** — **M**. Table + approval flag; the real cost is **dated** staff
  unavailability flowing through `assertSlotAllowed` (public.ts:678-711) and the grid — the
  availability model only understands day-of-week. Dep: E-ms-03's date-based pattern. Crons: none. **MED**.
- **E-ms-05 Buffers / extra time** — **M** (COMPARE-04 S — audit). Columns S; correctness is not:
  end-time is computed in **three** places (public.ts:800, bookings.ts:345 walk-in, v1.ts:158),
  availability must pad (:570-583), and recurring expansion exists **twice** (cron/expandRecurring.ts:39
  vs tenant.ts:1803 — T6.4 dup, repo-map cron note). T7.15 itself says land T6.4 first. Crons:
  touches **E**. Dep: T6.4. **HIGH**.

### multi-location (3)

- **E-ml-01 Locations** — **L+ (XL)**. Today tenant == location: `slug` unique, tenant-resolution
  middleware on Host/X-Tenant-Slug (ARCHITECTURE.md:92-100), 41 tables keyed `tenant_id`, disk
  layout `storage/pro-builds/{tenantId}` (site-settings.ts:16-18), Pro price is per-tenant
  (billing.ts). Parent-group entity touches all of it + the billing shape (is Pro per location?).
  One-way door of the year. Defer until a paying multi-shop tenant exists. Crons: all read
  tenant-scoped. **HIGH**.
- **E-ml-02 Independent merchants** — **L**. staff are logins (schema.ts:24-40,77-91), not
  attributable merchants; sale attribution at booking touches the money total and the ledger —
  CAUTION (E-ml-02 in rule money-register). Rides E-ml-01. Defer. **MED**.
- **E-ml-03 Operator view** — **M after E-ml-01/02**. Admin console is platform-side only
  (admin.ts:42-568); a shop-group operator view has no entity to read. Blocked by E-ml-01. **HIGH**.

### trust-safety (2)

- **E-ts-02 Report/reply reviews** — **M, after E-mg-05**. content_reports + admin PATCH queue
  already exist for merchants (trust.ts:43-84; admin.ts:512-568) and are the moderation pattern to
  copy. Zero reviews to moderate today (schema: no table). Dep: E-mg-05 entity. Crons: none. **HIGH**.
- **E-ts-03 No-show policy engine** — **S/M, behaviour only**. Counters + forced-prepay per phone
  work (bookings.ts:163-197; crm.ts:293-337). In-scope: rule automation (cancel-window → auto-flag)
  as settings. **Monetary fee capture is never-do** — no stored instrument (AGENTS.md;
  DIVERGENT-BY-DESIGN). CAUTION-adjacent: forced prepay flips initialStatus/cancelsAt → gate case
  pins pending behaviour. Crons: **R** (expiry sweep is the enforcement). **HIGH**.

### marketing-growth (5)

- **E-mg-01 Blast campaigns** — **M**. Today: one-shot SMS, synchronous loop inside the request
  (crm.ts:182-237 — every recipient awaited before res.json; no throttle unlike winback's
  50@1/s, runWinbackAutomations.ts:37-39; **no Pro gate in code** despite Gap.md's description —
  tree wins). Failure mode today: big blast = long request, timeout, no resume, operator retry
  double-sends (no blast-level idempotency marker). Fix = `campaigns` + `campaign_recipients`
  marker rows (billing_reminder_sends precedent, schema.ts:405-415) run in bounded chunks from the
  winback cron tick or a new job — **this is the only one of the 68 that genuinely wants worker
  semantics, and at 25 tenants a marker-first in-process loop is sufficient**. Email campaigns:
  templates exist (mailTemplates.ts) but consumer emails are sparse (nullable capture). Builder +
  scheduling + perf view ride notification_log (schema.ts:438-449). Crons: **W** (+new job slot). **MED**.
- **E-mg-02 Deals** — **M**. First the bug: WinBackWidget.tsx:56-62 shows `WIN10` and
  MarketPulseWidget.tsx:126-130 shows "15% off" — neither mints a real code; CustomerHealth does
  (crm.ts:98). Every UI-produced discount must be redeemable (T7.14). Then a thin deal wrapper over
  promo_codes + usedCount perf. CAUTION: in-tx promo re-check (public.ts:921-927) is law; upward
  price adjustment stays impossible (COMPARE-03 item 8). Crons: none. **HIGH**.
- **E-mg-05 Review engine** — **L**. reviews entity + post-visit invite (hook exists: completed
  transition, bookings.ts:107-121) + reply/moderation + abuse posture in a one-reputation market
  (fake-review exposure is existential here). Google sync: separate L. Lite shape (verified-visit
  only, no photos, 24h publish grace) is still L. Gates E-ts-02, E-ds-05. Crons: **R**-adjacent at
  completion sweep time. **MED**.
- **E-mg-06 Referral loop** — **M** (T7.18). consumers row exists (schema.ts:455); `?ref` carry +
  credit on first **completed paid** booking (anti-gaming rule already applied to agents) +
  single-use code mint (winback path runWinbackAutomations.ts:148-169). CAUTION: reward lowers next
  charge exactly like loyalty does (public.ts:866-877) → new gate case. Never wallet/cash
  (AGENTS.md). Crons: none (event-driven at completion). **MED**.
- **E-mg-07 Visibility boosting** — **S** organic ranking / **L+product** paid. Directory is
  `ORDER BY tenants.name` (public.ts:135); a quality score from data already joined (booking
  counts :152-165, media, completeness) is S. Paid boost = a pricing decision touching Pro revenue
  — ranking honesty first, money second, and "pay-for-rank" must be labeled. Crons: none. **MED**.

### automation-notifications (4)

- **E-an-01 Reminder lead time** — **S** (T7.2). Window hardcoded now+2h..2.5h
  (sendReminders.ts:51-52) → `settings.reminder_lead_minutes` default 120 = zero behaviour change;
  settings pattern (tenant.ts:1185-1204). Crons: **R** (the only change; 15-min scan granularity
  caps resolution — honest). reminderSent/sentVia semantics untouched. **HIGH**.
- **E-an-03 Reschedule/cancel notices** — **S**. Verified: both endpoints (public.ts:1267-1291,
  :1293-1369) update rows and dispatch **zero** notifications today. Templates (mailTemplates.ts
  4→6 keys ×en/am) + notify() hooks; never-throw rule already enforced by the adapter
  (notifications.ts:186-215). Crons: none. **HIGH**.
- **E-an-04 Lifecycle set** — **S/M**. no-show message on merchant flip (bookings.ts:81); thank-you
  from appointment_services numbers (schema.ts:150-157); waitlist-joined/slot-available are E-bc-03
  children; tip-thanks is E-pm-08's child — don't promise those two without their parents.
  Crons: none. **HIGH** on the split.
- **E-an-06 Birthday/welcome/milestone/reward** — **M**. Welcome = T7.1 (reuse winback cron + state
  machine, S on its own). Birthday needs a **birthdate capture path** (no column, no form —
  customer_stats schema.ts:279-299) before any date message. Milestone = visitCount thresholds
  exist. Reward-loyal messages ship **only with the loyalty gate** (LOYALTY_ENABLED + north-star
  ≥0.7; AGENTS.md:24-25; loyalty.ts:28-31) — no fabricated gate metrics. CAUTION: discount-bearing
  messages mint codes → single-use + consent rules (winback precedent). Crons: **W** extended. **MED**.

### analytics-reporting (3)

- **E-ar-01 Merchant reporting** — **S** (T7.8). The endpoint computes 7-day revenue/bookings/top
  services/repeats (tenant.ts:450-546); dashboard fetches and discards (index.tsx:597-598,641-650,
  repo-map dead-data note). Pure render job + role rule (staff never see revenue,
  bookings.ts:23-41). Crons: none. **HIGH**.
- **E-ar-02 Automation performance** — **M**. notification_log has channel/template/status/refType
  (schema.ts:438-449); platform-wide aggregation exists (notificationStats.ts). Missing: campaign
  identity (E-mg-01) + booking-attribution join refId→appointments→completed. The CEO plan's
  "job ledger" (§observability) is the same table widened — do it when a worker exists, not before.
  Crons: none. Dep: E-mg-01 for campaign rows. **MED**.
- **E-ar-04 Attribution + ads tags** — **M** (T7.16) attribution / **defer** pixels. `bookingSource`
  column already exists with walk_in/online semantics (schema.ts:145-147) — add `booking_source_detail`
  carried through BookingSchema (public.ts:596-621) + widget URL. GA/Meta pixels = consumer-PII
  consent surface Egebeya doesn't have → separate one-way decision; ship owned attribution first.
  Crons: none. **MED**.

### team-permissions (5)

- **E-tp-01 Staff profiles** — **S**. `bio`+`imagePath` already on staff (schema.ts:77-86); the UI
  edits name/title only (StaffPage.tsx:35-36); wire picker to existing upload (tenant.ts:1401).
  Crons: none. **HIGH**.
- **E-tp-02 Custom roles** — **M, security-sensitive**. Three fixed roles checked server-side
  (auth.ts:120-127; per-route `requireAuth({roles})` everywhere); a matrix = permission store +
  middleware swap + auditing all 134 endpoints' gates. Defer until a tenant literally begs.
  Crons: none. **MED**.
- **E-tp-03 Timesheets** — **M**. clock_events table + in/out endpoints + staff view; the planned
  hours model stays as-is (staff_availability). Crons: none. Rides E-ms-02 view. **MED**.
- **E-tp-04 Wages/commissions/per-member pricing** — **L**. Compensation fields belong to the
  struck-out E-pm-20 family (pay runs) — not ticketable while its parent is out of scope. The
  per-member **pricing** sliver alone: service price is summed in booking (public.ts:777-779) →
  staff-pricing join changes effectiveAmount → CAUTION; only after T6.4. Crons: none. **HIGH** (as L).
- **E-tp-05 Member lifecycle** — **S**. Invite+delete exist (tenant.ts:129-260); DELETE of a staff
  with appointment history is the current cliff — add archive/suspend flags (users.tokenVersion
  exists, schema.ts:35 → force-logout is one update) and stop hard-deleting. Crons: none. **HIGH**.

### content-site (2)

- **E-cs-05 Custom domain verification** — **M**. PUT /api/tenant/domain is format-check + Pro
  (tenant.ts:406-448). Resolution happens by Host header (ARCHITECTURE.md:92-100) → an unverified
  domain claim is a takeover waiting for DNS to point. Fix: TXT-token challenge (outbound DNS
  lookup) before active. Purchase = reseller decision, out. Crons: none. **MED**.
- **E-cs-06 Book button/QR/one-link** — **S**. iframe embed + share links exist
  (EmbedBooking.tsx:17-42; site-generator.ts:195); QR = client-side lib on the same URL; the
  "one-link-for-everything" is an aggregation page, not infra. WordPress: a docs page.
  Crons: none. **HIGH**.

### api-integrations (1)

- **E-ai-04 Google Reserve / Meta booking** — **M code, NOT-feasible-without-partner-approval**.
  Feed side rides the JSON-LD work in E-ds-06 (S, do that now); the booking-action side needs
  Google Business Profile verification + Meta's partner surfaces — external gating, not our
  infra. Reclassify: **NOT-feasible-without-X (third-party partnership)**. Crons: none. **MED**.

### localization (1)

- **E-l10n-01 Bilingual parity** — **S/M**. Default resolves en unless browser says am
  (i18n.ts:7-12); several surfaces hardcoded English (Discover.tsx header — repo-map note;
  booking flow strings). Work = parity sweep + a default-language policy decision (Amharic-first
  is brand law, COMPARE-02) + every new string per AGENTS.md:36. No infra. Crons: none. **HIGH**.

### INFRA-BLOCKED (2) — positions on the to-dos

- **E-ai-03 (re-scoped shared staff calendar)** — **M, no longer infra-blocked**. An internal
  shared view = read of appointments grouped by staff over the E-ms-01 grid; the owner-schedules-all
  permission is a role tweak on existing gates (bookings.ts:23-41). The **external two-way sync
  half** remains blocked: it needs durable inbound retry (no queue) + per-provider OAuth
  (no plumbing) — the one-line CEO diagnosis is right; it just isn't this ticket anymore.
  Substitute per rule 20: keep the one-way ICS-style feed (public.ts:1432-1478) and add per-staff
  feed variants (S). Crons: none. **HIGH**.
- **E-ai-05 Data export / BI** — **S substitute, L real**. Continuous ETL genuinely wants a worker
  (streaming inside a request handler is the anti-pattern; tenant.ts:2122-2347 already streams
  one-shot CSV with **no UI caller** — repo-map dead_surfaces). Rule-20 substitute that fits this
  stack: an **8th cron** weekly export (isDirectRun precedent, settlementReconciliation.ts:51-60)
  writing CSV + emailing a link; tenant-scoped, bounded, logged. Real connector stays post-queue.
  Crons: adds one. **HIGH**.

---

## 2. Infra verdict — queue + workers, argued from the tree

**Does anything in the 68 REQUIRE a queue now? No. Precisely:** the waitlist offer retry (E-bc-03)
does **not** — its retry loop is already the */15 reclaim sweep in sendReminders.ts:154-184 plus a
claim-token state machine; the only feature that genuinely **wants** worker semantics is bulk
campaign fan-out (E-mg-01, the synchronous crm.ts:212-230 loop is a real timeout/double-send
failure today), and the honest 25-tenant fix is marker-first chunking in-process
(billing_reminder_sends / automation_state are the proven pattern), not Redis. Two-way calendar
sync and continuous BI (E-ai-03 external half, E-ai-05) remain the true queue-children — both
already re-scoped to substitutes above. At `FOUNDING_RATE_CAP = 25` paying tenants
(billing.ts:27) — a founding-cohort ceiling the code itself enforces — "first thing to move at
500 tenants" (COMPARE-04 §Deferred) is describing a world that has a gate before it.

**BullMQ + Redis on Render, costed honestly:** render.yaml declares one free web service. Adding
BullMQ means (a) a Redis vendor (Upstash/Render KV — paid, network-hop from a region where latency
already hurts the single-connection libSQL path), (b) a second Render service — a free worker
**sleeps**, cold-starts ~50 s, and stalls queues while down, so the worker must be paid always-on,
(c) doubled secrets/deploy surface/Sentry, (d) version-skew discipline between web and worker
bundles, (e) at-least-once delivery colliding with money effects — every job handler needs its own
idempotency marker because at-least-once ≠ exactly-once. And (f): workers do not buy throughput
against a single-writer libSQL — BEGIN IMMEDIATE serializes all writes anyway (queue.ts doc,
public.ts:730-735); concurrency >1 on write-jobs just moves the SQLITE_BUSY contention into the
queue. The CEO plan's "web + queue + workers" diagram is directionally right **for the 500-tenant
world** and mispriced for this one. If the split ever happens: BullMQ over Bull (maintained, TS),
not SQS (kills local dev parity). Gap.md's dismissal of p-queue/fastq ("lose jobs on crash") is
correct but ignores the middle option below.

**The 7-cron double-run claim (Gap.md:367): accurate, with two precisions.** (1) Mechanically true:
server.ts:241-320 schedules all seven unconditionally in every process; no lease exists, and some
crons mark idempotency only *after* the send (reminderSent set post-dispatch, sendReminders.ts:147;
automation_state post-send, runWinbackAutomations.ts:198), so two overlapping runs double-SMS.
billingReminders is the good citizen (marker-first UNIQUE insert + delete-on-failure). (2) Today's
*practical* exposure is not rolling deploys (Render free stops-then-starts) but the `isDirectRun`
CLI escape hatches (sendReminders.ts:199-233, runWinbackAutomations.ts:226-259): an operator running
`npm run winback-automations` while the server is up runs the same code in two processes. **Minimal
fix, no Redis:** one `cron_leases(job_name, window_key)` table with a marker-first UNIQUE insert —
the exact pattern billingReminders already ships — wrapped around each schedule callback. 2–4 days,
and it is a hard prerequisite for Phase 0's own "prove two web instances + one worker" test.

**Webhook idempotency risk zone.** processed_webhook_events is protected (AGENTS.md:22-23) and the
design is deliberately atomic: re-verify outside the tx, then marker-insert + payment status +
appointment flip + Pro activation + invoice **inside one db.transaction** (payments.ts:73-260;
ARCHITECTURE.md:149-168). A worker split must not touch this: the webhook route keeps its own
transactional update; if any downstream effect (calendar push, BI emit) is queued, the enqueue must
be an outbox row **inserted inside the same transaction** — enqueue-after-commit loses events on
crash; enqueue-before-commit fabricates them; a separate queue client both breaks the atomicity the
P1.2 fix exists to provide. Any proposal that moves payment-status mutation into a consumer is an
automatic reject.

**Turso vs Postgres — the decision point, and why it's not now.** Gap.md's triggers are correct:
(a) need multi-writer, (b) need DB-level exclusion constraints, (c) replica lag visible to users.
None is true: booking correctness rides app-level interval checks inside BEGIN IMMEDIATE
(public.ts:902-914) which is *sufficient* under single-writer at this volume, and no replicas are
deployed (render.yaml). The migration cost is also understated: `migrations.ts` guards are
PRAGMA-based SQLite introspection (migrations.ts:34-42), 1,110 lines, ~41 tables, plus the
raw-libsql transaction behavior (`{behavior:'immediate'}`) and every chain test. Call it 3–5 wks
plus permanent dialect tax. **Recommendation: defer the dialect decision; write the trigger
conditions into docs/decisions/ and revisit at ~100 tenants or first multi-writer demand.**

**Migration staging mapped to CEO Phases 0–4:**
- **Phase 0 (as written: BullMQ+Redis+move dispatch): reject shape, accept goal.** Replace with
  **0a: cron_leases** (S) and **0b: a `job_outbox` table with claim semantics, polled in-process**
  (M) — durable retry, DLQ-as-status-column, audit trail, zero new infrastructure; it is literally
  billing_reminder_sends generalized. Move the blast loop (crm.ts:182-237) onto it first — that's
  the one real defect the queue-to-do is answering.
- **Phase 1 (all crons → queue jobs): hold.** Crons stay in-process behind leases at 25 tenants;
  only campaign fan-out migrates now. Re-examine per-cron when a second process exists anyway.
- **Phase 2 (DB decision): decision, not migration** — record the trigger conditions above.
- **Phase 3 (sync + BI export): first legitimate consumers of the split**; ship the cheap
  substitutes meanwhile (per-staff ICS feeds; weekly export cron).
- **Phase 4 (feature backlog on infra):** agree with the CEO's own list — T7.1–T7.4 messaging
  catalog, T7.8 render-analytics, T7.11 authored record need **no infra**, and they are the
  cheapest 40 points in the file. The queue should fund itself by then, not before.

---

## 3. Effort audit vs COMPARE-04

| # | Rec | COMPARE-04 | My call | Reason (cited) |
|---|-----|-----------|---------|----------------|
| 10 | F-mp-22 waitlist | M | **L** | New entity + claim-token state machine + race-acceptance test; T7.7's own acceptance is a concurrency proof. |
| 16 | F-sa-95 extra time | S | **M** | 3 end-time writers (public.ts:800, bookings.ts:345, v1.ts:158) + padded grid + dual expansion copies (T6.4). |
| 18 | F-bh-48 tips | S | **M** | Money one-way: amount term (:877), charge (:1002), meta, ticket, settlement, gate case. House rule: money path never ships as "S" energy. |
| 5 | F-sa-92 closures | M | **S** | Table + enforcement fully live (public.ts:508-514,651-662); only the writer+UI missing — pure dead-surface resurrection. |
| 24 | F-sa-180 reporting | M | **S** | Fetch wired, render absent (index.tsx:597-598,641-650); zero new queries. |
| 22 | F-sa-242 book link | M | **S** | Embed + share-link exist; QR is a client lib on an existing URL. |
| 7 | F-sa-155 thank-you | M | **S** | Template + one hook at the completed transition (bookings.ts:107-121); no cron, no entity. |
| 19 | F-mp-71 consent | S | **M** | Three consent stores must move atomically (schema.ts:288,420,455); SMS inbound STOP has no provider path at all. |
| 21 | F-mp-26 notes | S | **M** | Append table + staff projection + PDPL erasure matrix (accountDeletion.ts) — the "S" was counting the column, not the file. |
| 6 | F-sa-282 no-show engine | M | **S** | Only the behavioural half is in-scope (fee capture never-do); it's a settings rule that flips the existing upfront-phones list (crm.ts:293-337). |
| 4 | F-bh-58 taxes | M | **M kept, flag** | Webhook amount-verify tolerance is 0.005 birr (payments.ts ~150): tax must be inside `payments.amount` or every webhook no-ops as mismatch. M only if that case is written first. |
| 15 | F-bh-59 offline pay | M | **M kept, flag** | Must decide settlement posture in writing or the 04:00 sweep cries wolf on every cash row (settlements.ts, cron S). |
| tail | F-sa-220 locations | (29+) | **XL** | tenant==location identity rewrite across resolution, 41 tables, disk builds, per-tenant billing. Not a backlog row, a company decision. |
| tail | F-bh-46 terminals / F-bh-60 capital / F-sa-261-262 Google/Meta | GAP | **reclassify** | NOT-feasible-without-X (hardware rail / licensing / partner approval) — effort scoring is meaningless until X exists. |

Also: E-mg-01's Gap description says the blast is Pro-gated; the code shows no plan gate on
`/marketing/blast` (crm.ts:182) — classification input, tree wins (COMPARE-00 §1 discipline).

---

## 4. Dependency graph (unlock order)

```
T6.4 expansion dedup ──► E-ms-05 buffers ──► E-bc-06 sequencing (if ever)
                     └──► E-tp-04 pricing sliver
E-ms-03 closures writer ──► E-ds-07 same-day honesty
                        ├──► fill-rate denominator (analytics.ts:252-255 un-parks)
                        └──► E-bc-03 waitlist "full day" truth
E-cm-01 authored record ──► E-cm-02 allergy ──► (queue card surface)
                        ├──► E-cm-03 intake forms
                        ├──► E-cm-06 files-on-profile
                        └──► E-an-06 birthday (birthdate column)
E-mg-05 reviews entity ──► E-ts-02 report/reply ──► E-ds-05 ratings display
E-mg-01 campaigns table ──► E-ar-02 automation performance
E-bc-03 waitlist ──► E-an-04 (waitlist-joined / slot-available only)
E-pm-08 tip term precedes E-an-04 tip-thanks
E-pm-15 refunds ──► E-pm-09 gift cards ──► E-pm-11 packages   (liability before stored value)
E-pm-17 taxes BEFORE E-pm-08 tips (one itemization model, one effectiveAmount edit — public.ts:877 is
one file; serialize every edit to that line)
E-ms-01 calendar grid ──► E-bc-08 merchant drag ──► E-ai-03′ shared staff calendar ──► E-ms-02/E-tp-03 views
E-ml-01 locations ──► E-ml-02 ──► E-ml-03   (all-or-nothing, defer as a block)
Queue split (only if funded) ──► E-ai-03 external sync, E-ai-05 real connector
Lease table (0a) ──► any second process, incl. the queue itself
```

Independent-of-everything and first-weeks-eligible: E-ds-06, E-ar-01, E-ms-03, E-an-01, E-an-03,
E-bc-07, E-bc-09, E-tp-01, E-tp-05, E-cs-06, E-mg-02's WIN10-lie bugfix, E-pm-15's copy fix.

---

## 5. Money-path register (rule 6)

What `chain-payments-billing.test.ts` asserts **today** (read in full): the **subscription** chain —
checkout → signed webhook → Pro activation + paid invoice + settlement-pending + exactly one
`first_invoice_paid` event (test:60-112); **void invoice never grants Pro** (test:114-147);
**duplicate webhook = no second invoice, no double activation** (test:149-175). Booking-side money
rides sibling chain tests (chain-prepay-billing, chain-webhook-amount — consumers of chapa.ts per
repo-map). The gate therefore constrains anything that touches `payments`, `invoices`,
`subscriptions`, or the webhook transaction; every row below needs the named NEW case.

| Feature | Today's assertion it leans on | Required new case |
|---|---|---|
| E-pm-05 | webhook flips appointment status atomically | per-appointment override: pending+`cancels_at` set/not set by override; amount untouched |
| E-pm-07 | purpose-discrimination in cohort/activation (billing.ts:146-153) | `payment_link` webhook can never reach `activateProSubscription`; replay no-op |
| E-pm-08 | checkout amountCents pinned 100000 (test:69) | tip raises booking charge only; zero-tip booking byte-identical; Pro checkout unchanged |
| E-pm-09 | invoice/payments atomicity | card sold → balance ledger; redemption lowers effectiveAmount exactly once; second redemption rejected; refund-of-card path recorded |
| E-pm-11 | promo in-tx re-check (public.ts:921-927) | package redemption can't stack illegally with promo/loyalty/quiet; expiry case |
| E-pm-15 | (none — refunds absent by design) | "refund issued" ack idempotent, stamps meta, never mutates invoice/settlement; landing-copy==cancel-text test |
| E-pm-16 | void-never-grants case | sale-level void/edit never touches subscription ledger; reprint deterministic |
| E-pm-17 | webhook amount verify ±0.005 birr (payments.ts ~150) | tax-inclusive amount passes provider-verify equality; discount-before-tax rounding order pinned |
| E-pm-18 | completed-payment aggregates (tenant.ts:450-546) | offline row counts/labeled in revenue, settles-at-entry (or excluded from stale sweep), never grants subscription |
| E-pm-19 | — | none until a licensing decision exists; then full loan ledger cases |
| E-ts-03 | pending/cancels_at expiry sweep | auto-flagged phone forced to prepay; no fee amount anywhere |
| E-mg-01 | — (no money in SMS) | campaign-attached code: single-use, consent-gated; blast resume without double-send |
| E-mg-02 | in-tx PROMO_EXHAUSTED re-check | every UI-string discount redeems at the discounted amount; upward adjustment still impossible |
| E-an-06 | same promo path | recipient-locked welcome/birthday code: maxUses=1, expiry, opt-in SQL gate |
| E-bc-09 | — | reason column export-only assertion; cancel response refundNote wording stable (rule: no money) |
| E-ml-02 | payments.amount immutability of ledger | attributed split sums to original amount exactly; no new money |
| E-mg-06 (reward code) | loyalty consume-after-success pattern (:1033-1045) | referrer code lowers next charge once; self/same-phone referral refused |

Any row where the answer to "move, record, or promise money?" is **move** is CEO territory
(kb-ground-rules:113-120): of the register, only E-pm-07/15/16/17/18 approach "record"; nothing here
is permitted to "move" beyond the existing telebirr capture.

---

## 6. Reclassification asks (summary)

- **NOT-feasible-without-X:** E-pm-06 (terminal rail), E-pm-19 (credit licensing), E-ai-04 (partner
  program), E-ds-04 (coordinate/address data), E-ca-02's SMS-inbound half (inbound SMS provider).
- **INFRA-BLOCKED (keep):** E-ai-03 *external-sync half only*; E-ai-05 *continuous half* — both now
  carry rule-20 substitutes (per-staff ICS feeds; weekly export cron).
- **De-classify:** E-ai-03's shared-calendar core is a normal M feature.
- **Effort changes:** the table in §3.

B — done. Queue question answered: build the lease and the outbox, not the Redis.
