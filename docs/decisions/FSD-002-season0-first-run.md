# FSD-002 — Season 0 first run: the 18 COMPARE-04 tickets through the gates

**Date:** 2026-09-12
**Season at decision:** 0 — ship and activate
**Weights in force:** funnel ×3 · market-fit ×2 · effort ×2 · revenue ×1 · evidence ×2
**Supersedes / superseded by:** —
**Overrides:** none.

**Input:** all 18 draft tickets from
`/media/mikias/27E5BCBF704A2696/Workstation/subware/fresha-clone/_compare/COMPARE-04-BACKLOG-PROPOSAL.md`.
**Funnel axis:** capped at 1 for every candidate — no production traffic exists, so no funnel step
has a *measured* leak (`docs/feature-selection.md` §3). The cap is why the top of this board is
densely packed; read the ties as "indistinguishable under Season 0", not as noise to argue over.

## Board

| Rank | Candidate | F | M | Eff | R | V | Total /24 | Door | Outcome |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `T7.13` Directory price floor + same-day signal | 1 | 3 | 3 (S) | 2 | 3 | **23** | two-way | SHORTLIST |
| 2 | `T7.8` Render the analytics that already exist | 1 | 3 | 3 (S) | 2 | 3 | **23** | two-way | SHORTLIST |
| 3 | `T7.17` Close the dead merchant surfaces | 1 | 3 | 3 (S) | 1 | 3 | **22** | two-way | SHORTLIST |
| 4 | `T7.2` Merchant-set reminder lead time | 1 | 3 | 3 (S) | 1 | 3 | **22** | two-way | SHORTLIST |
| 5 | `T7.4` Lifecycle messages (cancel/reschedule/no-show/thank-you) | 1 | 3 | 3 (S) | 1 | 3 | **22** | two-way | SHORTLIST |
| 6 | `T7.6` Closure / blocked-time write path | 1 | 3 | 3 (S) | 1 | 3 | 22 | two-way | below top 5 — highest-ranked non-shortlisted |
| — | `T7.12` Consent centre + STOP | 1 | 3 | 3 (S) | 1 | 3 | 22 | one-way | **DUTY? — see §Duties** |
| — | `T7.9` Refund honesty | 1 | 3 | 3 (S) | 1 | 3 | 22 | one-way | **DUTY? — see §Duties** |
| — | `T7.5` Tax + offline cash ledger | 1 | 3 | 2 (M) | 3 | 3 | 22 | one-way | WAITING (money, needs design doc) |
| 10 | `T7.1` Welcome offer | 1 | 3 | 2 (M) | 2 | 3 | 21 | two-way | WAITING |
| 10 | `T7.3` Reminder to rebook | 1 | 3 | 2 (M) | 2 | 3 | 21 | two-way | WAITING |
| 10 | `T7.11` Authored client record | 1 | 3 | 2 (M) | 2 | 3 | 21 | one-way | WAITING |
| 10 | `T7.16` Booking-source attribution | 1 | 3 | 3 (S) | 2 | 2 | 21 | two-way | WAITING |
| — | `T7.14` Deals + lying widgets | 1 | 3 | 2 (M) | 2 | 3 | 21 | one-way | **SPLIT** — bug half folded into `T7.17` |
| 15 | `T7.15` Service buffers | 1 | 2 | 2 (M) | 3 | 3 | 20 | one-way | **BLOCKED** on `T6.4` (`EXECUTION_PLAN.md:607`) |
| 16 | `T7.7` Waitlist on reclaimed slots | 1 | 3 | 2 (M) | 2 | 2 | 19 | one-way | WAITING |
| 17 | `T7.10` Tips | 1 | 2 | 2 (M) | 2 | 2 | 17 | one-way | WAITING |
| 17 | `T7.18` Client referral | 1 | 2 | 2 (M) | 2 | 2 | 17 | one-way | WAITING |

