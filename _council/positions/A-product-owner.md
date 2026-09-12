# Position — Subagent A, Product Owner

**Date:** 2026-09-12 · **Season:** 0 — ship and activate (docs/feature-selection.md §0)
**Scope:** all 68 in-scope Gap.md features. E-pm-12 (BNPL) and E-pm-20 (Pay runs) are struck by the CEO — not debated here.
**Method:** every entry declares a surface (Rule 1), cites COMPARE-01 rows and/or tree-verified `file:line` (Rule 17), tags confidence (Rule 3), and flags CAUTION on money rows (Rule 6). No COMPARE-03 protected item appears in the ladder (Rule 7); EGE-ADVANTAGE collisions are named (Rule 8). v1 KB files not cited (Rule 4).

**Confidence legend:** HIGH = claim re-verified in the working tree this session; MED = cited from COMPARE-01/repo-map without re-opening the file; LOW = provisional on a KB GAP (Rule 10).

---

## 1 · Feature-by-feature positions (16 Gap.md sections)

### discovery-search (7) — surface: consumer marketplace

- **E-ds-01 Category browsing** — Smallest unit: widen `tenants.category` from 4 fixed values to the CEO-confirmed 14 (Gap.md:7), plus a Discover filter row. NO vertical landing hubs (/lp/bt/{category}) — that is the 16-template SEO grammar (Rule 18), a separate season's build. | consumer marketplace | **NEXT** — rides the existing category filter (`src/api/public.ts:103` HIGH, eq(tenants.category) verified); touches register copy in both locales, no this-cycle urgency. | COMPARE-01 F-mp-01 row. **MED**
- **E-ds-02 Treatment-level search** — Smallest unit: add a `services.name LIKE` join to /discover (the treatment entity already exists — schema.ts:67 services, verified HIGH). The tt-page grammar is out. | consumer marketplace | **DEFER** with trigger: after E-ds-06 cards ship and `search_intent` shows typed queries. | COMPARE-01 F-mp-02; `public.ts:113-117` name-only. **MED**
- **E-ds-03 Neighbourhood scoping** — Smallest unit: structured `settings.district` on save + district filter; seed the Addis sub-city list. | consumer marketplace | **DEFER** — city-as-JSON-substring works today (`public.ts:106-111` verified HIGH); no consumer demand signal yet. Ship its data-collection inside E-ds-04's coordinate unit. | COMPARE-01 F-mp-03. **MED**
- **E-ds-04 Map view** — Smallest unit: collect lat/lng on settings save (two-way door, invisible today). Map UI only after ≥50 listed Addis tenants carry coords. | consumer marketplace | **DEFER** — G2-killed as a build-now (FSD-003 S-12: no coordinates exist anywhere; OSM redesign parked). Collecting the seed field is cheap; rendering an empty map is a demo-killer. | FSD-003 S-12; `public.ts:56-209` no coords verified. **LOW** (KB GAP 2: venue pages unobserved)
- **E-ds-05 Aggregate rating display** — Smallest unit: print avg+count from the E-mg-05 reviews table. Nothing to display until that table exists. | consumer marketplace | **DEFER** strictly behind E-mg-05. | COMPARE-01 F-mp-05; no reviews table verified HIGH in schema. **HIGH**
- **E-ds-06 Price-visible menus** — Smallest unit: `fromPriceEtbCents` on the discover payload + card render (T7.13). | consumer marketplace | **NOW** — shortlist #1 (23/24), pure payload+card, no schema change, kills the click-away card. | `public.ts` discover payload verified HIGH: returns id/name/slug/category/city/heroImage/isNew only; COMPARE-01 F-mp-06. **HIGH**
- **E-ds-07 Same-day availability surfacing** — Smallest unit: `openToday` boolean on the same payload, batched (queue.ts:44-63 discipline). | consumer marketplace | **NOW** — same diff as E-ds-06; the availability generator already exists (`public.ts:477-591`). | COMPARE-01 F-mp-07. **HIGH**

### booking-core (8) — surface: consumer marketplace unless noted

