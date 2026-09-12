# Position — Subagent D · SUPPORT / CRM (merchant pain, frequency, workarounds)

**Date:** 2026-09-12 · **Season:** 0 · **Surface declared (Rule 1):** primarily *merchant SaaS* +
*consumer marketplace*; corporate/platform only where noted.

## Method and the frequency problem (Rule 3 — sacred)

Production is barely live (FSD-001 §3: unverified payments, Telegram bot + SMTP unprovisioned).
**No file in this repo records a single tenant count, a support-ticket tally, or a merchant
quote.** Therefore, in every entry below, `frequency` is one of exactly three honest labels:

- **OBSERVED-workaround** — the pain is proven by a code path that *forces* the workaround
  (file:line in the live tree). The merchant isn't named; the forced behavior is.
- **DECISION-recorded** — a kill gate, shortlist, or CEO directive in LEDGER.md / FSD-002 /
  FSD-003 / Gap.md itself anticipates or forbids the ask (e.g. T7.7 "returns with a tenant
  request" — LEDGER.md:28).
- **UNDOCUMENTED** — no Egebeya evidence; where Fresha's testimonial pattern ("phone-time
  reduction," displacement language — _knowledge/07-TRUST-MECHANICS2.md:53-62,
  06-BRAND-SYSTEM2.md:48-50) is used, it is explicitly a **KB-PATTERN SUBSTITUTE, not Egebeya
  evidence.**

Zero of 68 features carry a documented merchant count or quote. All "how many tenants asked"
answers in this paper are structural, never numeric. Street-agent sentences are proposals for
the one-breath close, phrased only from what the tree already does or verifiably will do — a
sentence the product can't honor is itself a defect (the T7.9 refund-promise lesson,
FSD-002:190-193).

Pain register used: `_council/repo-map.json` dead surfaces (tenant_closures write-orphan;
export/csv buttonless; weekly-posts dead call; localStorage-keyed widgets; `/settings` 404 CTAs).
**One correction to my brief:** "Automations hydration" is *no longer* a dead surface —
repo-map disagreements record that `src/pages/Dashboard/Automations.tsx:76-95` now fetches
`/api/tenant/settings` on mount (tree wins over REPO_MAP:291). It comes off the pain register.

---

## 1. Positions on all 68 in-scope features

### discovery-search (7) — the marketplace surface consumers see *today*

**E-ds-01 Category browsing — LOW** (consumer-side MED only when directory traffic exists)
Workaround the merchant lives with: consumers don't browse categories; the owner's real channel
is a Telegram share of one link (ROADMAP §1 growth: street agent + Telegram share; FSD-002:82
"the directory is not the funnel's bottleneck"). Four fixed categories cover Addis reality
(hair/barber/nails/spa); the 15-spine is Fresha-SEO-shaped theater *until search_intent rows
prove vertical demand* (LEDGER: T7.13 re-entry names search_intent as the instrument).
frequency: UNDOCUMENTED (no production search_intent traffic; FSD-002:83-84).
Agent sentence: "Your page shows up when someone in your neighborhood searches for a barber."
(Amharic flavor — honest, from shipped am.json vocabulary: "ቀጠሮ ያስይዙ" / book online — Discover.tsx
header itself is still hardcoded English, so today the sentence outruns the page. Say it only
after E-l10n-01 closes.)
Notice day 1: **n** — merchants notice the card, not the taxonomy.

**E-ds-02 Treatment-level search — LOW**
"Acrylic nails" can't be found because search hits tenant names only
(src/api/public.ts:113-117). Workaround: the consumer asks on Telegram and the answer is a
screenshot — this is exactly the phone-time the displacement pattern says software kills
(KB-PATTERN SUBSTITUTE, not Egebeya evidence). No treatment entity in schema
(COMPARE-01:25).
frequency: UNDOCUMENTED.
Agent sentence: none yet — an agent who promises "clients find you by service" today is
promising a GAP (the Discover placeholder already lies: "Search for a business or service…"
Discover.tsx:122 — fix the copy or build the feature).
Notice day 1: **n**.

**E-ds-03 Neighbourhood scoping — MED**
Addis consumers think Bole / Piassa / Kazanchis; city is a free-text LIKE on settings JSON
(src/api/public.ts:106-111), so "Addis Ababa" vs "አዲስ አበባ" vs "Addis" silently split the
directory. Workaround: merchants write the city field exactly as agents dictate. Sub-city text
zones are already the parked redesign (LEDGER.md:65, EXECUTION_PLAN.md:442) — that is the right
shape, cheaper than coordinates.
frequency: OBSERVED-workaround (free-text column + LIKE query; no district level).
Agent sentence: "People on your street find you first." ("በአዲስ አበባ" exists in shipped copy —
booking.addis.)
Notice day 1: **n** for merchants; **y** for the out-of-town caller.

**E-ds-04 Map view — none-in-addis-today**
No coordinates collected anywhere; parked at G2 with a redesign path (LEDGER.md:65). Taxi-and-
landmark culture means "come from Bole Medhanialem, second gate" beats a pin. Building a map
before an address model is parity theater.
frequency: DECISION-recorded (G2 dead-until-redesigned).
Agent sentence: never sell the map; sell the *per-site map block* that already ships
(Gap.md:19).
Notice day 1: **n**.

