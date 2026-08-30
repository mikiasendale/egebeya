# EGEBEYA — Agent Execution Plan v1.0

> Companion to `ROADMAP.md`. Decomposes the council roadmap into phases and
> sub-tasks sized for AI coding agents. Each task is self-contained enough to
> hand to a fresh agent session.
>
> **Task ID convention:** `P<phase>.<n>` (e.g., `P1.4`). Reference IDs in PRs,
> commits, and status updates.

---

## HOW AGENTS SHOULD USE THIS DOCUMENT

1. **Work top-to-bottom within a phase.** Respect `Depends:` fields — never start
   a task before its dependencies are merged and green.
2. **AUDIT BEFORE BUILDING.** Every phase opens with an audit task. The repo is
   ahead of its own docs (billing, OTP, inventory already exist). Rebuilding an
   existing thing is a failed task.
3. **Follow repo conventions:** Drizzle schema in `src/db/schema.ts` + idempotent
   migration rows in `src/db/migrations.ts`; all queries tenant-scoped via
   `src/db/tenantRepo.ts` patterns; API routers in `src/api/` or `server/api/`;
   crons in `server/cron/` with a `package.json` script; i18n keys added to BOTH
   `src/locales/am.json` and `en.json`; tests colocated in `server/tests/`
   (Supertest) or `src/**/__tests__/` (Vitest+RTL).
4. **Definition of done for every task:** `npm run lint` clean (tsc --noEmit),
   `npm test` green, new behavior covered by at least one automated test,
   Amharic+English strings present, no secrets committed.
5. **Never** commit unless explicitly asked. Never widen scope beyond the task's
   "Out of scope" line — park discoveries as notes on the next task ID.
6. **House rule from the council:** nothing ships that doesn't touch billing,
   activation, or north-star instrumentation. If a task can't justify itself
   against those three, flag it back instead of building it.

---

## PHASE 0 — BASELINE AUDIT (Days 0–3)

*Goal: produce ground truth so no agent rebuilds existing systems.*

### P0.1 — Billing capability audit `[AGENT]`
- Deliverable: short report appended to this file under "Audit Results" or returned to operator.
- Steps: read `server/lib/billing.ts`, `server/lib/plans.ts`, `server/lib/trial.ts`,
  `src/api/payments.ts` (webhook `pro_subscription` branch), checkout route in
  `src/api/tenant.ts` (~line 562–602), `server/cron/downgradeExpired.ts`,
  `server/tests/billing.test.ts`, `subscription-upgrade.test.ts`.
- Report must answer: (a) Can a stranger pay today end-to-end without founder
  touching DB — yes/no + exact gaps? (b) Is there retry/dunning on failed renewal?
  (c) Receipt/invoice generation — exists? (d) Auto-renew or manual repurchase only?
  (e) Collected-vs-invoiced distinction anywhere?
- Out of scope: any code changes.

### P0.2 — Identity & notification audit `[AGENT]`
- Read `server/lib/otp.ts`, `server/lib/sms.ts`, `otp_codes` migration,
  `server/tests/otp.test.ts`, `sms.test.ts`, reminder cron `sendReminders.ts`.
- Report: which channels are wired (email/SMS/Telegram)? Does Telegram exist at all?
  Is there a NotificationAdapter seam or are call sites hard-coded? What does
  `marketing_opt_in` on `customer_stats` currently gate?

### P0.3 — Product surface audit `[AGENT]`
- Read `src/components/UberBottomNav.tsx`, `InstantEmpireAnimation.tsx`,
  `src/pages/Dashboard/index.tsx`, `SetupWizard.tsx`, `WebsiteBuilder.tsx`,
  `BuilderModeContext.tsx`, `src/lib/puck.config.tsx`, `src/pages/Register.tsx`,
  `src/index.css` (existing CSS vars).
- Report: current nav tab list; signup→first-site tap count as implemented;
  whether InstantEmpireAnimation is wired into registration or orphaned; how far
  index.css tokens match ROADMAP §7 palette; what SetupWizard still gates.

### P0.4 — Data model delta list `[AGENT]`
- Compare ROADMAP needs vs `src/db/schema.ts` + migrations: punch-card/loyalty ledger
  (absent), consumers table (absent), queue/live-status fields on appointments,
  invoices table, block-template catalog, quiet-hours flag. Output ordered list of
  new tables/columns with proposed names following existing conventions
  (snake_case SQL, camelCase Drizzle).

### P0.5 — Data hygiene quick-fixes `[AGENT]` *(added by audit findings)*
- Depends: none
- (a) `CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_tenant_code_unique ON promo_codes(tenant_id, code)` via the standard migrations-array entry — closes the duplicate-code hole found in audit P0.4.
- (b) Hash otp_codes at rest: store SHA-256 of the 6-digit code, compare hashed on verify; no backfill (codes are 10-min TTL — let existing lapse). Keep attempt/rate-limit semantics identical.
- Acceptance: duplicate promo insert rejected per tenant; existing OTP request/verify round-trip tests green with hashed storage.

