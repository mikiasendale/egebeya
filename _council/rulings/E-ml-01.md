ID: E-ml-01 (+ Fresha pair F-sa-220)
Name: Multiple business locations
Surface: merchant SaaS + platform (named pair; A's "platform-scale" phrasing vs C's MS+PL split — same family, no hard blend)
Category: multi-location
Class: GAP (COMPARE-01:114, :316; corrected per session to a planning target by CEO ruling 10)
Fresha behaviour: One merchant operates multiple locations under one account; locations carry their own staff, calendar, and channels. (OBSERVED — `/pricing` row 'Multiple business locations', fb-scheduling, for-business Manage frame.)
Egebeya current state: One tenant = one location: `tenants.slug` unique, Host/X-Tenant-Slug resolution, 41 tables keyed tenant_id, disk layout `storage/pro-builds/{tenantId}`, Pro priced per-tenant (src/db/schema.ts:3-22; ARCHITECTURE.md:92-100; billing.ts).
Blockers: infra (Turso single-writer ceiling — the ruling-12 Phase 2 Postgres decision is load-bearing for this row, CEO §Impacts); one-way door (design doc required before any code, feature-selection §6); none legal, none protected.
Debate summary: All four positions DEFERRED the build: A on load-bearing tenancy law, B on XL cost ("one-way door of the year"), C RED-needs-CEO-ruling naming the schema-migration fork (parent-above-tenant vs intra-tenant scope), D none-in-addis-today. The Chair escalated the strategy question (C §4 ask 9). CEO ruling 10 answered it: multi-location is THE strategy — locations as first-class entities — converting DEFER into a planning target, and coupling the row to the this-quarter Postgres decision (ruling 12 Phase 2). The evidence-bar question (D's "not the buyer") is moot: CP4.1 amendment 3 declined the no-ask-no-build rule.
Council ruling: BUILD NEXT — planning half only (CEO ruling 10 converts the council DEFER): locations design doc lands before any code; no build until the doc is approved.
Closure method (if BUILD): Scope = design doc, not software: locations entity shape (parent-of-tenant vs intra-tenant scope), tenant-resolution change, storage-path and per-tenant-billing questions answered. Entity changes: none until the doc ships; every schema-adding migration in the cluster's first wave must be location-aware in its first migration to avoid a re-shape (CEO §Impacts, naming E-tp-04 per-member pricing and E-pm-* ledger rows). Endpoint changes: none. UI changes: none. Test additions: none for the doc; money-gate additions deferred to the rows §Impacts touches. Required FSD record before implementation (ceo-rulings §Required decision records #2: multi-location strategy + the strategy reversal it implies for every DEFER in the locations cluster).
Substitute method (if any): honest interim stands per the debate — multi-shop owners run N accounts today (C/D).
Owner: Council
Effort: L
Money path: NO (planning row itself; the Pro-per-location billing question is recorded in the doc, not charged)
Protected decision referenced (if any): inline eq(tenantId) law (AGENTS.md:29-30) is the collision surface any location shape must preserve, not reopen.
EGE-ADVANTAGE collision (if any): none named.
Merchant evidence: UNDOCUMENTED (D: "none-in-addis-today", founding cohort single-chair by design); the strategy ruling supersedes the evidence bar per CP4.1 amendment 3.
Confidence: HIGH on direction (CEO ruling 10 is final authority); LOW on shape (no design doc yet)
CEO ruling (final): Ruling 10 — multi-location is THE strategy; E-ml-01/02/03 become planning targets; demands the ruling-12 Phase 2 Postgres decision.
