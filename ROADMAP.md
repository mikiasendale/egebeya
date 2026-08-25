# EGEBEYA — Council Roadmap v1.0

> Produced by an adversarial strategy council: **CEO** (capital, sequencing, survival),
> **CTO** (architecture, feasibility), **CMO/Growth** (demand, channels, unit economics),
> **CPO** (experience, product shape). Two rounds: independent positions, then
> cross-critique with forced concessions. Chair's rulings applied where the council split.
>
> Grounded in the actual repo state as of Aug 2026 (see ARCHITECTURE.md).

---

## 0. The Verdict on the Founder Manifesto

| Manifesto item | Ruling | Why |
|---|---|---|
| Telebirr cashback to customer wallets | **DEAD, permanently** | (1) NBE payment-institution licensing wall — non-banks cannot push into wallets; Chapa disbursement APIs are not GA. (2) Unit math: at ~300 ETB avg ticket, 2–5% cashback costs 6–15 ETB against ~1–3 ETB platform take and ~5 ETB processor fee = **−2 to −17 ETB per transaction**, pre-revenue. Replaced by merchant-funded points-as-discount (price adjustment, not money movement). |
| Queue-Buster pass | **PROMOTED to lead consumer hook** | Highest behavioral pull, near-zero build cost. It is a UX norm + queue console, not infrastructure. |
| Digital punch card | **CONDITIONAL, days 61–90** | Ships keyed on normalized phone, merchant-scoped, zero auth — only if Telegram deep-link identity proves out in Month 2 AND north-star metric ≥0.7 by Day 60. Otherwise post-Gate 2. |
| Phase 4 marketplace (products/cart/stock-holding/couriers/spatial UI) | **PARKED until Gate 3** | Second company wearing our domain name. Stock-holding = design doc only (2 evenings). Reopens only after Gate 3 **and** unprompted pull from ≥10 tenants ("can you also sell my products?"). |
| Dispatch API | **PARKED; interface reserved** | ZayRide et al. have sales decks, not public APIs. When opened: `CourierAdapter` interface + manual dispatch v1 (dropdown + Telegram bot to courier). Ethiopian addressing defeats geocoders — plan is OSM gazetteer → trigram match → zone fee table, zero API cost. |
| Puck↔HTML transpiler | **KILLED** | Lossless round-trip does not exist (browser DOM normalization destroys anchor fidelity). Replaced by: one versioned, server-validated **block JSON schema** + category **block templates**. One representation = mode-switching can't lose work. |
| Data moat / yield management | **REFRAMED, partially built already** | Intent aggregation + Market Pulse exist in-repo. Dynamic *up*-pricing fails against informal street undercutting → ship "**quiet-hours**" fill-idle-slot discount flags instead. Market Pulse = internal sales ammunition, not consumer product. |
| Egebeya Learn / Dates verticals | **PARKED past Gate 3** | Booking core ports trivially; Dates needs seat-inventory semantics not yet designed. One vertical with paying density beats two half-verticals. |
| "Economic sensor" investor pitch | **RETIRE until the sensor reads** | Sell what exists: *"Booksy + Shopify for Ethiopia's urban service businesses, built for one Android phone."* Sensor story becomes true at ~100 paying tenants. |
| Instant Empire onboarding | **SHIPPED AS SKELETON; cinema cut** | 8 taps / 3 screens survives. The 3-second cinematic dies — replaced by honest staged progress (skeleton → sections materialize → "your site exists"). A loader lying about provisioning speed is the exact 2015-SaaS pattern we're killing. Mandatory hours-confirmation before publish (site stays dark until confirmed) — broken bookings poison a one-reputation market. |
| Velvet rope | **MECHANISM CORRECTED** | Locked-and-labeled inside More tab (lock chip + one-line value prop), not hidden. Hidden features never upsell. Developer-mode toggle = density setting, not access model. |
| 500 ETB Pro pricing | **LADDER** | 500 ETB founding rate locked 12 mo (first 25 tenants, annual-prepay eligible) → 750 list for new tenants after Gate 2 proves two cohorts at churn ≤5% → hybrid arm (~400 base + 2%/booking) trialed M9 to test local pay-from-sales mental model. |

---

## 1. The Compact (the deal the council signed)

**Shared north-star metric:** **Weekly confirmed bookings per billing-active tenant — ≥1.0 by Day 90.**
Guardrail: gross monthly logo churn ≤5%, measured from Month 4. Every council review opens with this number. No interpretation rights.

