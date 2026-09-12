ID: E-ds-01 (+ Fresha pair F-mp-01)
Name: Category browsing
Surface: consumer marketplace
Category: discovery-search
Class: PARTIAL (COMPARE-01 F-mp-01: Egebeya has one flat directory with fixed category values; no /lp/en/bt/{category} hubs)
Fresha behaviour: Category hubs on 15 verticals via the bt/{category} landing-page grammar (features.json; index.html nav — OBSERVED on public Fresha pages; COMPARE-01 F-mp-01).
Egebeya current state: Flat directory, 4 fixed category values; filter exists at src/api/public.ts:102-104, Discover.tsx:16; template map server/lib/siteTemplates.ts:39.
Blockers: none
Debate summary: A pushed the enum-widening + filter row as NEXT and explicitly excluded hubs (Rule 18 grammar is "a separate season's build"). B priced M only because 14 hub pages of real en+am copy would ship, or they are doorway pages. D called the 15-spine "Fresha-SEO-shaped theater" with zero measured search_intent traffic and the directory not the funnel's bottleneck (FSD-002:82). Chair resolved scope and value for A/D against B's hub-priced M, and settled C's blended "MS+CM" surface label as consumer marketplace only.
Council ruling: BUILD NEXT (Band 2)
Closure method (if BUILD): Scope: widen tenants.category to the CEO-confirmed 14 (docs/Gap.md:7) + one Discover filter row; vertical landing hubs explicitly deferred. Entity changes: none (enum values on existing tenants.category). Endpoint changes: /api/public/discover accepts the 14 values on the existing filter (public.ts:102-104). UI changes: Discover.tsx filter row; all 14 strings in am.json AND en.json same commit (AGENTS.md:36). Test additions: server/tests/discover.test.ts — new cases "14-value category filter returns correct tenants" and "unknown/legacy category yields empty, not error".
Substitute method (if SUBSTITUTE/DEFER-with-substitute): —
Owner: Product Owner (Chair: value column sides with A/D over B's hub-copy pricing)
Effort: S (the enum + filter alone; B's M stood only while hubs were in scope)
Money path: NO
Protected decision referenced (if any): CEO Checkpoint-1 scoping — the 14-category list (Gap.md:7) is confirmed; debate was how, not whether. Hubs, when built, must honor the dark-site gate (EGE-ADV #11, public.ts:339-398).
EGE-ADVANTAGE collision (if any): None — do NOT replicate Fresha's 1,141-page category×geo machine (SEO-GAP-10 trust penalty, C §3).
Merchant evidence: UNDOCUMENTED — no production search_intent traffic (FSD-002:83-84); workaround: owners share one Telegram link, four fixed categories cover Addis reality; Day-1: n.
Confidence: MEDIUM
CEO ruling (final): Not escalated — council ruling stands (Checkpoint-1 scoping already confirmed by the CEO).