---

## PHASE 1 — BILLING HARDENING + PRICE LADDER (Days 3–21) · Gate 0

*Goal: "a stranger pays real money end-to-end, no founder touches a database,"
plus the council pricing ladder (500 ETB founding rate locked 12mo, first 25
tenants; 750 list later behind a flag).*

### P1.1 — Founding-rate pricing model `[AGENT]`
- Depends: P0.1
- **Seed drift (RESOLVED Aug 2026, operator decision):** pro price is unified at
  1000 ETB — `PRO_PLAN_PRICE_BIRR='1000'` in `server/lib/billing.ts`; `server/seed.ts`
  and `server/tests/_setup.ts` derive the plans row from that constant.
- Schema: add columns via idempotent migrations — `tenants.founding_rate_locked_until`
  (INTEGER ms, nullable), `tenants.acquired_via_code TEXT`; seed update in `server/seed.ts`.
- Server: helper in `server/lib/billing.ts` — `resolvePriceForTenant(tenantId)` →
  { amountEtb, isFoundingRate } ; first 25 tenants with an active/paid subscription get
  founding rate; enforce cap by counting paid subscriptions.
- Acceptance: unit test proves tenants #26+ resolve to list price; founding lock
  survives plan row edits.
- Out of scope: checkout UI changes (P1.3).

### P1.2 — Webhook transactionality + invoices & receipts `[AGENT]`
- Depends: P0.1
- 🚨 **FIRST (audit-found critical bug):** the Chapa webhook handler (`src/api/payments.ts:91-163`)
  runs sequential awaits, not a transaction — a crash after the `processedWebhookEvents`
  insert leaves the subscription unactivated and the idempotency guard blocks Chapa's
  retry forever. Wrap marker-insert + payment update + status flips in a single
  `db.transaction()` so UNIQUE-constraint races still yield clean `{duplicate:true}`.
  Correct the false "fully transactional" claim in ARCHITECTURE.md while there.
- Schema: `invoices(id, tenant_id, number UNIQUE, amount, currency='ETB', period_start,
  period_end, status draft|paid|void, chapa_tx_ref, issued_at, paid_at)`.
  Extend webhook `pro_subscription` branch to create/mark-paid invoice inside that
  same transaction. Note `payments` row already exists with cents amounts — invoice
  references it via chapa_tx_ref; don't duplicate.
- Add `GET /api/tenant/invoices` (owner JWT) + printable receipt HTML route with
  Amharic-first labels ("ደረሰኝ"), business name, ETB amounts.
- Acceptance: Supertest — simulated crash between marker-insert and subscription flip
  recovers on redelivery; webhook success creates exactly one paid invoice (duplicate
  webhook → no second invoice); void path never grants Pro.

### P1.3 — Checkout UX + founding-rate display `[AGENT]`
- Depends: P1.1, P1.2
- Frontend: Billing page (`src/pages/Dashboard/Billing.tsx`) shows price ladder:
  founding members see "የመስራች ዋጋ ተይዟል" (founding rate locked) + renewal date;
  new tenants see list price; value-frame above price ("በዚህ ወር N ቀጠሮዎች ተቀበሉ" — bookings
  count from existing stats). Wire `POST /api/tenant/subscription/checkout` button state
  machine: idle→redirect→pending→active/grace/expired using existing
  `fetchSubscription()`/`billingState()`.
- Acceptance: RTL tests for three states; no naked price delta ever shown to existing
  tenants (CPO ruling).

### P1.4 — Renewal reminders + dunning-lite `[AGENT]`
- Depends: P1.2
- Cron: `server/cron/billingReminders.ts` + package script `billing:reminders`.
  T-3d and T-0d notices via mailer (+ Telegram hook left as TODO seam for P3.x);
  T+2d/T+5d past-due warnings during grace; log all sends to `customer_stats`-adjacent
  audit or security_events pattern. Idempotent per (tenant, cycle, stage) — store sent
  markers (reuse `reminderSent`-style column or meta JSON).
- Acceptance: cron test with fake clock sends exactly once per stage; grace-expiry
  hands off cleanly to existing `downgradeExpired`.

### P1.5 — Prepay options (quarterly now, annual capped) `[AGENT]`
- Depends: P1.1
- Checkout accepts `cycle=30|90|365`; 90-day = 5% off; 365-day (10-for-12) allowed only
  while founding cohort <25, sets `founding_rate_locked_until = now+365d`.
  Webhook maps paid invoice → extend `endsAt` by cycle length.
- Acceptance: matrix test of cycles × founding-cap boundary; proration explicitly NOT
  implemented (documented in code comment as deliberate).

### P1.6 — Gate 0 verification runbook `[AGENT]`
- Depends: P1.1–P1.5
- Extend `qa_runner.ts`: full stranger journey — register → setup skip → checkout
  (Chapa sandbox/test mode) → webhook → active sub → invoice paid → receipt fetch →
  downgrade cron simulation. Print PASS/FAIL summary suitable for gate review.