- **E-bc-03 Waitlist** — Smallest unit: T7.7 `slot_waitlist` table + join-CTA on full day + first-in-line SMS offer with single-use claim token. | consumer marketplace (owner actor secondary) | **NEXT-cycle back / LATER** — one-way door, new entity riding BEGIN IMMEDIATE; ledger scores 19/24 with "demand unobserved locally". Do NOT implement it by bending the walk-in queue — that is EGE-ADVANTAGE territory (Rule 8): waitlist is a *separate* table beside `queueState` columns (schema.ts:135-136 verified), never a re-cut of `server/lib/queue.ts`. | COMPARE-04 T7.7; grep-zero waitlist verified. **MED**
- **E-bc-04 Group bookings** — Needs multi-attendee rows + capacity per slot: new machinery (effort L). | consumer marketplace | **DEFER** — nothing in the funnel needs it; single customer + N services covers the local party pattern informally. | `public.ts:755-779`. **MED**
- **E-bc-06 Service sequencing** — Ordered steps + resource concept: company-shaped. | merchant SaaS | **DEFER** — no Addis salon is losing bookings to missing consult-then-treat enforcement. | COMPARE-01 F-mp-25. **MED**
- **E-bc-07 Statuses & notes** — Smallest unit: `appointments.notes` TEXT column + textarea in the booking detail card. | merchant SaaS | **NEXT** — ship inside the T7.11 authored-record bundle (same seam, same PDPL erasure assertion). | `bookings.ts:89-92` statuses verified; no notes column verified HIGH. **HIGH**
- **E-bc-08 Reschedule (merchant drag)** — Client self-serve is shipped (`public.ts:1293` verified HIGH in repo-map). Smallest remaining unit: owner moves an appointment via the detail sheet (no drag). | merchant SaaS | **DEFER** — drag arrives with the E-ms-01 grid; a button-reschedule now would fork the UX twice. | COMPARE-01 F-mp-27. **HIGH**
- **E-bc-09 Cancellation reason capture** — Smallest unit: fixed enum + optional text on both cancel paths (public + merchant). Money register: no money — records *why*, never charges. | consumer marketplace | **NEXT** — T7.11 bundle. | `public.ts:1267-1291` verified HIGH: sets status='cancelled', zero reason fields. **HIGH**
- **E-bc-10 New-appointment assignment rules** — Round-robin/seniority engine. | merchant SaaS | **DEFER** — consumer-picks-staff is the market behavior (E-bc-02 SAME); rules engine is a 50+-staff concern. | `public.ts:441-465`. **MED**
- **E-bc-11 Online availability controls** — Smallest unit: per-service `sellableOnline` flag + min-notice/max-lead settings-blob fields enforced in the availability generator. | merchant SaaS | **NEXT** — shares T7.2's settings-blob seam (`tenant.ts:1185`), genuinely requested merchant hygiene. | COMPARE-01 F-sa-98: active flags exist (schema.ts:74 verified HIGH), no lead controls. **MED**

### payments-money (11) — ALL CAUTION (Rule 6); surface: merchant SaaS

- **E-pm-05 Per-appointment payment-policy override** — Must not become a partial deposit (COMPARE-03 item 3: prepay-only is protected, Rule 7). | merchant SaaS | **DEFER** — override complexity on a policy that is deliberately one shape. | `public.ts:807-814`. **MED**
- **E-pm-06 Card terminals** — **DEFER / rails-dead** — G2 kill stands (FSD-002 kill table): `chapa.ts:81-136` verified HIGH as the only rail; no hardware surface is buildable or sellable here. **HIGH**
- **E-pm-07 Tap-to-pay / QR / Pay Now links** — Split the ticket: (a) QR *of the existing booking share-link* = NEXT, no money movement, rides the E-cs-06 seam; (b) payment links that charge outside a booking = **DEFER + ESCALATE** — a brand-new money surface (moves money), one-way door, CEO territory per Rule money-register ("any 'move' is CEO territory"). | merchant SaaS | Evidence: repo-map endpoints verified HIGH — zero payment-link/QR route; v1 never charges. **HIGH**
- **E-pm-08 Tips** — Smallest unit: preset/custom tip step on the existing prepay charge, stored in `payments.meta` (T7.10). | merchant SaaS | **DEFER pending CEO** — a tip is money the platform routes but cannot pay out; FSD-002 itself says it "needs a staff-attribution decision first". Amount calc verified HIGH (`public.ts:877`, no gratuity term). | COMPARE-04 T7.10; CAUTION. **HIGH**
- **E-pm-09 Gift cards** — Stored value sold to consumers: sits next to COMPARE-03 item 6 (client wallets DEAD permanently, NBE wall). **DEFER + ESCALATE**: legal/council ruling before any schema. No gift-card table exists (verified HIGH). **HIGH**
- **E-pm-11 Packages & bundles** — Prepaid liability with undefined refund semantics until T7.5 ships. **DEFER + ESCALATE** (money-record + promise). No packages table (verified HIGH, schema scan). **MED**
- **E-pm-15 Refunds** — Split: (a) **copy fix NOW** — the landing page says "Refunded automatically if the business cancels." (`en.json:63` verified HIGH) while the cancel endpoint says "A refund must be issued manually" (`public.ts:1283-1285` verified HIGH) and the cron says never-automatic. A false public money promise is a defect, not a backlog item (FSD-002 Duties). (b) one-tap "refund issued" ack = NEXT (records a manual act, no movement). (c) Chapa refund initiation = **DEFER + ESCALATE** (moves money). CAUTION on (b)/(c). **HIGH**
- **E-pm-16 Void/raise/edit; receipts** — Smallest unit is inside T7.5's sale ledger: void flag + reprint on payment rows. **DEFER behind T7.5**; invoices today cover platform billing only (`tenant.ts:720-836`, schema.ts:324 MED). **MED**
- **E-pm-17 Taxes & service charges** — Smallest unit: tenant VAT/service-charge setting → additive line in the one place the amount is computed (`public.ts:877` verified HIGH: `max(0, total − promo − loyalty − quiet)`) + itemized ticket. **NEXT but CEO-gated**: it changes what a consumer is charged = a money promise; needs the design doc FSD-002 already demands ("the order must be asserted, not assumed"). CAUTION. **HIGH**
- **E-pm-18 Manual/offline payment types** — Smallest unit: owner records cash/off-platform completion → `payments` row, `gateway=null`, `status='completed'`, no gateway call (T7.5(b)). **NEXT, ship independently of the tax half** — records money, moves none; this is the sentence that closes Pro founders ("how much did I take this month"). Verified HIGH: `payments.method` column exists (schema.ts:180) with no entry surface anywhere in the 134 endpoints. CAUTION. **HIGH**
- **E-pm-19 Merchant credit** — **DEFER** — Gap.md:119 itself parks it pending licensing; nothing to sequence. **HIGH**