**Engineering commits (90 days):**
1. **Chapa recurring subscription billing GA by Day 21** — invoicing, idempotent webhooks (exist), dunning-lite, receipts clean enough for PLC books. Definition of done: *a stranger pays real money end-to-end with no founder touching a database.*
2. Instant Empire backend: block JSON schema + validator, category-prefilled defaults, low-end-safe public renderer (Wks 2–5).
3. `NotificationAdapter`: Telegram bot primary, in-app fallback, opt-in-rate + delivery-success instrumentation (Wks 5–6). SMS = vendor chosen **on paper Day 7**, integrated only if channel data demands it.
4. Loyalty-lite punch-card endpoint: phone-keyed, no auth (Wks 6–8; launch gated per ruling above).
5. Activation analytics: server-side activation events (site live + first booking — agents are paid against code-defined events, not slides), funnel dashboard (Wk 8–9).
Ops floor folded in: off-host backups by Day 28. Puck version frozen; Day-60 review of whether the engine earns its weight.

**Growth commits (90 days):** LOI pre-sales from Day 1 (billed automatically when rails go live). Street-agent program live in Bole + Piassa within 3 weeks: ≤250 ETB per **activated** merchant (billing-active + first confirmed booking), 30k ETB hard cap. Founding-cohort pricing live. Targets: first paying tenant by Day 35, ≥10 paying by Day 90, 100% collected through rails. TikTok = transformation content (before/after, street-interview price formats), 2/wk batched monthly, instrumented cost-per-activated-merchant (cut to 2/mo if >400 ETB-equivalent). Zero paid consumer acquisition for 90 days.

**Product commits (90 days):** M1 (0–30): Instant Empire skeleton, token color/type core locked Wk 2, Amharic microcopy glossary enforced, destructive-action undo snackbars. M2 (31–60): nav 6→4+FAB, **Merchant Home IS the queue** (card stack, one green advance tap per customer; acceptance: *a barber clears his morning queue with one tap per customer*), stamped receipt ticket w/ queue position + dual Ge'ez/Gregorian dates, SetupWizard demoted to pre-filled defaults + progressive checklist. M3 (61–90): punch-card ring, block template gallery per category, velvet rope locked-but-labeled, motion/perf pass (kill backdrop-blur below deviceMemory 2). Acceptance M1: *a salon owner shares her site to Telegram within 5 minutes of signup.*

---

## 2. The Gates (evidence or death)

| Gate | Deadline | Pass criteria | On miss |
|---|---|---|---|
| **G0 — Rails** | Day 21 (hard) | Subscription billing collecting via Chapa in production | Every downstream gate slides 1:1. No compression, no heroics. |
| **G1 — First revenue** | Day 90 | ≥10 paying tenants (strict: invoice generated + payment **settled through Chapa** + receipt issued — DB flag flips count for nothing); north-star ≥1.0 | Freeze discretionary spend, 14-day diagnosis, kill/pivot call |
| **G2 — Repeatable** | Month 6 | ≥50 paying; ≥35k ETB collected MRR (collected ≠ invoiced — Chapa settles T+2/T+3); churn ≤5%; ≥300 bookings/mo; ≥25% digitally paid | No new fronts; raise does not open |
| **G3 — Channel** | Month 12 | Base case 140–160 paying, ~70k ETB MRR, ≥40% of month-1 cohort alive at month 4, ONE repeatable non-founder acquisition channel with CAC payback <3 months (250 paying = upside case, not gate) | Marketplace stays shelved indefinitely; re-based honestly |

**Standing kill criteria:**
- Any consumer incentive pilot: budget-capped 20k ETB / 60 days; kill unless repeat-booking lift ≥15 pts over baseline.
- Core business: <30 paying at M6 despite systematic effort, or churn >10%/mo for 3 consecutive months → stop building, 30-day diagnosis, reposition or wind down honestly. No zombie mode.

---

## 3. The 90-Day Plan (weeks 1–13)

Founder ≈ 45 hrs/wk. House rule: nothing enters a sprint that doesn't touch **billing, activation, or north-star instrumentation**.

| Weeks | Engineering | Growth | Product |
|---|---|---|---|
| 1–2 | Billing state machine starts; SMS paper-decision Day 7; token core locked | Recruit/train 6 agents (Bole+Piassa); LOI pre-sales begin (~28h/wk founder selling); seed 100 listings (60/40 split) | Instant Empire skeleton build; glossary authored |
| 3–4 | **Billing GA (Day 21)**; ops floor/backups (Day 28) | Bole saturation walks (~26h/wk closing); agent QA | Share hero + checklist; hours-confirmation gate |
| 5–6 | NotificationAdapter (Telegram primary + metrics); magic-link login minimal | Agent activation visits; TikTok batch #1 | Receipt ticket v1; nav 4+FAB; SetupWizard demotion |
| 7–8 | Loyalty-lite endpoint; activation analytics + attribution | Piassa wave; booking audits w/ charter cohort; referral asks | Queue console (Merchant Home IS the queue) |
| 9 | Funnel dashboard; quiet-hours flag (boolean + badge, no engine) | Case-study capture; founder-led closes using tenants' own GMV data | Velvet-rope labels; undo pass |
| 10–13 | Punch-card launch **if** Telegram identity proved + NSM ≥0.7; Puck keep-or-kill review | 750-list waitlist campaign; cohort churn review | Block template gallery; motion/perf audit |