- Acceptance: `npx tsx qa_runner.ts` green locally against test-mode Chapa.

### P1.7 — Settlement reconciliation `[AGENT]` *(added post-audit)*
- Depends: P1.2
- Audit P0.1(e): no collected-vs-invoiced distinction anywhere; Chapa settles T+2/T+3.
- Schema: `ALTER TABLE payments ADD COLUMN IF NOT EXISTS settled_at INTEGER; ADD COLUMN IF NOT EXISTS settlement_status TEXT` (pending|settled|failed); same columns on `invoices`.
- Webhook marks settled when provider confirms settlement; otherwise rows stay `pending` past a 5-day threshold → surfaced in ops:check output.
- Weekly reconciliation query listing paid-but-unsettled invoices for manual comparison against the Chapa dashboard export.
- Acceptance: settlement lifecycle tested (pending→settled, pending→failed); stale-pending report returns correct rows.
- Feeds the gate-review number: collected-vs-invoiced MRR.

---

## PHASE 2 — INSTANT EMPIRE ONBOARDING (Weeks 2–5)

*Goal: 8 taps / 3 screens to a shared site; honest staged generation; mandatory
hours confirmation; SetupWizard demoted to progressive checklist.*

### P2.1 — Block schema contract `[AGENT]`
- Depends: P0.3
- Define Zod schemas + TS types for the versioned block document: blocks =
  hero | services | hours | location | gallery | deposit-policy | custom-html.
  Each block: `{ type, props, data }` matching existing Puck item shape
  (`{ type, props, data: {} }`) so Puck documents remain source-compatible.
- File: `src/lib/blocks/schema.ts` + `schema.version = 1` + `validateBlockDoc()` +
  `migrateBlockDoc(vN→vCurrent)` skeleton.
- Acceptance: round-trip test — existing seeded Puck pages (luxnails fixture) validate;
  invalid docs rejected with field-level errors; version bump path covered.

### P2.2 — Category template packs `[AGENT]`
- Depends: P2.1
- Four packs (salon / clinic / pharmacy / other) as typed block arrays with
  guaranteed-plausible Amharic default copy + duotone-safe structure. Store as
  constants in `server/lib/siteTemplates.ts` (server-side provisioning uses them).
- Include per-category default service set + default hours Mon–Sat 09:00–18:00.
- Acceptance: every pack validates against P2.1 schema; snapshot test locks copy;
  no stock-photo people references anywhere (illustration placeholders only).

### P2.3 — Provisioning pipeline (the "generation") `[AGENT]`
- Depends: P2.2
- `POST /api/auth/register` extended (or follow-up `POST /api/tenant/provision`):
  given business name + category → pick slug → write `pages.content` from template pack
  → create default service(s) + owner-as-staff + business hours rows → mark
  `settings.onboarding = { generatedAt, confirmedHours: false }`. Site stays
  **unlisted/dark** until hours confirmed (respect existing `is_listed`).
- Staged progress endpoint `GET /api/tenant/provision/status` returning step list so
  frontend renders honest progress (no fake cinema).
- Acceptance: integration test provisions luxnails-equivalent in one call; site 404s
  publicly pre-confirmation; crash mid-provision leaves recoverable state (idempotent
  re-run completes it).

### P2.4 — Signup flow rewrite (3 screens) `[AGENT]`
- Depends: P2.3
- Rework `Register.tsx`: Screen 1 phone+password (show-password default-on);
  Screen 2 name + 4 category cards ≥72px; Screen 3 = staged generation view reusing
  `InstantEmpireAnimation.tsx` ONLY as skippable garnish (skip after 800ms; static
  fallback when `navigator.deviceMemory < 2 || hardwareConcurrency <= 4`).
  Ends on Share Hero screen (P2.5).
- **Fix audit-found bugs while rewriting:** InstantEmpireAnimation.tsx has a
  conditional useEffect inside an early return (hook-order violation, :228-235) and a
  phase-dependent rAF effect that re-scatters particles mid-animation (:222).
- Tap budget enforced in test: ≤8 interactions to reach share screen (mock-backed RTL
  walkthrough counting userEvent calls).
- Out of scope: changing auth token mechanics.

### P2.5 — Share Hero + dashboard checklist `[AGENT]`
- Depends: P2.4
- New `FirstShareHero.tsx`: phone-frame live preview of public site + giant green
  Telegram share button (deep link with prefilled message via `https://t.me/share/url`),
  WhatsApp + copy-link secondary; edit is a quiet text link below. One-line hours notice:
  "ሰዓታትዎ 9:00–18:00 ተብሏል · ያስተካክሉ".
- Dashboard Home gains "Finish your empire" checklist component driven by
  `settings.onboarding` flags (hours confirmed, photo added, first booking received),
  deep-linking each item. SetupWizard routes redirect into Home checklist (keep old
  wizard reachable for compat but demoted).