### consumer-account (2) — surface: consumer marketplace

- **E-ca-01 Client account & profile** — Smallest unit: name-only profile editor on /my-bookings. **DEFER** — identity-lite *is* the market-fit advantage (E-ca-03 SAME: self-service achieved without accounts — `public.ts:1382-1430` status/cancel/reschedule by opaqueId+phone, verified HIGH); deepening the account surface now adds friction, not activation. | COMPARE-01 F-mp-70. **MED**
- **E-ca-02 Notification & marketing preferences** — Smallest unit: consumer prefs GET/PUT + "STOP everything" + Telegram `/stop` consumed in the existing webhook (T7.12). | consumer marketplace | **NOW — as a DUTY, not a scored candidate** — consent is captured in three places but withdrawn only on the merchant's CRM (`crm.ts:246-291` verified HIGH); PDPL 1321/2024 wants parity. Blast already appends "Reply STOP" and nothing reads it. One-way door; FSD-001's DUTY flag is right. **HIGH**

### client-management (7) — surface: merchant SaaS

- **E-cm-01 Client profiles & history** — Smallest unit: T7.11 — the profile is 100% derived today (`customer_stats` columns verified HIGH: visits/spend/health/no-show only). **NEXT** — one of the two sentences that close a merchant in person. | COMPARE-01 F-sa-110. **HIGH**
- **E-cm-02 Allergy & patch-test records** — Inside T7.11: clinical fields on the customer record + surfaced on the QueueConsole card ("at the chair"). **NEXT**. Verified HIGH: no clinical column anywhere in schema.ts. **HIGH**
- **E-cm-03 Custom intake forms** — Form-definition engine = DEFER. Minimal substitute: one optional free-text "notes for the salon" at booking feeding E-cm-02 (PublicBooking.tsx:15-23 fixed capture verified MED) — ship inside T7.11. **MED**
- **E-cm-04 Tags & segments** — Smallest unit: free-form tags array on customer_stats + CRM filter beside the computed health tags (`customer-health.ts:27` verified MED). **NEXT**, T7.11 row-neighbor. **MED**
- **E-cm-05 Import/export/merge/delete** — Split: **Export button NOW** inside T7.17 (`tenant.ts:2122` verified HIGH — live endpoint, zero UI callers). Import/merge/per-client delete DEFER. **HIGH**
- **E-cm-06 Files on client profiles** — Smallest unit: link existing tenant upload (`tenant.ts:1401` verified HIGH in repo-map) to a phone. **NEXT**, T7.11 bundle; PDPL erasure assertion included. **MED**
- **E-cm-07 Block clients from booking** — Smallest unit: mirror `consumer_blocks` (schema.ts:548, endpoints verified HIGH at trust.ts:95-152) into a tenant→consumer block checked in the booking POST. **NEXT, top of band 2** — small, closes the asymmetry, real owner-safety story. | COMPARE-01 F-sa-118. **HIGH**

### merchant-scheduling (5) — surface: merchant SaaS