**Phase targets:** Day 35 first paying tenant · Day 90 12–15 paying (beats G1) · M6 55–70 paying · M12 ~120–160 paying @ ~700 blended ARPU ≈ **95k ETB MRR**.

**Unit economics guardrail:** agent cost ≈750 ETB per paying tenant (250/activation ÷ ~33% activation→paid) ≈ 1.0-month payback at 750 list, 1.5 at 500. If cost-per-activated-merchant exceeds 400 ETB-equivalent, cut TikTok cadence; if agent yield decays two cycles running, freeze hiring.

---

## 4. Months 4–12 (post-G1 trajectory)

- **M4–6 (G2 push):** quarterly prepay option (~5% off) from M3; consumer identity backfill by phone-hash join (~1wk) once silos prove value; raise prep begins only off Gate-2 evidence; IceAddis/cohort applications submitted once PLC exists + team story = founding cohort data.
- **M9:** hybrid pricing arm trial (~400 base + 2%/booking) to test commission mental model against flat fee. Quiet-hours discounts evaluated on fill-rate delta.
- **M12 (G3):** if passed — grant-plus-angel tranche sized exactly to the gate (not more); Mastercard Foundation routes via implementing partners (MESMER-type programs) requiring registered entity + youth-job metrics: Egebeya applies both as investee and as *channel* whose tenants qualify for MSME credit linkage — that is the honest bank-partnership story. If missed — re-base publicly, fix or stop.

## 5. Corporate Track (parallel, low-touch)

1. **PLC registration months 1–3** (~25k ETB capital requirement): unlocks company-name Chapa merchant account, bank account, grant eligibility. Do NOT add a casual second shareholder; use a small vested stake for a future co-founder. Keep control until traction prices it.
2. Grants sequence: UNDP Youth Co:Lab (two application-days max) → IceAddis cohort (solo-founder penalty noted; apply post-G1 with traction) → Mastercard/UNDP partner programs (needs PLC + documentation + job-creation framing).
3. Investor note (what will be TRUE in 90 days): *"Ninety days ago Egebeya had software and no way to charge anyone. Today recurring billing runs on Chapa in production; ten merchants across two Addis neighborhoods pay us monthly, activated at under 250 birr each, averaging ≥1 confirmed booking/week measured in-product. We are pre-scale, not pre-product."*

## 6. Risk Register (top of board)

1. Founder burnout/bus factor (High×Fatal) — scope cuts in this document ARE the mitigation; recruit co-founder #1 from traction, not loneliness.
2. Willingness-to-pay / informal-business churn (High×High) — founding-rate locks, annual prepay, sell "more customers" not "tools".
3. Distribution failure solo (High×High) — agent network + directory inbound + LOI pre-sales.
4. Telebirr builds native booking/mini-app platform (Med×High) — speed to tenant lock-in via CRM depth; accept partnership over war.
5. ETB devaluation vs USD infra costs (High×Med) — price in ETB, raise annually with inflation, minimize USD spend.
6. Chapa dependency / fee changes (Med×Med-High) — abstract PSP layer; telebirr-direct fallback kept warm; never hold funds custody.

## 7. Design System v1 — Cyber-Addis (locked Week 2)

```css
--ink:          #1A1411;  /* espresso black — text */
--paper:        #F7F1E3;  /* barley cream — surfaces */
--telebirr:     #0FA958;  /* money green — CTAs, money moments */
--amber:        #E8A13D;  /* streaks, punch cards, warnings */
--clay:         #B4552D;  /* terracotta — brand accents */
--signal:       #D64545;  /* errors only */
```
Noto Sans Ethiopic (line-height ≥1.65) + Inter for Latin/digits; body-min 16px, floor 12px; touch targets ≥56px; receipt-world elevation = 1px ink rules, shadows reserved for FAB/sheets/toasts. Motion law: opacity+transform only, ≤250ms, spring `(0.22, 1, 0.36, 1)`; no backdrop-filter below deviceMemory 2. No stock photos of people — duotone category illustrations; owner's real photos are the upgrade prompt.

## 8. Parked (with reopening triggers)

| Item | Trigger to reopen |
|---|---|
| Marketplace (inventory/cart/stock-holding) | Gate 3 passed + ≥10 unprompted tenant requests |
| Dispatch API | Marketplace open; one signed courier agreement or real public API |
| Spatial "walk to the shop" UI | Marketplace open + consumer traffic justifying it |
| Wallet cashback | Never (unless direct Ethio Telecom issuer agreement lands — meeting, not sprint ticket) |
| Puck↔HTML transpiler | Never (JSON single-source solves the actual pain) |
| Egebeya Learn | Post-Gate 3; booking core ports as-is |
| Egebeya Dates | Post-Gate 3 + seat-inventory design accepted |
| Micro-loan underwriting data play | 12 months of identified-consumer behavioral data + licensing counsel |