**All 18 passed G1–G4.** Nothing in `COMPARE-04` died at a gate — by construction, the matrix
already excluded the twelve `DIVERGENT-BY-DESIGN` records before writing tickets. The gates were
exercised against the wider gap set instead, and these are what they kill:

| Killed | Gate | Citation |
|---|---|---|
| Card-on-file no-show fee capture | G1 Law | `AGENTS.md:27` |
| Client wallets / cashback | G1 Law | `ROADMAP.md:16` "DEAD, permanently" |
| Consumer memberships (recurring capture) | G1 Law | `AGENTS.md:27` |
| Dynamic up-pricing | G1 Law | `ROADMAP.md:22` |
| Loyalty tiers / expiry / referral depth | G1 Law | `AGENTS.md:24-25`, `docs/loyalty-opening.md:48-54` |
| Card terminals, BNPL rails | G2 Rails | `server/lib/chapa.ts:81-136` is the only rail |
| Two-way calendar sync | G3 Infra | `ARCHITECTURE.md:27` (single process) |
| Continuous BI connector | G3 Infra | `ARCHITECTURE.md:27` |
| "Build merchant reporting" | G4 Parity | `src/api/tenant.ts:450-546` already computes it |

## What the board actually says

Rank order is nearly meaningless — seven candidates sit within one point. The signal is in the
*shape*: every top candidate is **S-effort work that makes an existing, cited thing behave**.
Under Season 0's weights, nothing that *adds* a Fresha-parity capability outranks work that makes
Egebeya honest about what it already claims. That is the preset doing its job, not an accident.

---

## BRIEF 1 — `T7.13` Directory price floor + same-day signal · **23/24**

**What it is.** `GET /api/public/discover` returns `id,name,slug,category,city,heroImage,isNew` and
nothing a consumer can decide on. Add `fromPriceEtbCents` and `openToday`, render them on the card,
and put the directory's hardcoded English strings through i18n.

**Evidence.** Fresha: `F-mp-06`/`F-mp-07`, both OBSERVED on listing pages (`bt-city cards; schema
priceRange fields`). Egebeya: `src/api/public.ts:175-192` (payload), `src/api/public.ts:135`
(alphabetical ordering), `src/pages/Discover.tsx:115-131` (hardcoded header, and a "Search" button
that clears the query rather than submitting).
**Rides.** The existing discover query plus `services.price` (`src/db/schema.ts:72`) and the
availability generator (`src/api/public.ts:477-591`). One batched aggregate, the same shape as
`src/api/queue.ts:44-63`.
**Door.** Two-way — a payload field and a card. No schema change.
**Kill conditions.** If `openToday` is wrong under load, it is worse than absent: a "space today"
badge that fails at the booking step burns the one thing a directory has. Requires a cached or
cheap-enough computation inside `discoverLimiter` (60/min, `server/middleware/rateLimiter.ts:89`).
**Case against.** The directory is not the funnel's bottleneck — `/discover` traffic is unmeasured,
and no tenant pays because the card shows a price. It also copies a Fresha assumption (browsing
demand) into a product whose actual acquisition channel is a street agent and a Telegram share.
**If passed.** Returns when `/discover` shows real traffic in `search_intent`
(`src/db/schema.ts:368-374`) with a measurable click→book drop.

## BRIEF 2 — `T7.8` Render the analytics that already exist · **23/24**

**What it is.** `GET /api/tenant/analytics` returns 7-day daily revenue/bookings, top services,
repeat-customer count. The dashboard fetches it into `weeklyRevenue` / `weeklyDaily` and never
reads either variable. Render the card.