- **E-ms-01 Smart calendar** — Smallest unit: week grid rendering the existing dashboard bookings payload — READ-ONLY first. **NEXT**; this is the same build as the CEO's redefined E-ai-03 (see §4). EGE-ADVANTAGE collision (Rule 8): the grid sits *beside* the queue card stack (E-bc-12 walk-in), never replacing it; do not refactor the queue (AGENTS.md:21). | `Bookings.tsx:36-129` day-list verified via matrix. **MED**
- **E-ms-02 Shift scheduling / rosters** — Smallest unit: staff sees their own week on the same grid via the existing role projection (`bookings.ts:23-58` verified MED; StaffRedirect.tsx exists). **NEXT**, same build as E-ms-01 — per-weekday windows already exist (`tenant.ts:373` verified HIGH in repo-map). **MED**
- **E-ms-03 Blocked time & closures** — Smallest unit: T7.6 POST/DELETE closures + Ge'ez holiday suggestions. **NOW** — table write-orphan verified HIGH this session (closures written only by seed/cleanup/accountDeletion; enforced on every availability read at `public.ts:508-514,651`). A merchant who closes for Enkutatash cannot say so. Cheapest trust win in the file. **HIGH**
- **E-ms-04 Time-off types** — Request/approval flow = DEFER; closures + per-weekday availability cover the real behavior for 3-staff shops. No table (verified HIGH). **HIGH**
- **E-ms-05 Processing/extra times** — Smallest unit: `bufferMinutes` on services (T7.15). **DEFER** behind T6.4 (duplicate expand-series consolidation — repo-map cron note verified HIGH) — the ledger's BLOCKED status is correct; it's an engineering pre-requisite, not product sequencing. Single duration verified HIGH (`schema.ts:71`). **HIGH**

### multi-location (3) — surface: platform-scale merchant SaaS

- **E-ml-01 Multiple locations** — **DEFER** — one-tenant-one-location is load-bearing (verified HIGH: `tenants.slug` unique, every query carries inline eq(tenantId) per AGENTS.md:29-30). A location entity re-shapes the entire tenancy law. Company-shaped. **HIGH**
- **E-ml-02 Independent merchants / workspace** — **DEFER + ESCALATE** — sale attribution to chair renters is money-register territory and collides head-on with the struck E-pm-20 pay-runs scope. staff-as-login verified HIGH (schema.ts staff.userId). **HIGH**
- **E-ml-03 Cross-location operator visibility** — **DEFER** (needs E-ml-01; admin console is platform-operator, not shop-operator). **MED**

### trust-safety (2) — surface: consumer marketplace / platform

- **E-ts-02 Report/reply to reviews** — **DEFER** behind E-mg-05; nothing to report (no reviews table, verified HIGH). | COMPARE-01 F-mp-281. **HIGH**
- **E-ts-03 No-show protection as policy engine** — The behavioural half is shipped and protected: no-show counter + per-phone forced-prepay (`crm.ts:293-337` require-upfront endpoints verified HIGH in repo-map). The monetary half is COMPARE-03 item 4 — **not reopenable** (Rule 7). Smallest honest unit: surface the existing force-prepay as a named policy toggle in Settings. **DEFER** (UI polish, no new behavior). **HIGH**

### marketing-growth (5) — surface: merchant SaaS

- **E-mg-01 Blast campaigns** — Smallest unit: scheduled sends + a per-template performance view from `notification_log` (template column verified HIGH, schema.ts:438). **NEXT, strictly AFTER E-ca-02 ships** — expanding marketing sends before consumers can withdraw consent is backwards. Email campaigns blocked honestly: mailer is a logged stub without SMTP_HOST (repo-map constraint verified HIGH) — do not sell what is stubbed. SMS-only until mail config is real. | COMPARE-01 F-sa-130. **MED**
- **E-mg-02 Deals & promotions** — The lying-widgets half (`WIN10` hardcoded — WinBackWidget.tsx:56-62, matrix-cited) ships **NOW** inside T7.17. Deal wrapper (window+audience+redemptions from `usedCount`) **NEXT**. CAUTION (touched price semantics; up-pricing remains impossible per COMPARE-03 item 8, Rule 7). | COMPARE-04 T7.14. **HIGH**
- **E-mg-05 Review engine** — Smallest unit: reviews table + post-visit 1–5 SMS *riding the same completed-appointment transition T7.4 already adds* + aggregate display (unblocks E-ds-05, seeds E-mg-07). **NEXT-cycle minimal**; reply/report/moderation UI (E-ts-02) DEFER. No reviews entity verified HIGH. **MED**
- **E-mg-06 Referral program** — **DEFER** — referrer rewards are loyalty tiers/referral depth: G1-dead until the gate opens (COMPARE-03 item 9 protected, Rule 7; LEDGER G1 table). T7.18 agrees. | `acquired_via_code` supply-side verified HIGH (schema.ts tenants). **HIGH**
- **E-mg-07 Visibility boosting** — **DEFER + ESCALATE** if ever pursued: paid ranking monetizes marketplace trust and needs a policy ruling. Note the free first step — replace alphabetical ordering (`public.ts:135` verified HIGH: `.orderBy(tenants.name)`) with an activity/review blend — belongs with E-mg-05, not as a product. **LOW** (KB GAP 3: merchant ranking behavior unobserved)

