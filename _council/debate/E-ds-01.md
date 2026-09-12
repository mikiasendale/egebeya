# Debate — E-ds-01 Category browsing
**Surface (declared per persona):** A: consumer marketplace | B: not declared per row | C: MS+CM — ⚠ blends two surfaces, contrary to KB Law 7 | D: consumer marketplace (paper-level)

## 1 · Product Owner
- Smallest unit: widen `tenants.category` from 4 fixed values to the CEO-confirmed 14 (Gap.md:7) + a Discover filter row; vertical landing hubs explicitly out — the 16-template SEO grammar is "a separate season's build" (Rule 18).
- **NEXT** — rides the existing category filter (`src/api/public.ts:103` HIGH, eq(tenants.category) verified); register copy in both locales; no this-cycle urgency.
- Cites COMPARE-01 F-mp-01. Confidence MED.

## 2 · Engineering Lead
- **M**: the 14-category enum itself is S (filter at public.ts:102-104; template map at server/lib/siteTemplates.ts:39); the cost is the vertical landing hubs — "14 pages of real copy (en+am, AGENTS.md:36), not stubs, or they are doorway pages".
- Nothing new schema-wise; crons: none. Dependency: E-ds-06 first so cards have prices. HIGH.

## 3 · Council
- **GREEN-with-conditions** (row tagged MS+CM): CEO-confirmed scoping (Checkpoint 1). Conditions: all 14 strings in am.json AND en.json same commit (AGENTS.md:36, law); hubs must honor the dark-site gate (EGE-ADV #11, public.ts:339-398); category packs ready (server/lib/siteTemplates.ts:39-82).
- Collision: NO. Do NOT replicate Fresha's 1,141-page category×geo machine — doorway pages invite the SEO-GAP-10 trust penalty. HIGH.

## 4 · Support/CRM
- Impact LOW (consumer-side MED only when directory traffic exists). frequency: UNDOCUMENTED — no production search_intent traffic (FSD-002:83-84).
- Workaround: consumers don't browse categories; owners share one Telegram link (ROADMAP §1; FSD-002:82 "the directory is not the funnel's bottleneck"); four fixed categories cover Addis reality. Day-1 notice: **n**.

## 5 · Challenge round
**A → B:** A's smallest unit excludes hubs (Gap.md:7 enum + `public.ts:103`); B prices **M** only because hub copy ships (siteTemplates.ts:39, AGENTS.md:36) — effort assumes scope A removed.
**D → A:** A takes it NEXT; D calls the 15-spine "Fresha-SEO-shaped theater until search_intent rows prove vertical demand" (A: public.ts:103 | D: FSD-002:82, LEDGER T7.13 re-entry).

## 6 · Chair log
- **Agreed:** 14-category widening is CEO-confirmed scoping; hubs are not part of the first cut; both locales same commit.
- **Contested:**
  - Scope/effort: A = enum+filter, NEXT (public.ts:103) vs B = **M** driven by hub copy (siteTemplates.ts:39).
  - Urgency: D (LOW, UNDOCUMENTED, theater-without-traffic) vs A (NEXT).
  - Surface: C's row blends "MS+CM" against Rule 1; A/D say consumer marketplace.
- **Escalation:** None — no money; scoping already ruled by the CEO.
- **Closure:** CONTESTED-DEFER