**E-ds-05 Aggregate rating display — MED**
The NEW badge stands in for trust (public.ts:178-186; Discover.tsx:245-252 also prints "No
bookings yet" — a *negative* signal shipped honestly; I defend the honesty but not the placement).
In a one-reputation market (ROADMAP: "broken bookings poison a one-reputation market"), trust
travels by Telegram word-of-mouth; a rating with n=3 reviews is worse than NEW. No reviews
table exists at all (Gap.md:23).
frequency: UNDOCUMENTED.
Agent sentence: none until E-mg-05 exists; "NEW" is closer to the truth than a fake star.
Notice day 1: **y** — consumers already misread absence (see §4).

**E-ds-06 Price-visible menus pre-booking — HIGH** (consumer side)
Prices exist on the tenant page and booking flow (public.ts:428-440; PublicBooking.tsx:516-548)
but not on the card. Workaround: the caller phones to ask the price — the single most common
non-booking call a salon owner takes (KB-PATTERN SUBSTITUTE for "phone-time reduction"; the
Egebeya-observed half is the card payload itself: public.ts:175-192). T7.13 (price floor +
same-day) is the joint ticket at 23/24 (FSD-002:19).
frequency: OBSERVED-workaround (payload lacks price; callers must ask) — highest-scoring
shortlist row, i.e. the org's own recorded judgment.
Agent sentence: "Every price on your menu, public, before a single phone call."
(Am: "ዋጋ" ships on the booking page today — booking.tariff.)
Notice day 1: **y** — this changes what /discover prints.

**E-ds-07 Same-day availability surfacing — HIGH** (consumer side)
Availability is computed per day (public.ts:477-591) and never surfaces in the directory.
Workaround today: the consumer books tomorrow because they cannot see today; the walk-in who
"gets seen today" uses the queue board instead (QueueStatus.tsx — shipped, EGE-ADVANTAGE).
The kill condition is honest and binding: a wrong "space today" badge at booking time burns
the directory's one asset (FSD-002:77-79) — ship it cached or not at all.
frequency: OBSERVED-workaround (computed-but-never-surfaced).
Agent sentence: "A customer with free time tonight finds you tonight."
Notice day 1: **y**.

### booking-core (8)

**E-bc-03 Waitlist — LOW**
The nearest mechanism is the take-a-number queue + expired-slot reclaim
(Gap.md:39; server/lib/queue.ts:127-217). LEDGER is blunt: "demand unobserved locally; returns
with a tenant request" (LEDGER.md:28). In Addis the waitlist *is* the physical line, which the
queue already serves better than Fresha does (COMPARE-02 §B.5).
frequency: DECISION-recorded (explicitly awaiting a tenant request — none has arrived).
Agent sentence: don't — sell the live queue board, which already works.
Notice day 1: **n**.

**E-bc-04 Group bookings — LOW-MED**
One customer × N services exists (public.ts:755-779); no multi-attendee. Workaround: the
wedding party books four back-to-back slots by phone, or one person books four times. Real in
Ethiopian wedding/burial culture but **zero recorded asks** — keep honest.
frequency: UNDOCUMENTED.
Agent sentence: "One person, four chairs — coming soon" only if you must; better: say nothing.
Notice day 1: **n** (phone absorbs it).

**E-bc-06 Service sequencing — LOW**
Services sum into one contiguous block (Gap.md:47). Consult-then-treat ordering matters to
med-spas; the single-chair shop does it by hand and would never configure a resource model.
frequency: UNDOCUMENTED.
Agent sentence: none.
Notice day 1: **n**.

**E-bc-07 Statuses & notes — MED**
Status lifecycle ships (bookings.ts:89-92); **no notes column** (Gap.md:51; schema has none —
repo-map appointments column list confirms). Workaround: the owner memorizes or writes on their
hand that Selam wants the senior braider; the info dies with the shift. T7.11 (authored client
record: notes/reason/files) carries this — 21/24, one-way, WAITING (LEDGER.md:24).
frequency: OBSERVED-workaround (no column; memory is the store).
Agent sentence: "The notes live in the booking, not in your head."
Notice day 1: **n** (owners overestimate memory until they lose a regular).

**E-bc-08 Reschedule — MED (HIGH for the *drag* half's absence)**
Client self-serve ships and works (public.ts:1293-1369). Merchant surface: day-filtered list,
zero drag, zero calendar grid (Bookings.tsx:36-71 — a `select` dropdown per row, line 218-229;
Gap.md:55). Workaround: merchant calls/texts the client to self-reschedule, or cancels and
re-books. On a 6" Android the day-list is *usable* — this is why I won't call it HIGH.
frequency: OBSERVED-workaround (list-only surface proven in code).
Agent sentence: "Your client moves their own appointment; you approve it with one tap."
(approve-with-one-tap is the *build*, not today — don't ship that sentence pre-T7.)
Notice day 1: **n** (list works; drag is polish).

**E-bc-09 Cancellation reason capture — LOW-MED**
Cancel ships (public.ts:1267-1291); nothing records *why* (Gap.md:59). Workaround: the owner
asks in the phone call and remembers. The recorded re-entry: reason feeds policy only after
data exists; no money attached (ground-rules register: "reason→policy, no money").
frequency: UNDOCUMENTED.
Agent sentence: none in one breath; skip.
Notice day 1: **n**.

**E-bc-10 Staff assignment rules — none-in-addis-today**
Consumer picks staff explicitly (public.ts:441-465) — which in a 2-chair shop *is* the
distribution rule. Round-robin assumes a staff pool the founding cohort (single-chair, ROADMAP
target) doesn't have.
frequency: UNDOCUMENTED.
Agent sentence: none.
Notice day 1: **n**.

**E-bc-11 Online availability controls — MED**
`active` on service/staff exists; "sellable online," min-notice, and max-horizon don't
(Gap.md:68). Workaround: an owner who doesn't want 9pm walk-away online bookings sets the
service inactive for *everyone* — losing in-shop demand to protect the calendar. This is the
forced-blunt-instrument class of pain.
frequency: OBSERVED-workaround (only blunt flag exists; schema.ts:74 `active`).
Agent sentence: "Choose what sells online — without closing the door."
Notice day 1: **y** the first time a busy Saturday owner wishes a slot weren't bookable.

### payments-money (11) — every row answers: move / record / promise money?

**E-pm-05 Per-appointment payment-policy override — LOW**
Tenant + per-phone policy exist (public.ts:807-814; crm.ts:293-337 forces prepay on a flagged
phone). Workaround for "pay this regular a courtesy": flip the phone flag or take it off-book.
frequency: UNDOCUMENTED.
Agent sentence: none — global prepay is already the pitch.
Notice day 1: **n**. **Money: no** (policy shape only).

**E-pm-06 Card terminals — none-in-addis-today**
No card-present rail; Chapa/mobile-money is the only rail (Gap.md:81; LEDGER.md:62 G2).
frequency: DECISION-recorded (G2 — dead, rails, not backlog).
Agent sentence: none; an agent demoing card terminals in Bole is a liability.
Notice day 1: **n**. **Money: records nothing.**

**E-pm-07 Pay Now links / QR / self-checkout — MED-HIGH (watch the near-term)**
Money moves *only inside a booking or subscription* (Gap.md:85). Workaround that is eating
recorded reality today: retail sales (oil, braids kit, after-care) settle on personal
telebirr numbers or cash and vanish from the ledger; the share-link exists for *booking*
(site-generator.ts:195) not payment. The parked G4 residual names exactly this: "QR codes and
any merchant surface to retrieve the snippet" (FSD-003:97).
frequency: OBSERVED-workaround (v1 never charges — COMPARE-01:274; no payment-link surface).
Agent sentence: "Sell the shampoo with the same link that sells the chair."
Notice day 1: **n** (retail is a Gate-3 habit; the *pain* is invisible-until-reconciled).
**Money: MOVES — CEO territory per LAW 5; only the link-generation half is product.**

**E-pm-08 Tips — LOW**
Zero tipping surface (Gap.md:89; word absent from client and amount calc). Workaround: cash
handed to the stylist at the chair — invisible to the platform, and per LEDGER, T7.10 is
blocked on the staff-attribution decision *before* any money code (LEDGER.md:29).
frequency: UNDOCUMENTED.
Agent sentence: none yet.
Notice day 1: **n**. **Money: would move — hard stop until attribution ruling.**

**E-pm-09 Gift cards — LOW-MED (cultural hook, but stored value = the dead wallet's cousin)**
Promo codes exist; no stored value (Gap.md:93). Gift-giving for Epiphany/weddings is real, but
client wallets are DEAD permanently (ROADMAP §0; AGENTS.md:27 never-do) and a gift card is a
liability that walks like a wallet. If built, it must be merchant-funded discount-at-charge
shape, never balance.
frequency: UNDOCUMENTED.
Agent sentence: "Sell a gift of a haircut next month, today" — only after legal shape exists.
Notice day 1: **n**. **Money: records promised value — flag to CEO.**

**E-pm-11 Packages / bundles — LOW-MED**
No packages table; multi-service is a single sale (Gap.md:97). Workaround: the owner counts
"5-visit gel package, pay once" on paper or in the punch-card loyalty shape that already gates.
frequency: UNDOCUMENTED.
Agent sentence: "Sell five visits now, schedule them later."
Notice day 1: **n**. **Money: moves at sale, records a liability — CAUTION.**

**E-pm-15 Refunds — HIGH, and it is a DUTY, not a feature (T7.9)**
The landing page promises "Refunded automatically if the business cancels."
(src/locales/en.json:63 → Landing.tsx:1030) while the cancel endpoint answers "A refund must be
issued manually by the business." (public.ts:1283-1285). FSD-002:190-193 rules this a defect at
launch, not a deprioritizable feature; LEDGER.md:20 marks it DUTY?. Every refund an agent's
merchant *cannot* execute through the product is a Telegram DM to the founder — the support
queue I own.
frequency: OBSERVED-workaround (documented false promise; manual path named in code).
Agent sentence: never say "automatic refund" until T7.9 ships — this sentence is a trap.
Notice day 1: **y** — the first business-cancelled booking teaches everyone the gap.
**Money: PROMISES today, would MOVE on fix — CEO final call.**

**E-pm-16 Void/raise/edit sale; receipts — MED**
Invoices cover only platform subscription charges; consumer receipts are tickets, not a sale
ledger (Gap.md:107). Workaround: wrong entry = cancel + rebook, or a whispered cash correction.
frequency: OBSERVED-workaround (no sale-level edit surface in tree).
Agent sentence: none.
Notice day 1: **n** (matters at first reconciliation). **Money: RECORDS.**

**E-pm-17 Taxes / service charges / surcharges — HIGH for truth, not for features**
Charged amount = price − discounts, floored at zero; no additive line (Gap.md:111;
public.ts:877 effectiveAmount). Addis menus are *inclusive*; the pain isn't compliance math —
it's that the platform literally cannot print the number the shop already charges. T7.5 pairs
this with the cash ledger at 22/24, WAITING on a money design doc (LEDGER.md:21).
frequency: OBSERVED-workaround (inclusive pricing kept outside the app).
Agent sentence: "The price you charge is the price Egebeya shows — birr-inclusive, no surprises."
Notice day 1: **n** (prices already read correctly *because* nothing is added).
**Money: RECORDS — design doc first; do not let it become a promise machine.**

**E-pm-18 Manual/offline payment recording — HIGH. This is the #1 silent merchant pain in the tree.**
The payments table anticipates offline methods (schema.ts:180-181) yet **every row is created
by Chapa flows** (Gap.md:115; egebeya-features.json E-pm-18: "trigger: None — no manual entry
surface"). Cash and hand-tapped telebirr — most of what an Addis shop actually collects — make
revenue *invisible*. Consequence chain, all documented: analytics counts completed payments
only, so T7.8's card will understate cash owners "and teach owners that Egebeya understates
them" (FSD-002:98-100); G1's gate counts bookings, and cash bookings confirm without a payment
row. Workaround today: paper notebook beside the app — the merchant runs two books.
frequency: OBSERVED-workaround (code-proven; no UI exists to record a sale).
Agent sentence: "Cash in your hand, counted in your day — one tap at the chair."
Notice day 1: **y** — any owner who compares Sunday cash to Monday numbers.
**Money: RECORDS only (a marker, not a movement) — the cheapest revenue-truth feature on the
file. T7.5 carries it; from my seat it outranks its WAITING status on day-1 salience.**

**E-pm-19 Merchant credit — none-in-addis-today**
Deferred pending data + licensing (Gap.md:119; ROADMAP §0).
frequency: DECISION-recorded.
Agent sentence: none.
Notice day 1: **n**. **Money: none.**

### consumer-account (2)

**E-ca-01 Client account & marketplace profile — LOW (deliberately)**
Phone-keyed identity + consumer JWT exist; no wallet/profile editor (Gap.md:134). The
*correct* local shape already ships: account-free self-service via opaqueId (COMPARE-01:83 —
E-ca-03 SAME "achieved without an account"). A marketplace profile assumes browsing demand
the directory doesn't have yet.
frequency: UNDOCUMENTED.
Agent sentence (consumer-facing, for the owner to repeat): "You don't need an account — your
phone number is your ticket." ("ቁጥር ይውሰዱ" — take a number — ships on the booking page.)
Notice day 1: **n**.

**E-ca-02 Notification & marketing preferences — HIGH as a DUTY (T7.12), LOW as a feature**
Consent captured in three places, but only the merchant can toggle (Gap.md:138); the blast path
appends "Reply STOP to opt out." (crm.ts:206) and **nothing reads the reply** (FSD-002:189).
Every un-honored STOP is a PDPL 1321/2024 exposure and a support ticket to the founder.
LEDGER marks DUTY? — arguably not rankable (LEDGER.md:19).
frequency: OBSERVED-workaround (suffix lies until a handler exists).
Agent sentence: none — but the *product* sentence is "reply STOP and we actually stop."
Notice day 1: **y** for the spammed consumer, which is the merchant's reputation.

### client-management (7)

**E-cm-01 Client profiles & history — MED**
Derived-only from transactions (Gap.md:147); no notes/preferences/forms. Workaround: the
owner's contact-book and memory — which is why "regulars" are a one-person failure mode when a
stylist leaves with them in their head (feeds E-tp-05 too). T7.11 is the ticket (21/24).
frequency: OBSERVED-workaround (transaction-derived only; egebeya-features E-cm-01).
Agent sentence: "Your regulars belong to the shop, not to a phone's memory."
Notice day 1: **n** (they trust their memory — until they don't).

**E-cm-02 Allergy & patch-test — LOW**
No clinical field (Gap.md:151). In Addis today the client *tells you* at the chair; the
record-what-you-heard instinct is strong in this market.
frequency: UNDOCUMENTED.
Notice day 1: **n**.

**E-cm-03 Custom intake forms — LOW**
Fixed zod capture: name, phone, optional email (Gap.md:155; PublicBooking.tsx:15-23).
Workaround: intake happens in Telegram chat post-booking — the product outsources the form to
the messaging app, which is honest but invisible to analytics.
frequency: OBSERVED-workaround (fixed schema, code-proven).
Notice day 1: **n**.

**E-cm-04 Tags & segments — MED**
Computed health tags + inactive_days only (Gap.md:159). Workaround: the owner segments by eye
("the ones from church group"). Computed segments already power winback — free-form tags are
the CRM ask that *would* land with multi-chair shops; founding cohort too small to feel it.
frequency: OBSERVED-workaround (computed-only).
Agent sentence: "Message the ten clients who always fill Tuesdays — not all two hundred."
Notice day 1: **n**.

**E-cm-05 Import / export / merge / delete — MED, and it's the *switching* pain (the one the KB pattern actually maps to)**
Export is a buttonless endpoint (Gap.md:163; repo-map dead surface: `GET /api/tenant/export/csv`
zero UI callers, tenant.ts:2122). No import, merge, or per-client delete. The displacement
pattern says switchers' first sentence is about bringing the book ("Switch software without
losing the book" — the record's own JTBD; KB: owners name the tool they left,
07-TRUST-MECHANICS2.md:59-62 — PATTERN substitute; no Egebeya switcher quote exists). Workaround:
re-type clients by phone over two weeks or keep the paper book parallel.
frequency: OBSERVED-workaround (dead export UI, code-proven; no import at all).
Agent sentence: "Bring your clients' numbers in; Egebeya turns them into a book." (import =
the build — today only Egebeya's *own* clients can be exported, by hand.)
Notice day 1: **n** day-one merchants; **y** at every competitor displacement.

**E-cm-06 Files on client profiles — LOW**
Media is tenant-scoped; nothing attaches to a customer (Gap.md:167). Reference photos travel on
Telegram — which is honestly *better* for now.
frequency: UNDOCUMENTED.
Notice day 1: **n**.

**E-cm-07 Block clients from booking — MED**
The block vector runs consumer→merchant only (Gap.md:171; trust.ts:110-152). The abusive/no-show
client workaround: force-prepay on the phone (crm.ts:293-337) — the shipped deterrent — but an
owner who wants *never again* has no lever; they "lose" the slot anyway.
frequency: OBSERVED-workaround (prepay flag is the only lever; block absent).
Agent sentence: none in one breath.
Notice day 1: **n** (prepay flag covers the common case).

### merchant-scheduling (5)

**E-ms-01 Smart calendar — MED, with a heresy: don't ship a grid first**
Merchant day view is a filtered list + queue card stack (Gap.md:180; Bookings.tsx:184-235). The
council already ruled the *shape* of the merchant day: "Merchant Home IS the queue… a barber
clears his morning queue with one tap per customer" (ROADMAP §1 M2 acceptance). A color-coded
drag calendar is Fresha-parity for 8-chair London salons. What merchants will notice instead:
week-strip of queue-ready days on Home. Build the grid only when staff rosters (E-ms-02) demand
one.
frequency: OBSERVED-workaround (list + stack is the current truth; code-proven).
Agent sentence: "Your whole day is a line you clear with your thumb." — sell the queue, not
the calendar.
Notice day 1: **y** — because the workaround *is* the product today.

**E-ms-02 Shift scheduling / rosters — LOW (but it's E-ai-03's front door — see below)**
Owner edits per-weekday windows; nothing publishes to staff (Gap.md:184). Workaround: a
Telegram message "ቅዳሜ 8-5" — this is *the* current workaround and it works, badly (no record,
no confirmation).
frequency: UNDOCUMENTED.
Agent sentence: "Your staff stop calling you to ask if they're on." 
Notice day 1: **n** alone; **y** paired with the shared-calendar re-scope of E-ai-03.

**E-ms-03 Blocked time & closures — HIGH. My #1 dead surface by merchant cost.**
The closure table is enforced on every public availability read (public.ts:508-522, 651-662)
but **no endpoint or UI can create a row** (Gap.md:188; repo-map: "write-orphaned,"
schema.ts:110-115, writers are seed/tests only). Consequence, documented in-tree: a Meskel
closure or an afternoon at a funeral is *unmarkable* — the shop either stays bookable while
shut, or closes *every* Wednesday to cover one. Workaround: the owner answers their own
booking page's bookings by phone to cancel — the highest-awkwardness call in commerce.
T7.6 (write path) scored 22/24, "needs only a new cycle" (LEDGER.md:18).
frequency: OBSERVED-workaround — the strongest code-proven pain in the entire Gap file.
Agent sentence: "Closed for the holiday? One tap, and the calendar obeys."
Notice day 1: **y** — first public holiday after onboarding decides whether the product is
trusted. (Amharic flavor keeps honest here: holiday names, not a UI sentence, are what owners
say — "በመስከረም ዝግ የለም" is not copy I'd put in an agent's mouth; say it in English, the shop
says it in Amharic on its own door.)

**E-ms-04 Time-off types — LOW**
No time-off table (Gap.md:189). Sick day = owner deletes a booking. Request/approval flows
assume HR, not family-run shops.
frequency: UNDOCUMENTED.
Notice day 1: **n**.

**E-ms-05 Processing / extra time — LOW-MED (T7.15, blocked on T6.4)**
One duration per service, fixed 30-min grid (Gap.md:197). The local truth: a client *does*
arrive late and leave late, but chair time in a walk-in-dominant shop is already fluid — the
queue's ETA engine tolerates slip by design (queue.ts:100-114, degrades to category default).
Buffers matter for prepay-booked med-spa sequences, not for a barber's day.
frequency: UNDOCUMENTED.
Notice day 1: **n**.

### multi-location (3)

**E-ml-01 Multiple locations — none-in-addis-today.** One tenant = one slug = one door
(Gap.md:206). The founding cohort is single-chair by design (ROADMAP §0: "one vertical with
paying density"). frequency: UNDOCUMENTED. Notice day 1: **n**.
**E-ml-02 Independent merchants / workspace — LOW-theater.** Chair-rental exists in Addis, but
Egebeya's staff model can't attribute sales to a renter (Gap.md:210); building it means
inventing settlement semantics against the no-custody law (COMPARE-01:68). frequency:
UNDOCUMENTED. Notice day 1: **n**.
**E-ml-03 Operator visibility — none-in-addis-today.** The admin console serves Egebeya, not a
10-shop operator (Gap.md:214). An Addis "operator of many shops" is not the buyer. frequency:
UNDOCUMENTED. Notice day 1: **n**.

### trust-safety (2)

**E-ts-02 Report / reply to reviews — none-in-addis-today.** No reviews table exists; nothing
to report on (Gap.md:221). Egebeya's shipped trust surface is consumer→platform reporting of
*merchants* with evidence held off tenant storage (trust.ts:43-84; COMPARE-01:219) — keep that,
don't clone the review-moderation product before reviews exist. frequency: structurally N/A.
Notice day 1: **n**.

**E-ts-03 No-show protection as policy — MED (already half-shipped, protected by law).**
Behavioural half runs today: no-show counter + health tag + per-phone forced prepay
(Gap.md:226; crm.ts:293-337). Monetary fee capture is prohibited (AGENTS.md:27 — never-do). My
seat's note: owners *feel* the deterrent on day 2 ("he knows next time he pays first") — the
half-built engine is a sales sentence, not a build item. frequency: OBSERVED-workaround-shipped.
Agent sentence: "A no-show loses the right to book free — automatically."
Notice day 1: **y** (it already fires).

### marketing-growth (5)

**E-mg-01 Blast campaigns — MED.** One-shot SMS blast with STOP suffix + Pro gate exists
(Gap.md:235; crm.ts:182-244). Workaround: Telegram broadcast lists — free, Amharic-capable,
already installed on every owner's phone. Egebeya's unmetered messaging beats Fresha's per-send
pricing (COMPARE-02 §A.2) *in the pitch*; but until STOP is honored (E-ca-02 duty), blasts
convert trust into complaints — and complaints land on the founder's Telegram, which is my
queue. Bulk beyond ~10k is honestly parked (LEDGER.md:50).
frequency: OBSERVED-workaround (Telegram broadcast is the incumbent; code confirms no email/
builder/schedule).
Agent sentence: "Fill a dead Tuesday with one message to every regular — free, no per-text
charge." Notice day 1: **y** (blast ships today; the *missing* half is the opt-out, which
matters more).

**E-mg-02 Deals & promotions — MED, plus a lie to kill.** Promo codes + quiet-hours ship
(Gap.md:239); flash-sale engine absent. The day-1 defect: WinBackWidget shares hardcoded `WIN10`
and MarketPulseWidget offers "15% off" — **neither mints a code; both fail at booking**
(FSD-002:119-121; T7.14's bug-half promoted into T7.17). A merchant who sends a dead code to 40
clients learns twice: the product lied, and their name is on it. Fix first; engine later.
frequency: OBSERVED-workaround (lying widgets — code-proven, repo-map dead-surface adjacent).
Agent sentence: "Sell the slow hours — mornings at 20% off — without printing a single flyer."
Notice day 1: **y** (via the bug).

**E-mg-05 Review engine — LOW-MED.** No review entity, no post-visit prompt (Gap.md:243).
Sequencing from my seat: reviews need E-an-04's thank-you message as their delivery truck —
build the message catalog first (Rule 13: the automation set is one system). Workaround today:
the owner screenshots compliments into a marketing deck — which, note, reads from a
localStorage key production never sets (repo-map: MarketingDeck.tsx:12-24) — a dead surface
on top of a missing feature.
frequency: UNDOCUMENTED.
Notice day 1: **n**.

**E-mg-06 Referral program — LOW.** Supply-side agent attribution exists; consumer-to-consumer
absent (Gap.md:247; T7.18 WAITING behind the loyalty gate, LEDGER.md:30). Word-of-mouth already
runs on Telegram at zero product cost; referrer *rewards* touch the loyalty gate — do not
fabricate a gate metric here (AGENTS.md never-do).
frequency: DECISION-recorded (gate-ordered).
Notice day 1: **n**.

**E-mg-07 Marketplace visibility boosting — none-in-addis-today.** Directory is alphabetical
(public.ts:135) and, per FSD-002:81, /discover traffic is *unmeasured* — selling rank on a
directory nobody browses taxes the trust the founder is building. Market Pulse (owner-side
demand alerts, E-an-08) is the honest version of "visibility," and it ships.
frequency: UNDOCUMENTED.
Notice day 1: **n**.

### automation-notifications (4) — Rule 13: this is one catalog, argued as a set

**E-an-01 Appointment reminder lead time — HIGH. The cheapest trust win on this board.**
Reminders fire in a hardcoded now+2h…2.5h window, cron every 15 min (Gap.md:259;
sendReminders.ts:51-52). Workaround: the 2h SMS for a 9am appointment arrives at 7am and the
one for a late booking arrives during the client's commute — nobody adjusts, everybody absorbs.
T7.2 at 22/24: one settings-blob number, default 120 keeps behavior byte-identical
(FSD-002:133-153). The honest counter is in-file and I keep it: the *ask* is UNDOCUMENTED
("Nobody has asked" — FSD-002:150); only the *workaround* (fixed 2h window) is OBSERVED in code.
Agent sentence: "You decide when the reminder rings — an hour or a day before."
Notice day 1: **y** — the first missed reminder gets blamed on the app, not the window.

**E-an-03 Rescheduled / cancelled notices — HIGH.**
Transitions exist; **no dedicated message ships to either side** (Gap.md:265;
mailTemplates.ts has exactly four templates; FSD-002:157-162). The concrete merchant harm: a
consumer reschedules via link and *the owner is uninformed* (FSD-002:157) — an empty chair that
looked full all morning. One `notify()` per event through the existing adapter — no infra
needed (same class as T7.19's ruling, FSD-003:63-76).
frequency: OBSERVED-workaround (silent transitions — code-proven).
Agent sentence: "When plans move, your phone moves with them."
Notice day 1: **y** (the first no-information chair gap).

**E-an-04 Did-not-show / thank-you / slot-available — MED-HIGH.**
No template/trigger/channel for the whole lifecycle set (Gap.md:268). T7.4 ranks the bundle at
22/24 with the honest caveat: ship the three transactional ones first; a noisy thank-you on an
SMS market damages the channel that carries reminders (FSD-002:169-171). "Slot-available" is
waitlist-adjacent — do NOT build it before E-bc-03 exists (an offer for a queue nobody joined).
frequency: OBSERVED-workaround (four templates total — file-proven).
Agent sentence: "No-shows, thanks, openings — your clients hear from you without you typing."
Notice day 1: **y** for no-show notice; **n** for thank-you.

**E-an-06 Birthday / welcome / milestone — LOW-MED.**
No birth date captured; no welcome/milestone template (Gap.md:272). T7.1 (welcome offer,
21/24) waits on the T7.4 plumbing — correct order from my seat: a welcome *discount* message
before a working message catalog is a second WIN10-class lie waiting to happen. Loyalty-flavored
messages (reward-loyal, milestone) sit behind the LOYALTY_ENABLED gate (LEDGER.md:30;
docs/loyalty-opening.md) — condition changes require a recorded decision; not this session.
frequency: UNDOCUMENTED.
Notice day 1: **n**.

### analytics-reporting (3)

**E-ar-01 Reporting & analytics — HIGH. The dead-surface embarrassment.**
The endpoint computes 7-day revenue/bookings/top-services/repeat (tenant.ts:450-546); the
dashboard fetches into `weeklyRevenue`/`weeklyDaily` and **never renders them**
(Gap.md:281; index.tsx:597-598, 641-650 — grep-confirmed no reader). T7.8 scored 23/24 — zero
new server code (FSD-002:86-104). Workaround today: the owner counts cash in the evening. The
brief's own re-entry sentence names my thesis: "Returns when the first billing-active tenant
asks 'how am I doing' — a sentence the agent program should be **listening for**" (FSD-002:104).
frequency: OBSERVED-workaround (computed-but-unrendered — code-proven).
Agent sentence: "Every Monday, see last week's money — your top service, your regulars, your
birr." (Cash-invisible caveat ships on the card face, per FSD-002:98-100 — otherwise this
feature *becomes* the E-pm-18 complaint.)
Notice day 1: **y** — this is the merchant-home number.

**E-ar-02 Automation performance — LOW.**
Platform-wide channel success only (Gap.md:285); per-message attribution needs the catalog
first, and delivery stats already overstate email via the stub-id bug (COMPARE-02 §G). Fix the
ledger before selling the graph. frequency: UNDOCUMENTED. Notice day 1: **n**.

**E-ar-04 Client-source attribution — LOW (and honest about why).**
Tenant-level `acquired_via_code` exists; no booking-level source, no pixel tags
(Gap.md:289). T7.16 waits because "worth more with paid acquisition, which Season 0 forbids"
(LEDGER.md:26). Note: `booking_source` *does* exist on appointments (repo-map column list;
queue.ts:9-12 — with the docstring-vs-code disagreement flagged in COMPARE-02 §G) — what's
missing is marketing-channel attribution, not the walk-in/online split.
frequency: DECISION-recorded (deferred by season).
Notice day 1: **n**.

### team-permissions (5)

**E-tp-01 Staff profiles — LOW-MED.**
Bio + image columns exist; UI edits only name/title, "no picker" (Gap.md:298;
StaffPage.tsx:35-36 carries dead optional fields). Workaround: the owner's Instagram handles
faces. On the booking page, a staff card with just a name is enough for a market that books
"the same person as last time." frequency: OBSERVED-workaround (dead type surface).
Agent sentence: none. Notice day 1: **n**.

**E-tp-02 Custom permission roles — none-in-addis-today.** Three fixed roles with server-side
checks (Gap.md:302) fit 1-3 staff shops exactly. frequency: UNDOCUMENTED. Notice day 1: **n**.

**E-tp-03 Timesheets — LOW.** Planned availability only (Gap.md:306). Staff live above the
shop; "clocking in" is walking up the stairs. frequency: UNDOCUMENTED. Notice day 1: **n**.

**E-tp-04 Wages / commissions / per-member pricing — LOW, with a caution.** No compensation
fields (Gap.md:311). Commission *calculation* is the near-kin of pay runs (E-pm-20 — struck);
an agent who hints "Egebeya computes what you owe each stylist" invites a product Egebeya is
forbidden to promise. Per-member pricing has a real shape here (senior vs junior braider rates)
— if it ever lands, it lands as per-member service price, not payroll. frequency: UNDOCUMENTED.
Notice day 1: **n**.

**E-tp-05 Member lifecycle — MED, and it's the data-loss one.**
Invite + **hard delete** exist; no archive-with-history (Gap.md:315). A stylist leaving =
delete (loses attribution) or keep-active (pays for a ghost / steals a plan slot — staff is
plan-gated, repo-map tenant.ts:101). Workaround: the owner keeps a disabled-thing with a fake
name. frequency: OBSERVED-workaround (delete-only surface).
Agent sentence: none in one breath; this is a retention detail, not a close.
Notice day 1: **n** — **y** at first staff exit, which in salons is never more than 6 months
in (INFERRED-from-industry, no local file).

### content-site (2)

**E-cs-05 Custom domain — LOW.**
Connect-a-domain (Pro) with format checks; no DNS verification, no purchase (Gap.md:324).
Workaround: `slug.egebeya.et` printed on the shop's Telegram stickers; Addis discovery runs on
Telegram, not address bars. The missing *verification* is the security debt to note, not a
merchant pain. frequency: UNDOCUMENTED.
Agent sentence: "Your own address, your own name, on Pro." — fine as an upsell line, it's
already half-true today. Notice day 1: **n**.

**E-cs-06 Book button / embed / share / QR — MED-HIGH (it's the QR).**
Iframe embed + share link ship (Gap.md:328; EmbedBooking.tsx:17-42; site-generator.ts:195);
the *merchant surface to retrieve the snippet* is the recorded G4 residual (FSD-003:97), and
QR is absent. The workaround that proves the pain: Instant Empire's whole acceptance criterion
is "a salon owner shares her site to Telegram within 5 minutes of signup" (ROADMAP §1) —
sharing exists; **printing** is the gap. A QR sticker at the mirror converts the walk-in who
won't type a URL. frequency: OBSERVED-workaround (no merchant-visible snippet/QR surface).
Agent sentence: "One QR on the mirror books your chair while you work."
Notice day 1: **y** (share link today; QR on ship).

### api-integrations (1)

**E-ai-04 Google Reserve / Meta booking — none-in-addis-today.**
G2 dead: "integrations do not exist for this market" (Gap.md:336; LEDGER.md:64; FSD-003 S-11
scores 9 value = "a distribution wish, not a feature"). Workaround: Instagram bio link = the
tenant page — already the pattern. frequency: DECISION-recorded. Notice day 1: **n**.

### localization (1)

**E-l10n-01 Bilingual UI, Amharic-first — HIGH. This is the street-agent feature.**
The gap is honest and specific (Gap.md:344): resources exist, toggle exists, **default resolves
to English unless the browser signals 'am'** (src/i18n.ts:7) — many Addis Android browsers
report `en-US`; and several surfaces are English-only, Discover's own header and buttons being
the worst (Discover.tsx:115-131 — T7.13 brief names "hardcoded English strings," FSD-002:71-72).
Every other Amharic win (receipt prints "ደረሰኝ", 4 Amharic templates, category packs) is
COMPARE-02 §C.9 and real; the *default* betrays it. The whole go-to-market is a founder with a
phone convincing an owner in Amharic that this app is *theirs* — an English-first first screen
undoes the close in the same 60 seconds.
frequency: OBSERVED-workaround (default-detection + hardcoded strings, code-proven; the
per-feature "several surfaces English-only" claim is in Gap.md itself).
Agent sentence (the one-breath, already in the roadmap's voice): "የደረሰኝ — your receipt, in
Amharic, automatically." / EN: "It speaks Amharic before it speaks English."
Notice day 1: **y** — first screen, first impression, for both merchant and consumer.

### INFRA-BLOCKED (2) — Rule 20: substitutes required, "skip because infra" is invalid

**E-ai-03 — re-scoped by CEO (Gap.md:354) to an internal shared staff calendar. From my seat:
the single most ask-shaped line in the Gap file. Impact: HIGH. Position: build this season's
cheapest version now.**
Read the re-scope for what the CEO wrote: not Google sync, but "a SHARED CALENDER FOR THE
BUSINESS WHERE STAFF CAN SEE THEIR SCHEDULE AND THE OWNER HAS ALL THIS STUFF… THE UI WILL BE
A CALENDER." That is two sentences a real Addis merchant *already says* into Telegram every
week: an owner typing "ስለዚህ ቀን አለህ?" into a staff chat, and a stylist calling to ask if
they're on tomorrow (the E-ms-02 workaround: per-weekday windows that publish nothing —
Gap.md:184). The external-sync half genuinely needs the queue/worker (Gap.md:352 —
durable subscription + retry; two instances double-run all 7 crons, Gap.md:367 — true, and
irrelevant to the read-only internal view). **The internal shared calendar needs no new
infrastructure at all:** it is a staff-role read surface over data that already exists
(staff_availability + appointments, both live in repo-map tables) for the 20,000-tenant-scale
volume of one shop. My support-desk argument: every owner on a second chair is currently a
human message bus between the calendar and their staff; that's the job the product should
steal. Frequency: the *ask* is UNDOCUMENTED (Season 0 — no tenant quotes exist) but the
*shape* is the CEO's own re-scope, the queue's own EGE-ADVANTAGE surfaces (staff nav already
includes Queue — repo-map QueueConsole disagreement), and the 5-actor matrix's staff-actor
gap (Rule 15: today staff see the queue, never the week). The one-breath agent sentence writes
itself: **"Your staff see their week on their own phone — no phone calls to you."** Day 1:
**y** — the first staff question an owner deflects to the app is the day this earns its keep.
Verdict: implement the calendar view *before* the queue exists; keep the two-way sync parked
with the worker (Gap.md:395), and tell the queue/worker debate this is the merchant-facing
prize the infra actually unlocks.

**E-ai-05 Data export / BI connector — MED, substitute available now.**
Continuous ETL genuinely needs the worker (Gap.md:358); the one-shot CSV endpoint exists with
**zero UI callers** (Gap.md:163 via E-cm-05; repo-map dead surface tenant.ts:2122). The
merchant's actual sentence is never "BI connector" — it's "give me my bookings in a file I can
open" (INFERRED-from-JTBD: "Own the data"). Substitute (Rule 20): ship the export *button* —
part of T7.17 at 22/24 — and a monthly emailed CSV as a cron; defer connectors to the worker
plan honestly. frequency: OBSERVED-workaround (endpoint without button).
Agent sentence: "Your book is yours — one click, an Excel of every appointment."
Notice day 1: **n** (until first reconciliation / first threat of leaving).

---

## 2. Top 10 daily-grind — what changes a merchant's or consumer's TODAY

| # | Feature | The workaround it kills | Evidence |
|---|---|---|---|
| 1 | **E-pm-18** offline/cash recording | Running two books: app + paper notebook, cash invisible | code-proven (GAP: payments rows only from Chapa) |
| 2 | **E-ms-03** closure write path | Being booked on a holiday, or cancelling clients by phone, or closing every Wednesday for one | code-proven (write-orphaned table enforced on every read) |
| 3 | **E-ar-01** render existing analytics | Counting cash at night to know how the week went | code-proven (computed, fetched, never rendered) |
| 4 | **E-an-03** reschedule/cancel notices | The empty chair that looked full: silent reschedules | code-proven (4 templates only) |
| 5 | **E-an-01** merchant-set reminder lead | Living with the fixed 2h window that fits nobody | code-proven (sendReminders.ts:51-52) |
| 6 | **E-l10n-01** Amharic-by-default first screen | An agent translating the app live, in a close | code-proven (i18n.ts:7; Discover.tsx English) |
| 7 | **E-ai-03** (re-scoped shared staff calendar) | The owner as human message bus to their staff | CEO re-scope + staff-actor gap |
| 8 | **E-ds-06/07** price + same-day on cards | Calling to ask "how much / any space today" (consumer side) | code-proven payload; T7.13 23/24 |
| 9 | **E-mg-02** stop the lying widgets (T7.17 half) | A merchant sending "WIN10" codes that fail at booking | code-proven (FSD-002:119-121) |
| 10 | **E-ca-02 / T7.12** honor STOP | Spamming the client who asked to be left alone → founder-TG complaints | code-proven (suffix with no reader) |

Honorable mentions (11–13): E-pm-15 refund honesty (a duty, not a rank — first), E-cs-06 QR
(print the link), E-ts-03 prepay-deterrent (already fires; sell it).

## 3. What NOT to build for merchants (parity theater, from market-fit evidence)

- **E-pm-06, E-pm-07 (hardware/POS half), E-pm-19** — no rails exist (LEDGER G2 table;
  chapa.ts single rail). Not "not now" — not here.
- **E-ml-01/02/03** — founding cohort is single-chair (ROADMAP §0 verdict on marketplace;
  "one vertical with paying density"). Multi-location before multi-tenant demand is schema
  grief for a buyer who doesn't exist.
- **E-bc-10 assignment rules, E-ts-02, E-mg-07 boosting** — these serve staff pools, review
  volume, and marketplace traffic that Egebeya's tree proves doesn't exist yet (alphabetical
  directory with unmeasured traffic; no reviews table). Selling rank on an empty directory
  taxes trust.
- **E-ai-04** — integrations don't serve Ethiopian venues (LEDGER G2; FSD-003 S-11: value 9,
  "a distribution wish").
- **E-ds-04 map view** — no coordinate capture; sub-city text zones are the parked right-shape
  (LEDGER.md:65).
- **E-ca-01 marketplace profile** — account-free booking is *advantage* here, not debt
  (COMPARE-01:83).
- **E-tp-02/03/04, E-ms-04** — HR-grade surfaces for 1-3 person shops; the market-fit axis
  kills them and FSD-003's gate-price method backs it (killed rows worth 3-13 on value,
  nothing "tempting" on the other side).
- **Full calendar grid as day-one centerpiece (E-ms-01)** — the council's own acceptance
  criterion is queue-clearing, not drag-and-drop (ROADMAP §1 M2). Ship the week to staff
  (E-ai-03 re-scope), not a canvas.
- **E-an-06 milestone/reward messages** — behind the loyalty gate; condition changes require a
  recorded decision in docs/loyalty-opening.md. Not this council.

## 4. Voice of the consumer — what /discover and /:slug/book print today

What a consumer sees **now**: alphabetical directory cards with name, category chip, city-or-
"NEW · No bookings yet"-or-slug (public.ts:175-192; Discover.tsx:240-256); a search placeholder
advertising services the search can't match (Discover.tsx:122); prices only *after* entering a
shop; today's queue board and dual-calendar times inside the booking flow (E-ds-07's hidden
asset); an all-English directory header on an Amharic-first market's homepage
(Discover.tsx:115-131 + i18n.ts:7).

What they **misread while rows are missing**:
- **No price on card (E-ds-06)** → "this is a brochure, not a shop with prices" — the
  pre-commitment comparison shoppers who exist in every Telegram group bounce to asking the
  owner directly; the directory earns nothing from visits it doesn't convert (INFERRED).
- **"NEW · No bookings yet" (E-ds-05/07 absence)** → honest, but consumers read zero-trust as
  zero-worth; without ratings or same-day proof, NEW is a warning label on the founder's own
  merchants. This is the strongest consumer-side case for E-ds-07 shipping *with* E-ds-06.
- **Alphabetical order (E-mg-07 absence)** → reads as ranking; shops named "A…" win a slot
  they didn't earn and merchants will notice ("why is she above me") before any boost product
  exists. Don't sell the fix until there's traffic; do not pretend ordering is neutral copy.
- **City substring filter (E-ds-03)** → "Bole" typed into a city box returns nothing, teaching
  the consumer the directory is empty when it isn't.
- **No treatment search (E-ds-02)** → the placeholder promise fails silently at zero results;
  change the placeholder until the feature exists (a one-line honesty fix, same family as T7.17).
- **Missing cancel/reschedule notices (E-an-03)** → consumers who reschedule believe the shop
  knows; it doesn't — the misread lands on the *merchant's* desk as a no-show argument.
- **Queue board inside booking (E-ds-07 hidden half)** → consumers don't know "space today"
  is computable *already*; the surfacing is a copy-and-badge job, which is why T7.13 scores S.

## 5. Frequency-honesty summary (the count the founders asked for)

- Features with **ZERO documented merchant evidence** (no tenant count, no quote, no ticket
  tally anywhere in docs/decisions, _knowledge, _compare, or the tree): **68 of 68.**
- Independently of that (the classes overlap; a code-proven workaround is evidence of forced
  behavior, never of a *request*): **31** rows carry OBSERVED-workaround evidence (a live code
  path forcing the workaround), **8** carry DECISION-recorded signals (gate kills, DUTY flags,
  shortlist re-entry sentences in LEDGER/FSD files, plus the E-ai-03 CEO re-scope), and the
  remaining ~30 rest on UNDOCUMENTED status or JTBD inference only.
- The only forward-looking ask-sentences in any file, and therefore what the agent program must
  listen for and *date-stamp when first heard*: "how am I doing" (FSD-002:104 → E-ar-01),
  "can you also sell my products?" (ROADMAP §0 marketplace re-open ≥10 tenants), and the CEO's
  re-scope of E-ai-03 into a staff-facing calendar — an owner asking the product to tell their
  staff. Every support conversation this season should attach its nearest feature ID; until it
  does, no council after this one should claim any row was "asked for."

*— Subagent D. Files are truth; line numbers are hints; tenant counts are not available in
Season 0 and none were invented.*