### automation-notifications (4) — surface: platform (messaging engine)

- **E-an-01 Appointment reminder** — Smallest unit: T7.2 `settings.reminder_lead_minutes`, default 120 = byte-identical behavior for every existing tenant. **NOW** — two-way, rides the settings blob. Hardcoded 2h–2.5h window verified HIGH (`sendReminders.ts:51-52` read this session). | **HIGH**
- **E-an-03 Rescheduled/cancelled notices** — T7.4: owner told when a consumer reschedules (the reschedule route verified HIGH at `public.ts:1293` returns JSON, dispatches nothing); consumer told on merchant cancel. **NOW**. Templates verified HIGH: mailTemplates.ts contains exactly bookingCustomer/bookingOwner/reminder/passwordReset. **HIGH**
- **E-an-04 Did-not-show / thank-you / tip / waitlist / slot-available** — T7.4 ships the no-show + thank-you half **NOW** (both are event-driven at existing transitions). Tip/waitlist/slot messages are **bundled into their parent features** (E-pm-08 / E-bc-03) rather than half-built — Rule 13: the catalog is a set, and I ship it in dependency order, not in Fresha's order. **HIGH**
- **E-an-06 Birthday / welcome / milestone / reward-loyal** — Welcome-new-clients (T7.1) = **NEXT-cycle first** (rides the winback mint+consent path; CAUTION single-use code). Birthday needs DOB capture that doesn't exist (customer_stats verified HIGH: no dob). Reward-loyal waits on the gate (Rule 7). **MED**

### analytics-reporting (3) — surface: merchant SaaS

- **E-ar-01 Merchant reporting** — Smallest unit: render the already-fetched payload. **NOW** — verified HIGH this session: `Dashboard/index.tsx:597-598` declares `weeklyRevenue`/`weeklyDaily`, the fetch sets them at :641-650, and grep confirms **no other reader exists**. Zero new server code; cheapest Pro-conversion asset. | **HIGH**
- **E-ar-02 Automation performance** — Smallest unit: per-template delivery rollup from `notification_log` for the owner (the platform-wide stats already exist: notificationStats.ts, matrix-cited). **NEXT**; grows naturally out of the T7.1/T7.4 template expansion. **MED**
- **E-ar-04 Client-source attribution** — Smallest unit: carry a `src` param from the share/widget URL through POST bookings into the existing **`appointments.bookingSource` column** (verified HIGH in repo-map table list — half the plumbing already exists). Ads pixels = G2-dead rails. **NEXT** (T7.16 minus the pixel tail). | **HIGH**

### team-permissions (5) — surface: merchant SaaS

- **E-tp-01 Team member profiles** — Smallest unit: bio + image pickers on StaffPage. **NEXT** — verified HIGH: `staff.bio`/`staff.imagePath` columns exist (schema.ts:77-85 read this session) and `PUT /api/tenant/staff/:id` accepts them (repo-map tenant.ts:214); only the form fields are missing. A dead type surface with live plumbing is the definition of a small diff. **HIGH**
- **E-tp-02 Custom permission roles** — **DEFER** — three fixed roles are the security model (schema.ts:31 `role` text verified HIGH: owner/staff/admin); a per-member matrix is L-effort with no activation payoff. **HIGH**
- **E-tp-03 Timesheets** — **DEFER** — no timesheet entity (verified HIGH); payroll-adjacent, near the struck E-pm-20 boundary. **HIGH**
- **E-tp-04 Wages/commissions/per-member pricing** — **DEFER + ESCALATE** — the CEO struck pay runs; commission *recording* is the neighbor of a struck scope. It also gates E-pm-08 tips (staff attribution). Flagged to CEO as a coupled decision. **HIGH**
- **E-tp-05 Member lifecycle** — Smallest unit: `staff.status` enum (active/suspended/archived) so owners *archive* instead of DELETE (delete endpoint verified HIGH, tenant.ts:248) and history survives. **NEXT**, small integrity win. **HIGH**

### content-site (2) — surface: merchant SaaS

- **E-cs-05 Custom domain** — Smallest unit: DNS TXT verification before the domain binds (PUT /api/tenant/domain verified HIGH in repo-map; format-check-only per matrix). **NEXT**; domain purchase DEFER. **MED**
- **E-cs-06 Book button / embed / share link** — Smallest unit: QR of the existing share-link + copy-the-snippet block in the dashboard (share-link endpoint verified HIGH, site-generator.ts:195). **NEXT**, pairs with the E-pm-07 QR half. WordPress path DEFER. **HIGH**

### api-integrations (1) — surface: merchant SaaS

- **E-ai-04 Social-surface booking (Google Reserve / Meta)** — **DEFER / rails-dead** — G2 kill stands (FSD-002 kill table: integrations do not serve Ethiopian venues); EGE-ADVANTAGE note: the public /v1 API (E-ai-01) is *our* integration surface and is protected — build *out* from it, not imitatively inward. | `Settings.tsx` profile-links only, matrix-cited. **HIGH**