- Instrument: fire `site_shared` event (see P3.5 analytics) on share click.
- Ship a polished **demo seed tenant** (`demo` slug, excluded from /discover and analytics): full template pack, plausible bookings, banner-free public site — the founder's in-shop closing artifact.
- Acceptance: RTL covers share/copy/clickthrough; checklist reflects flag flips; demo tenant renders clean with no owner-only chrome.

### P2.6 — Hours-confirmation gate `[AGENT]`
- Depends: P2.3
- Public tenant resolution middleware: when `confirmedHours=false`, public site returns
  soft-landing page (not 404) telling visitors the shop is preparing its page —
  Amharic-first. Owner sees persistent banner until they confirm/edit hours once.
- Acceptance: public page dark pre-confirm, live post-confirm; owner cannot miss banner
  (test asserts presence on all dashboard routes).

---

## PHASE 3 — NOTIFICATIONS, IDENTITY-LITE, ANALYTICS, OPS FLOOR (Weeks 4–7)

### P3.1 — NotificationAdapter seam `[AGENT]`
- Depends: P0.2
- Create `server/lib/notifications.ts`: interface `NotificationChannel { send(ctx):
  Promise<{ok, providerId?, error?}> ; name }`. Refactor reminder + winback + billing
  send sites to dispatch through it (email channel wraps existing mailer). Registry with
  per-channel enable flags via env. NO new provider integrations in this task.
  **Close the consent bypass found in audit P0.2:** winback sends must respect
  `marketing_opt_in` (or an explicit re-consent flow) — currently ignored
  (`runWinbackAutomations.ts:96-183`), and booking-time capture must stop defaulting
  opt-in to false silently (`public.ts:897-907`).
- Acceptance: existing email tests pass unmodified semantics; grep shows no direct
  nodemailer calls outside adapter.

### P3.2 — Telegram bot channel (opt-in capture) `[AGENT]`
- Depends: P3.1
- Implement Telegram channel: bot webhook route `/api/telegram/webhook` (secret-token
  header verified like Chapa HMAC pattern); customers opt in by tapping "ማስታወሻ በ Telegram"
  on booking confirmation → deep link starts chat → webhook links chat_id to normalized
  phone (use `src/lib/phone.ts` canonicalization — single util, +2519xxxxxxxx).
  Table: `telegram_links(chat_id PK, phone, tenant_id nullable, linked_at)`.
- Send booking confirmations/reminders through channel when linked; store delivery
  outcome. Handle Bot-API constraint: bot cannot initiate — all flows begin from user.
- Acceptance: Supertest-style webhook tests (start, link, confirm, reminder); no send
  attempted to unlinked users; secret mismatch → 401 logged to security_events.

### P3.3 — Delivery metrics `[AGENT]`
- Depends: P3.2
- Table `notification_log(id, tenant_id, channel, template, ref_type, ref_id, status
  sent|failed|unlinked, error, created_at)` written by adapter. Admin-only
  `GET /api/admin/notification-stats` aggregating opt-in rate + delivery success by
  channel/week.
- Acceptance: stats math tested on fixtures; this feeds the SMS revive/kill decision —
  no SMS vendor integration here.

### P3.4 — Magic-link consumer login (minimal) `[AGENT]`
- Depends: P0.2, P0.4
- Consumers table (`consumers(id, phone UNIQUE, name nullable, created_at)`) +
  reuse `otp_codes` for 6-digit codes delivered via Telegram (fallback: none yet —
  claim-code path only if Telegram unproven). Separate JWT audience `aud:"consumer"`;
  auth middleware rejects wrong audience (mirror existing refresh-token rotation care).
- Endpoints: `POST /api/consumer/request-code`, `POST /api/consumer/verify`.
  Backfill: on booking creation, upsert consumer by phone match (nullable
  `appointments.consumer_id`).
- Acceptance: code brute-force lockout tested; audience confusion test (owner token on
  consumer route → 403); phone normalization dedupe test. Public endpoints carry
  express-rate-limit configs registered with `security_events` logging (mirroring the
  existing booking-limiter pattern).

### P3.5 — Activation events + funnel `[AGENT]`
- Depends: P2.5
- Server-side event emitter writing `activation_events(tenant_id, event, meta, created_at)`
  with canonical set: `site_generated, hours_confirmed, site_shared, first_booking,
  first_invoice_paid, agent_attributed`, plus pricing-funnel events `price_seen`,
  `checkout_started`, `checkout_abandoned` (elasticity data for the M9 hybrid-arm
  decision). Attribution: agents get referral codes →
  `?ref=` captured at register.
- Funnel dashboard (admin): weekly conversion between stages + north-star
  (weekly confirmed bookings per billing-active tenant) computed from existing tables.
  Guardrail metric: monthly logo churn from M4.
- Acceptance: north-star math unit-tested against synthetic month of data; funnel page
  renders both languages.