**Evidence.** Egebeya: `src/api/tenant.ts:450-546` (endpoint), `src/pages/Dashboard/index.tsx:641-650`
(fetch), `:597-598` (the two states — grep confirms no other reader). Fresha: `F-sa-180`, OBSERVED
on `/for-business`.
**Rides.** Zero new server code. Uses `ValuePricingSheet`'s proven pattern of putting the merchant's
own number above the price (`src/components/dashboard/VelvetRope.tsx:68-142`).
**Door.** Two-way — one component.
**Kill conditions.** If the aggregate is wrong (it counts *completed payments only*, so cash
revenue is invisible — see `T7.5`), the card teaches owners that Egebeya understates them. That is
an argument for shipping it *with* a label, not against shipping it.
**Case against.** It is decoration until there are customers to show it to. On a dev DB it will look
great and prove nothing.
**If passed.** Returns when the first billing-active tenant asks "how am I doing" — a sentence the
agent program should be listening for.

## BRIEF 3 — `T7.17` Close the dead merchant surfaces · **22/24**

**What it is.** Four broken things, all verified: the marketing deck calls a route that does not
exist; four widgets read a localStorage key nothing writes; two CTAs link to a route that 404s; and
`GET /api/tenant/export/csv` has no button anywhere.

**Evidence.** `src/pages/Dashboard/MarketingDeck.tsx:30` → `GET /api/tenant/ai/weekly-posts`, which
appears nowhere in `src/api/` (the file's route list is `/ai/consent`, `/site/ai-chat`,
`/ai/generate-description`, `/ai/marketing-snippet`). `localStorage.getItem('tenantName')` at
`src/pages/Dashboard/MarketingDeck.tsx:12`, `src/pages/Dashboard/CustomerHealth.tsx:115`, `src/components/dashboard/MarketPulseWidget.tsx:122`,
`src/components/dashboard/WinBackWidget.tsx:54` — the key is only ever `setItem` in tests. `src/components/dashboard/EmpireChecklist.tsx:70` and
`src/components/FirstShareHero.tsx:195` point at `/settings`, which is the tenant-slug route (`src/App.tsx:140`),
so they land on NotFound (`:147`). `src/api/tenant.ts:2122` has no client importer.
Also absorbs `T7.14`'s bug half: `src/components/dashboard/WinBackWidget.tsx:56-62` shares a hardcoded `WIN10` and
`src/components/dashboard/MarketPulseWidget.tsx:126-130` offers "15% off" — neither mints a code, so both fail at booking,
while `src/pages/Dashboard/CustomerHealth.tsx:128-142` does it correctly through the API.
**Rides.** `shareLinkFor`/session payload for the tenant name; existing promo mint endpoint for the
two lying widgets; existing AI path (`server/lib/ai.ts:118-175`) + `ai_usage` budget
(`src/db/schema.ts:557-565`) if the weekly-posts route is built rather than deleted.
**Door.** Two-way. Each half is one commit and one is a delete.
**Kill conditions.** If the honest fix is deletion (drop the deck, drop the beacon), building
`/weekly-posts` is scope creep — decide per half, not as a bundle.
**Case against.** It is janitorial. It will not move a funnel step or convert a tenant, and it is
exactly the kind of satisfying cleanup that substitutes for growth work. Counter: a demo where the
owner taps "AI post" and gets a canned English sentence is a lost close in Bole.
**If passed.** Returns never — this is a bug list, and it stays open until empty.

## BRIEF 4 — `T7.2` Merchant-set reminder lead time · **22/24**

**What it is.** One setting so a clinic can remind 24 hours out and a barber 60 minutes out.
Today the window is hardcoded.

**Evidence.** `server/cron/sendReminders.ts:51-52` (`now+2h` … `now+2.5h`, scanned every 15 min per
`server.ts:243`). Fresha `F-sa-150`: "Merchant enables and customizes timing", OBSERVED in the
help-center automation catalog. Egebeya's settings-blob pattern already exists
(`src/api/tenant.ts:1185-1204`, used by quiet-hours at `:1093-1124`).
**Rides.** The adapter, the cron, the `reminderSent`/`sentVia` audit columns
(`src/db/schema.ts:128-129`), and the Settings notification card
(`src/pages/Dashboard/Settings.tsx:390-412`).
**Door.** Two-way — additive settings JSON, default 120 keeps every existing tenant's behaviour
byte-identical.
**Kill conditions.** If the 15-minute scan grid makes coarse lead times unreliable (a 24 h reminder
fires whenever the window next aligns), the feature is quietly broken; verify the grid before
promising a lead time.
**Case against.** Nobody has asked. Reminders already fire, and no no-show data exists to show the
current 2-hour window is wrong. Under Season 0's funnel cap this ranks on effort, not on evidence
of need.
**If passed.** Returns with a tenant request, or with no-show data that separates appointment types.