### localization (1) — surface: consumer marketplace

- **E-l10n-01 Bilingual UI (Amharic-first)** — Smallest unit: fix default-locale resolution + i18n the hardcoded Discover chrome. Verified HIGH this session: `Discover.tsx:115-131` is English-only JSX ("Discover Local Businesses", placeholder, and a "Search" button whose onClick *clears* the query). **NOW** — the Discover strings ride the T7.13 diff; COMPARE-03 item 11 protects Amharic-*first*, two locales — this is parity enforcement, not locale expansion. | **HIGH**

### INFRA-BLOCKED (2) — Rule 20: substitutes mandatory, no "skip because infra"

- **E-ai-03 Calendar sync** — Position in §4. Substitutes: (a) **NEXT** — per-staff public ICS *subscription* URL riding the existing one-way feed (`public.ts:1432-1478`, matrix-cited): Google/Apple calendars can already subscribe; that is one-way and needs zero infra. (b) The CEO's redefinition (shared staff/owner calendar) is a *UI build*, not a sync build — sequenced as E-ms-01/E-ms-02, **NEXT**. True two-way = behind queue. **MED**
- **E-ai-05 Data export / BI connector** — Substitutes: (a) **NOW** — the Export button in T7.17 surfaces the live one-shot CSV (`tenant.ts:2122` verified HIGH, zero callers). (b) **NEXT** — a nightly snapshot job riding the *existing* cron + media-storage pattern (no queue needed at 25 tenants). Continuous ETL = behind queue. | matrix `F-sa-264`. **MED**

---

## 2 · Sequenced ladder

**Season 0 honesty:** funnel scores are capped at 1 everywhere (FSD-002) — the "activation argument" below is mechanism-level, not measured. The expected verdict for everything here is UNMEASURABLE, and the ladder is ordered so the *unmeasurable* items are all two-way doors.

### Band 1 — THIS CYCLE ("be honest before being big")
All of it: no new entities, no queue, no schema risk beyond additive columns; every diff removes a lie or renders data that already exists.

1. **T7.17 close dead surfaces** (incl. E-cm-05 export button + E-mg-02 lying-widget half + E-pm-15 copy half) — the demo lies today: a route that doesn't exist, localStorage keys never set, `/settings` 404s, `WIN10` codes that fail at booking, and a landing page promising automatic refunds the code contradicts. Prereq for T7.14/T7.18 trustworthiness. Activation argument: a founder-led close dies when the owner taps "AI post" and gets canned English.
2. **T7.13 + E-l10n-01** (E-ds-06, E-ds-07) — the only consumer-visible funnel step Egebeya controls today: shared link → directory → first booking. Price + "ዛሬ ቦታ አለ" on cards is the click-decision; the hardcoded Discover header is embarrassing for an Amharic-first product.
3. **T7.8** (E-ar-01) — pure render of a fetched-but-unread payload (verified). "You took 42 bookings this month" above the price is the velvet-rope pattern, already proven in-repo.
4. **T7.6** (E-ms-03) — amend FSD-002's "#6, below the cut": I'm promoting it because it is S-effort, two-way, and the write-orphan (verified) is a correctness embarrassment. Enkutatash is a real calendar event for every tenant.
5. **T7.2** (E-an-01) — one settings field; default keeps byte-identical behavior.
6. **T7.4** (E-an-03 + no-show/thank-you half of E-an-04) — four templates on existing transitions; completes the "intelligent notifications" claim that Egebeya's SMS channel already carries.
7. **T7.12** (E-ca-02) — DUTY. PDPL withdrawal parity; ships before anything that expands marketing sends.

**Band-1 activation logic:** Season 0 = ship and activate; the first ten tenants are founder-closed. Every Band-1 item is either (a) something the owner sees in the first demo minute, or (b) a promise the code currently breaks. Nothing in Band 1 needs a decision I can't defend alone.