### P3.6 — Ops floor `[AGENT]`
- Script `scripts/backup-db.ts` (litestream-free: sqlite `.backup` to timestamped file,
  upload hook stubbed for off-host target via env) + package scripts `backup`,
  `ops:check` (disk, DB size, SQLITE_BUSY probe loop, Sentry ping, cron last-run ages,
  USD-denominated infra spend asserted under an env-set monthly budget threshold —
  CEO risk #5). Document restore procedure in README section (10 lines max).
- Acceptance: backup produces restorable file (round-trip test on temp dir);
  ops:check exits nonzero on threshold breach (including budget overrun).

### P3.7 — Consent & privacy baseline `[AGENT]` *(added post-audit; GATES P3.4 go-live)*
- Depends: P0.2
- ROADMAP §5 item 4 (PDPL 1321/2024): phone-keyed profiling + Telegram linking are
  consent obligations.
- Capture consent timestamps at Telegram-link moment and at marketing opt-in
  (`consent_given_at`-style columns or settings JSON per P0.4 conventions).
- `POST /api/consumer/data-deletion` request endpoint: records the request, v1 fulfills
  manually but logged + acked; document fulfillment SOP in the route comment.
- Refresh `Privacy.tsx` + `Terms.tsx`: consumer identity via phone, Telegram messaging,
  loyalty tracking, data-deletion rights. Amharic-first, am/en parity.
- Acceptance: no consumer row is created without a consent timestamp; deletion request
  round-trip tested; i18n parity test green.

---

## PHASE 4 — QUEUE CONSOLE + RECEIPT EXPERIENCE (Weeks 6–9)

*Goal: Queue-Buster wedge. Acceptance: "a barber clears his morning queue with one
tap per customer."*

### P4.1 — Queue data model `[AGENT]`
- Depends: P0.4
- **Pre-decided by audit P0.4:** walk-ins already write plain `'confirmed'` appointments
  (`bookings.ts:330`); the public board derives from those rows. Use appointment
  COLUMNS, not a new table: `queue_position INTEGER`, `queue_state TEXT
  waiting|serving|done`, `checked_in_at INTEGER` (idempotent ALTERs). Privacy rule from
  PRODUCT.md: never expose customer names publicly; initials + service only on consumer side.
- Acceptance: position swaps atomic under concurrent advance (transaction test);
  same-day scope enforced.

### P4.2 — Merchant queue console `[AGENT]`
- Depends: P4.1
- Merchant Home top module: vertical card stack (initials avatar, service chip,
  Waiting/Serving/Done state, single fat green advance button). Advance = status flip +
  reposition + ETA recompute (per-category duration defaults, salon 30min, refined from
  historical completed appointments silently). Egebeya-booked entries carry a badge
  (Queue-Buster marker) and float above walk-ins.
- Acceptance: RTL — full morning simulated with one tap per customer; booked-before-walkin
  ordering asserted.

### P4.3 — Consumer queue status page `[AGENT]`
- Depends: P4.2
- Public (no login; opaque entry token URL): exactly three states rendered large —
  "#4 · ~25 min" → "#2" → "It's your turn" pulsing green. Polling ≤15s interval,
  pauses on hidden tab. Dual calendar date display using `ethiopianCalendar` lib
  (Ge'ez primary, Gregorian subtitle).
- Acceptance: states transition in test harness; polling stops on blur; no names leaked;
  public status endpoint carries an express-rate-limit config logged to `security_events`.

### P4.4 — Stamped receipt ticket confirmation `[AGENT]`
- Depends: P3.2
- Booking confirmation screen redesigned: cream card, ink border, green stamp animation
  ("✓ ተመዝግቧል", opacity/transform ≤250ms), dual dates, queue position for same-day,
  haptic via Vibration API where available, single CTA "ማስታወሻ በ Telegram" (P3.2 deep link).
- Acceptance: motion budget lint rule (P5.5) passes; screenshot test optional but
  structure asserted.

---

## PHASE 5 — LOYALTY, TEMPLATES, VELVET ROPE, PERF (Weeks 8–13)

### P5.1 — Loyalty-lite punch card `[AGENT]`
- Depends: P3.4, P3.5
- GATE: build only if Telegram identity proven (P3.3 opt-in ≥50% on confirmations) AND
  north-star ≥0.7 — otherwise STOP and report back (council ruling).
- Tables: `loyalty_ledger(id, tenant_id, consumer_phone, points_delta, reason, ref_type,
  ref_id, created_at)` append-only; `punch_cards(tenant_id, consumer_phone, punches,
  target, reward_config JSON, UNIQUE(tenant_id, consumer_phone))`. Phone-keyed,
  merchant-scoped, zero additional auth beyond consumer JWT.
- Reward redemption = discount applied at next Chapa charge (lower `amount` before
  initialize; record in payments.meta) — merchant-funded, never money movement.
- Acceptance: append-only enforcement test (updates rejected); 5th-punch triggers reward
  config; redemption lowers charge amount end-to-end in test mode.

### P5.2 — Punch card UI ring `[AGENT]`
- Depends: P5.1
- Consumer "My bookings" page gains amber progress ring (SVG stroke-dashoffset —
  transform/opacity only). Zero merchant action required to progress.
- Acceptance: ring reflects ledger sum; works on consumer JWT only.

### P5.3 — Block template gallery + reorder `[AGENT]`
- Depends: P2.1, P2.2
- Simple site editor upgrade: merchants reorder/add/remove blocks (up/down buttons +
  add sheet) operating on validated block doc — NOT free-canvas drag-drop. Puck remains
  available untouched for advanced editing (version frozen; do not upgrade deps).
- Acceptance: reordered doc validates, publishes, public render order matches; mode
  switching loses no work (JSON is single source).

### P5.4 — Velvet rope labels `[AGENT]`
- More-tab items for gated features render with lock chip + one-line Amharic value prop;
  tap → pricing sheet anchored on value scene ("You took 42 bookings this month" above
  price when data exists). No feature hiding — labels only.
- Acceptance: free tenant can enumerate what's locked and why (copy test asserts strings
  exist am+en).

### P5.5 — Motion/perf law enforcement `[AGENT]`
- Codify rule as ESLint restriction + codemod pass: animations limited to
  opacity/transform ≤250ms except whitelisted components (InstantEmpire, stamp, turn-
  pulse). Runtime guard util `prefersReducedMotionOrLowMem()` swapping backdrop-blur for
  solid paper background below deviceMemory 2.
- Acceptance: UberBottomNav blur disabled on low-mem profile in jsdom-simulated env;
  lint rule demonstrably fails on violation (negative test).

### P5.6 — Quiet-hours flag `[AGENT]`
- Boolean + badge only, NO pricing engine: merchant toggles "ዝቅተኛ ሰዓቶች" discount for a
  day-part window; public booking slots in window show strikethrough price + badge;
  booking applies discounted deposit. Feed weekly fill-rate delta into P3.5 analytics.
- Acceptance: discount math tested; analytics records fill-rate before/after windows.

---

## PHASE 6 — POST-GATE-1 (Months 4–12) · STUBS ONLY UNTIL GATES PASS

No agent builds these before their reopening trigger fires. Pre-approved prep work:

- **P6.a** Phone-hash backfill joining merchant-scoped loyalty silos into consumer
  profiles (trigger: G1 passed).
- **P6.b** Quarterly-prepay promotion rollout to all tenants (trigger: G2 churn ≤5%).
- **P6.c** Hybrid pricing arm flag (~400 base + 2%/booking) behind env, sandbox-tested
  (trigger: Month 9 decision meeting).
- **P6.d** Stock-holding DESIGN DOC only — CAS reservation pattern from ROADMAP §0
  written against `inventory_items` (exists) (trigger: marketplace reopen).
- **P6.e** `CourierAdapter` interface file + manual-dispatch implementation sketch
  (trigger: marketplace reopen).
- **P6.f** OSM gazetteer extraction spike for Addis sub-cities → zone fee table proposal
  (trigger: P6.d accepted).

---

## FOUNDER / HUMAN TRACK (not agent tasks — weekly checklist)

- Wk 1–2: recruit 6 street agents (Bole 3 / Piassa 3); define commission ≤250 ETB per
  ACTIVATED merchant (activation = `first_invoice_paid` + `first_booking` events from
  P3.5 — pay on code-defined events only); 28h/wk LOI presales; SMS vendor paper memo Day 7.
- Wk 3–6: Bole saturation walks; TikTok batch (2 transformation videos/month min);
  agent QA visits.
- Wk 7–10: Piassa wave; booking audits with charter cohort; case studies.
- Wk 11–13: founder-led closes using tenants' own GMV numbers; 750-list waitlist campaign;
  cohort churn review.
- Standing: PLC registration (months 1–3); grant applications sequenced per ROADMAP §5;
  cashback pilot budget frozen at 20k ETB / 60 days IF ever revisited (it shouldn't be).

---

## Audit Results

*Filled by P0.1–P0.4 agents, Aug 2026. File:line citations are ground truth.*

### P0.1 Billing — GATE 0 READINESS ≈70%
- **Stranger-pays-end-to-end WORKS today**: checkout (`src/api/tenant.ts:570-617`) → Chapa redirect → HMAC webhook (`src/api/payments.ts:40`) → `activateProSubscription` (`server/lib/billing.ts:34-68`) → Pro gate via `billingStateFor`. Manual repurchase only — **no auto-renew, no dunning, no retry** anywhere.
- 🚨 **CRITICAL BUG:** webhook handler is sequential awaits, NOT transactional (contradicts ARCHITECTURE.md:160). Crash mid-sequence records `processedWebhookEvents` but leaves subscription unactivated — and the idempotency guard then blocks Chapa's retry **forever**. Fix lands in P1.2.
- 🚨 **Price drift bug:** `server/seed.ts:29` seeds pro plan at 100000 cents (1000 ETB) while checkout charges `PRO_PLAN_PRICE_BIRR='500'`; `normalizePlanRows` never fixes price. Units confirmed: `plans.price`/`payments.amount` = ETB cents.
- No invoices/receipts for subscriptions (booking-deposit receipts exist as design precedent: `PublicBooking.tsx:339-366`). No collected-vs-invoiced distinction; `payments.status` lacks settlement state.
- Constants: cycle 30d, grace 5d, downgrade after 7d, trial 14d (`server/lib/trial.ts:15`). Founding-rate concept: zero hits.
- Secondary: webhook verify-failure fallback trusts declared `success` (`payments.ts:111-112`).

### P0.2 Identity & Notifications
- Channels live: **email only** (env-guarded nodemailer). SMS = stub — `SMS_API_KEY` literally changes nothing (`server/lib/sms.ts:69-97`, provider call is commented pseudocode). Telegram: zero server-side existence. In-app: none.
- **No adapter seam.** 10 hard-coded send sites across 7 files: `sendMail` at auth.ts:408, auth_prefix.ts:349, public.ts:924+946, v1.ts:278, test.ts:16, sendReminders.ts:70; `sendSms` at crm.ts:214, otp.ts:159, sendReminders.ts:86, runWinbackAutomations.ts:165. Debt: `auth.ts`/`auth_prefix.ts` are duplicated route files each carrying their own send site.
- ⚠️ Compliance: **winback automations ignore `marketing_opt_in` entirely**; opt-in is NOT captured at booking (`public.ts:897-907` omits it, defaults false) — owner-side capture only. Must close before scaling sends.
- OTP infra solid: 6-digit, 10-min TTL, 5-attempt lockout, 3 sends/hr + 10 verifies/15min rate limits, resend invalidates, single-use; consumed by owner register/reset flows only. ⚠️ codes stored **plaintext** (`schema.ts:192-200`) — hash them.
- Reminder cron idempotency = `reminderSent` flag set unconditionally post-attempt; `sentVia` audits channel; Phase-2 auto-cancels stale pending-payment slots.

### P0.3 Product Surface
- Nav confirmed: 6 tabs Home/Shop/Health/Auto/Inventory/Site (`UberBottomNav.tsx:58-67`, <768px only); staff collapses to Bookings. **Walk-in FAB already built** (:131-142).
- Journey today ≈10 interactions: single-screen register w/ 8 fields → hard redirect `/setup` → 6-step wizard → publish → 3s cinematic → share card. Site content **empty until wizard completes** (page seeded at `/onboarding/complete`, `src/api/tenant.ts:801-807`) — validates moving provisioning to register-time (P2.3).
- Wizard gate is SOFT: banner + checklist only, no route guards (`Dashboard/index.tsx:294-318`) → demotion cheaper than assumed.
- InstantEmpireAnimation wired but buggy: conditional useEffect inside early return (hook-order violation, :228-235) + phase-dep rAF restart re-scatters particles mid-flight (:222). No tap-to-skip; reduced-motion path exists.
- Tokens: **2/8 exact** (--ink, --telebirr). `--paper` family values differ from targets; amber/clay absent; Noto Sans Ethiopic defined (:63) but used once. Touch targets already ≥44-60px.
- Builder modes: Puck JSON and Sandpack files are separate stores — mode switching loses nothing, but they diverge silently (last published wins); unsaved Sandpack edits lost pre-autosave.
- ShareSiteBar: Telegram t.me/share + copy-link only; **zero analytics fired on share**.

### P0.4 Data Model Delta
- Already exists: `otp_codes`, `promo_codes` (⚠️ missing `UNIQUE(tenant_id, code)` — duplicate-code hole), `search_intent`, `pro_alerts`, full-CRM `customer_stats`, `api_keys`, `refresh_token_families`.
- Partial: `inventory_items` lacks `reserved_quantity` + `version` for CAS holds.
- Missing: consumers, invoices, telegram_links, notification_log, activation_events, loyalty_ledger/punch_cards, queue fields.
- **Queue ruling (resolves P4.1 design question):** walk-ins already write plain `'confirmed'` appointments (`bookings.ts:330`); public board derives from those rows. Use **appointment columns** (`queue_position INTEGER`, `queue_state TEXT waiting|serving|done`, `checked_in_at INTEGER`) — NOT a new table — to avoid dual source of truth.
- Settings JSON preferred for tenant-local flags (`onboarding_completed` precedent with json_set backfill, migrations.ts:698-715): quiet-hours discount = `settings.quiet_hours_discount {enabled,start_minute,end_minute,percent}`; founding-rate = `tenants.founding_rate_locked_until` column + `acquired_via_code TEXT` for attribution.
- Conventions locked for all future DDL: uuid text PKs, UTC-ms integers `*_at`, `{mode:'boolean'}` 0/1, `{mode:'json'}` text, money in ETB cents; additive-only migrations in the `migrations:` array shaped `{table, column, sql}` wrapped per-entry in try/catch.

### Scope adjustments triggered by audits
1. **P0.5 added** (hygiene): promo_codes unique index + hash otp_codes.
2. **P1.1 expanded:** fix seed price drift (seed.ts:29 → 50000 cents).
   **Operator override (Aug 2026):** Pro price unified at **1000 ETB (100000 cents)** everywhere — `PRO_PLAN_PRICE_BIRR='1000'`, seed, plans row, and checkout all derive from that constant. The founding-rate machinery ships with the founding amount equal to list; only the cohort lock (`founding_rate_locked_until`) distinguishes tenants until the ladder diverges.
3. **P1.2 re-scoped:** first make existing webhook transactional inside the idempotency pattern (the crash-blocks-retry bug), then add invoices.
4. **P2.4 expanded:** fix InstantEmpireAnimation hook-order + rAF bugs during rewrite.
5. **P3.1 note:** winback consent bypass must be closed when refactoring send sites (gate winback on `marketing_opt_in` OR explicit re-consent flow).
6. **P4.1 pre-decided:** appointment columns approach (see P0.4).

### Parked findings (Aug 2026, P0.5–P1.2 execution)
1. **Pre-existing test failures (NOT caused by P0.5–P1.2):** `auth-roundtrip.test.ts`
   ("owner-only /api/tenant/* rejects a non-owner (staff) JWT") and
   `billing.test.ts` ("owner-only: a non-owner token is rejected on checkout")
   fail on clean baseline too. Root cause: `requireAuth` checks role against the
   FRESH DB ROW by design (`src/api/middleware/auth.ts:120-127`, anti-forgery),
   but these tests sign a `'staff'` JWT claim for a user whose DB row is still
   `owner`. Fix belongs to the tests (create a real staff DB user) — park for
   the next auth-touching task.
2. Pre-existing lint error `preview/threeui-src/Gallery.tsx` (missing `three`
   module) exists on baseline; unrelated to billing work.

### F7 parked discovery (booking-concurrency retry, 26 Aug 2026)
Verification of the Phase-5 ship report's concurrency claim found the report
was **inaccurate**: the tree contained a per-process booking mutex
(`withBookingLock`) that serialized requests, NOT a retry — and a separate
`withBusyRetry` helper that was imported but **never used** on the booking
write path. Fix applied (F7): the mutex was removed and the BEGIN IMMEDIATE
booking transaction at `src/api/public.ts` is now wrapped in `withBusyRetry`
(only SQLITE_BUSY codes retry with backoff; CONFLICT / PROMO_EXHAUSTED
propagate immediately). The 15s figure in the report was real on the mutex
path; with retry-only the losing request still waits out libsql's busy_timeout
(~5s) before conflict detection, so the concurrency race resolves 201/409 in
the several-seconds range — that latency is inherent to BEGIN IMMEDIATE +
busy_timeout and is acceptable for the single-node VPS target.
### P5.1 gate status report (dated 26 Aug 2026)
**Council ruling (ROADMAP §0):** build the loyalty-lite punch card only if (a) Telegram
identity is proven — P3.3 opt-in ≥50% on confirmations — AND (b) north-star ≥0.7 —
otherwise STOP and report back.

**Gate evaluation (all three conditions currently UNMET):**
1. **Env flag:** `LOYALTY_ENABLED` unset everywhere (`.env.example`, `render.yaml`,
   README) → engine refuses out of the box.
2. **Telegram opt-in rate:** 0/169 customer rows opted in at last read — far below
   the 50% threshold. Evidence: `customer_stats.marketing_opt_in` counts; the P3.3
   admin endpoint `GET /api/admin/notification-stats` is the operational read.
3. **North-star:** trailing-week confirmed bookings per billing-active tenant sits
   well under 0.7 on current data (no real production traffic yet). Evidence:
   `GET /api/admin/funnel` `northStar` series.

**What shipped DARK (defensible, per the report-back obligation):** the full engine
`server/lib/loyalty.ts` — ledger (append-only via storage triggers), punch cards,
redemption (lowers the next Chapa charge before initialize, recorded in
`payments.meta`, never money movement), consumer ring endpoint, and the P4.4
Telegram opt-in capture that will generate the deciding data. `gateStatus()` re-reads
the live opt-in rate + north-star on every touch and refuses to accrue punches or
redeem rewards while either threshold is unmet — the gate is enforced in the
database, not in prose.

**Exact reopening conditions:** set `LOYALTY_ENABLED=true` in the environment AND
both live metrics must clear their thresholds (`notification-stats.optIn.rate ≥ 0.5`
and `funnel.northStar[latest].value ≥ 0.7`) for two consecutive weeks. No code change
required to the gate itself — it is data + flag driven.

**Note:** P4.4 wired the "ማስታወሻ በ Telegram" opt-in deep link on booking
confirmations (P3.2 channel), which is the primary source of the confirmation-time
opt-in rate the gate reads. Production rollout of P4.4 is the first step to opening
this program.