## BRIEF 5 — `T7.4` Lifecycle messages (cancel / reschedule / no-show / thank-you) · **22/24**

**What it is.** Four templates that do not exist. A consumer who reschedules leaves the owner
uninformed; a merchant marking no-show sends nothing; a completed visit says nothing back.

**Evidence.** `server/lib/mailTemplates.ts:9-44` — exactly four templates
(`bookingCustomer, bookingOwner, reminder, passwordReset`). Reschedule path
(`src/api/public.ts:1293-1369`) and cancel path (`:1267-1291`) return JSON notes, not messages.
Fresha documents all of these as separate automated types (`F-sa-152/153/154/155`), OBSERVED in the
automation catalog.
**Rides.** `notify()` (`server/lib/notifications.ts:186-215`), `notification_log`
(`src/db/schema.ts:438-450`), and the dual-calendar formatting used on the receipt
(`server/lib/timezone.ts:83-119`).
**Door.** Two-way — templates and call sites; channels never throw (`AGENTS.md:22`).
**Kill conditions.** The thank-you message is the softest of the four; if it reads as noise on a
telebirr-market SMS it damages the channel that carries the reminders that matter. Ship the three
transactional ones first.
**Case against.** Off-funnel: they do not create bookings, they inform people about bookings that
already happened. In a season where funnel leverage is weighted ×3 and then capped, a four-message
ticket may be ranking on evidence and effort rather than on any real strategic pull.
**If passed.** Returns when `/api/admin/notification-stats` proves the channel is actually
delivered to real customers — which needs production, not code.

---

## Duties (not ranked — flagged for the owner)

The scoring treats these as candidates. That is arguably wrong, and FSD-001 records the proposed
rule for the owner to accept or reject:

- **`T7.12`** consumer consent withdrawal. `consent_given_at` is NOT NULL on every consumer row
  (`src/db/schema.ts:459`) and capture happens in three places, but withdrawal exists only on the
  *merchant's* CRM screen (`src/api/crm.ts:246-291`). PDPL 1321/2024 duties are named in
  `ROADMAP.md:98`. The blast path already appends "Reply STOP" (`src/api/crm.ts:206`) and nothing
  reads the reply.
- **`T7.9`** the landing page says **"Refunded automatically if the business cancels."**
  (`src/pages/Landing.tsx:1029` → `src/locales/en.json:63`); the code says the opposite
  (`src/api/public.ts:1283-1285`, `server/cron/sendReminders.ts:154-184`). A false money promise on
  a marketing page is a defect at launch, not a feature to be deprioritised.

## Picked

**Awaiting the owner.** The agent's job ended at the briefs. One pick, two at most.

## Passed over

*To be written the moment the pick is made — including the five not chosen above and every DUTY
decision, each with its re-entry condition.*

## Measurement commitment

**Question:** whatever is picked, does it change what a *real* merchant can do or believe — measured
as first-confirmed-booking per activated tenant (`server/lib/analytics.ts:199-235`)?
**Instrument:** `GET /api/admin/funnel` north-star series plus the activation events the ticket
touches. Honest caveat, recorded up front: with no production traffic, the likely verdict is
`UNMEASURABLE`, and that is the correct output of Season 0, not a failure of the ticket.
**Answer by:** 2–4 weeks after ship, or after the first ten real tenants — whichever is later.
**Verdict:** —