### Band 2 — NEXT CYCLE ("the record, the ledger, the grid")
8. **T7.11 bundle** — E-cm-01 + E-cm-02 + E-cm-06 + E-bc-07 + E-bc-09 (+ E-cm-04 tags, E-cm-03 minimal note-at-booking). Seam: `customer_stats` additive columns + `crm.ts`. One-way door; PDPL erasure assertion mandatory.
9. **E-cm-07 client block** + **E-tp-05 staff status** + **E-tp-01 staff bio/image** — three small integrity/trust diffs on existing endpoints.
10. **T7.5 split**: offline-cash recording (E-pm-18) ships on its own (records money); tax line (E-pm-17) waits for the CEO-gated design doc. E-pm-16 void/edit lands with the ledger shape.
11. **Shared calendar build** (E-ai-03 redefinition + E-ms-01 + E-ms-02) — read-only grid, then owner-initiated move (unblocks the merchant half of E-bc-08). No infra. Beside the queue, never instead of it (Rule 8).
12. **E-mg-05 review minimal** (table + post-visit prompt + E-ds-05 display) → seeds **E-mg-01 scheduling/perf view** and **E-ar-02** automation performance.
13. **T7.1 welcome** (E-an-06 partial) → **T7.14 deal wrapper** (E-mg-02) → **T7.16 attribution** (E-ar-04, cheap: `appointments.bookingSource` already exists — verified HIGH) → **E-cs-06 QR/share** (+ E-pm-07 QR half) → **E-bc-11 sell-online/lead controls** → **E-ds-01 category widening** → **E-cs-05 DNS verify** → **ICS subscription URLs** (E-ai-03 substitute (a)).

### Band 3 — LATER (trigger-gated, still on the 68 list)
- **T7.7 waitlist (E-bc-03)** — returns on a tenant request (ledger re-entry condition).
- **T7.15 buffers (E-ms-05)** — returns when T6.4 lands.
- **T7.3 rebook (E-an-04/06 neighbor)** — needs T7.1/T7.4 plumbing; already ordered here behind them.
- **T7.10 tips (E-pm-08)** — returns with the CEO's staff-attribution ruling.
- **E-ds-02 treatment search · E-ds-03 districts (+coords seed) · E-ca-01 profile editor** — return with directory traffic in `search_intent`.
- **E-ts-02, E-mg-07 ranking** — after review volume exists.

### Deferred-as-a-ruling (no ladder slot)
E-bc-04 · E-bc-06 · E-bc-10 · E-ms-04 · E-ml-01/02/03 · E-pm-05/06/09/11/19 · E-tp-02/03/04 · E-ai-04 · E-ts-03(monetary half — protected) · E-mg-06 · E-an-06(birthday/reward-loyal — gate-protected).

**Engagement with COMPARE-04 (T7.1–T7.18):** AGREE with the score order as a candidate pool; AMEND T7.6 into Band 1 (reason above); SPLIT T7.5 (offline-record independent of tax — FSD-002 already flagged the design-doc gate) and T7.9 (copy defect now, ack button next, gateway call never without CEO); CONFIRM the T7.14→T7.17 split FSD-002 already made; REJECT nothing. T7.1–T7.4 sequencing stands as written — message catalog first because everything else in Band 2 dispatches through it.

---

## 3 · Pairs & bundles (ship as ONE change — the named seam)

| Bundle | Gap features | Seam file |
|---|---|---|
| **Directory card** (T7.13) | E-ds-06 + E-ds-07 + E-l10n-01(Discover) | `src/api/public.ts` discover + `src/pages/Discover.tsx` |
| **Lifecycle messages** (T7.4) | E-an-03 + E-an-04(did-not-show/thank-you) | `server/lib/mailTemplates.ts` + the transitions in `public.ts`/`bookings.ts` |
| **Authored record** (T7.11) | E-cm-01 + E-cm-02 + E-cm-06 + E-bc-07 + E-bc-09 + E-cm-04 + E-cm-03(minimal) | `src/db/schema.ts` customer_stats columns + `src/api/crm.ts` |
| **Money ledger** (T7.5, tax CEO-gated) | E-pm-18 + E-pm-17 + E-pm-16 | `src/api/public.ts:877` calc + `ReceiptTicket.tsx` + revenue aggregate in `tenant.ts:450-546` |
| **Shared calendar** (CEO E-ai-03 shape) | E-ms-01 + E-ms-02 + E-bc-08(merchant half) + E-ai-03(redefined) | `server/api/tenantRoute.ts` + `src/pages/Dashboard/Bookings.tsx` |
| **Share & QR** | E-cs-06 + E-pm-07(QR half only) | `src/api/site-generator.ts` share-link + `src/lib/widgetRoutes.ts` |
| **Staff record** | E-tp-01 + E-tp-05 | `src/api/tenant.ts` staff PUT + `StaffPage.tsx` |
| **Availability controls** | E-bc-11 + (T7.2 settings seam) | `src/api/tenant.ts` settings blob + availability generator |
| **Review seed** | E-mg-05(minimal) + E-ds-05 + E-ar-02 view + E-mg-01 scheduling | new `reviews` table + `notification_log` template rollup |
| **Honesty sweep** (T7.17) | E-cm-05(export) + E-mg-02(widget lies) + E-pm-15(copy) | `MarketingDeck.tsx` + widgets + hrefs + `Landing.tsx`/`en.json`/`am.json` |

## 4 · Infra positions (CEO to-dos — shape, not re-litigation)

**E-ai-03 shared staff/owner calendar (Gap.md:354 redefinition):** This is a *UI build*, not a sync build, and I place it in Band 2 as the single largest small diff in the session: one read-only grid fed by the existing `/api/bookings` + role projection, giving staff their week (E-ms-02) and the owner everything (E-ms-01). It satisfies the CEO's wording ("staff see their schedule, owner has everything, the UI is a calendar") with **zero infra dependency** — and its absence does not block anything, while its presence unlocks E-bc-08's merchant half and makes E-ms-03's closures visible. The original two-way external sync stays behind the queue; its substitute until then is the ICS subscription URL (one-way, Band 2) riding the existing feed.

**E-ai-05 BI export:** substitutes above (button now, nightly snapshot next). Continuous ETL stays PARKED (G3) — I refuse to sell a "connector" the single process can't carry.

**Queue + worker migration (Gap.md:359-507):** My sequencing against the CEO's Phases 0–4:
- **Ships BEFORE any infra change:** all of Band 1, most of Band 2. Nothing on the 68 list requires a queue at current scale — the 50@1/s throttle ceiling is fine at 25 tenants (the ledger and Gap.md agree), and T7.4's messages are event-driven, not queued.
- **What genuinely requires it:** two-way calendar sync, continuous ETL, bulk sends ≳10k, and *multi-instance deploy safety*. The last one is the only infra risk that is real today.
- **Therefore: Phase 0-lite now, Phase 0 proper not.** Before Band 2, land a 1–2 day libSQL lock-row + BEGIN IMMEDIATE lease around the 7 crons (verified HIGH: `server.ts:243-310`, seven in-process schedules, no distributed lock). That kills the double-run risk without Redis. BullMQ+Redis (CEO's Phase 0) is correct *when the first queue-consumer feature actually arrives* — my vote: E-mg-05/E-mg-01 volume or a real second process. Phase 1 (crons→queue jobs) follows naturally; Phase 2 (DB): **stay on libSQL/Turso single-writer** — Postgres is a one-way door (dialect break) and no booking-correctness incident demands it; revisit only on measured double-run/throughput evidence (Gap.md's own "What NOT to switch" section agrees); Phase 3 (sync + BI export) after a design-partner tenant actually asks; Phase 4 is what my bands already did.

## 5 · Escalations to the CEO (money/legal/protected authority — Rule 6 + money register)

1. **E-pm-17** tax/service-charge additive line — changes the charged amount (money promise). Design doc gate.
2. **E-pm-15(c)** Chapa refund initiation — moves money. (Copy fix + ack button stay with me.)
3. **E-pm-08** tips — needs the staff-attribution/payout ruling it inherits from **E-tp-04**.
4. **E-pm-07(b)** pay-now links charging outside a booking — new money surface.
5. **E-pm-09** gift cards — stored value vs COMPARE-03 item 6 (wallets DEAD) needs a legal read.
6. **E-pm-11** packages — prepaid liability; refund semantics undefined until the ledger exists.
7. **E-ml-02** independent-merchant sale attribution — adjacent to the struck E-pm-20.
8. **E-tp-04** wages/commissions — adjacent to struck pay-runs scope; do not build "small" pieces that pre-commit the shape.
9. **E-mg-07** paid visibility boosting — marketplace-integrity policy decision, plus G1 loyalty-gate adjacency for any boost-by-engagement ranking.

Protected-gate reminders (not mine to open, Rule 7): E-mg-06 / E-an-06(reward-loyal) wait on the loyalty gate; E-ts-03(monetary) and E-pm-05 stay on the prepay-only/behavioral side of the line.

---

**Rules used, visibly:** 1 (surface per row), 3 (HIGH/MED/LOW per row), 4 (v2 + COMPARE files only), 6 (CAUTION on every E-pm row + §5), 7 (no COMPARE-03 item in any band; protected notes at E-pm-05/08, E-ts-03, E-mg-06, E-an-06), 8 (queue collision at E-bc-03/E-ms-01, /v1 API at E-ai-04, identity-lite at E-ca-01, Ge'ez browse at E-ds-04), 10 (LOW tags on E-ds-04/05), 12 (policy-as-feature at E-bc-11, E-ms-03, E-ts-03), 13 (message catalog shipped as a dependency-ordered set), 15 (owner/consumer/staff/platform actors named in bundles), 17 (every row joined to a COMPARE-01 record), 18 (SEO grammar deferred at E-ds-01/02), 20 (both INFRA rows carry substitutes). Spot-verified this session (14): sendReminders window, mailTemplates' exact 4, discover payload fields, `orderBy(tenants.name)`, effectiveAmount calc, cancel refundNote, en.json:63 refund copy, closures orphan, customer_stats columns, unread weeklyRevenue, MarketingDeck dead call + localStorage keys, Discover hardcoded English, 7 cron schedules, CSV export with zero callers, staff bio/image columns + fixed roles.
