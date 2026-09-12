ID: E-ms-01 (+ Fresha pair F-sa-90)
Name: Smart calendar
Surface: merchant SaaS (A/C/D declared; B's paper-wide gap noted — no clash among declared)
Category: merchant-scheduling
Class: PARTIAL (COMPARE-01:102, :307)
Fresha behaviour: A visual calendar grid for merchants with color coding, drag-and-drop, and display settings. (OBSERVED — fb-scheduling; hc/290,16.)
Egebeya current state: Merchant day view is a filtered list plus the queue card stack; no grid, no drag, no color coding (src/pages/Dashboard/Bookings.tsx:36-129; read path server/api/tenantRoute.ts:56 / bookings.ts:43).
Blockers: none (sequenced inside the shared-calendar bundle; grid must sit beside the queue derivation, never replace it)
Debate summary: A/B/C converged on a read-only week grid riding the existing /api/bookings reads — C GREEN-with-conditions (low-end Android fallback to day-list, both locales, conflict-checked drag later), B priced M and named it the shared component for E-bc-08/E-ms-02/E-ai-03′ ("land it once"). D dissented in kind — "don't ship a grid first; the week strip is for staff, the canvas is parity theater." The Chair resolved the CONTESTED-DEFER as C's scope law: v1 is a rendered read-only grid, no drag, no color-config UI. This bundle is literally the CEO's Gap.md:354 redefinition of E-ai-03 ("a shared calendar for the business where staff see their schedule and the owner has everything").
Council ruling: BUILD NEXT — the shared-calendar bundle (Chair; Band 2). This row is the owner-everything half of the bundle.
Closure method (if BUILD): Scope = read-only week grid rendering the existing bookings payload beside the queue card stack (C's D-concern as scope law: no drag, no color-config UI in v1; grid chrome later; E-bc-08's merchant-move rides this same bundle — cross-reference, separate ruling file). Entity changes: none needed to ship the grid; any scheduling-adjacent column the bundle does add must be location-aware in its first migration (CEO ruling-10 §Impacts). Endpoint changes: none (reads GET /api/bookings, bookings.ts:43). UI changes: new calendar view in the merchant dashboard; degrades to the day-list on deviceMemory<2 (COMPARE-02 #10 law); strings in BOTH am.json and en.json (AGENTS.md:36). Test additions: queue derivation untouched regression (AGENTS.md:21 — queue.ts read-only, no refactor); i18n parity test.
Substitute method (if any): none — D's "ship the week first" dissent is preserved as E-ms-02's shape inside the same bundle, not as a substitute for this row.
Owner: Engineering Lead
Effort: M (B; audit governs)
Money path: NO
Protected decision referenced (if any): none; the queue non-refactor (AGENTS.md:21) is law, observed as a constraint.
EGE-ADVANTAGE collision (if any): boundary named — the grid sits BESIDE the walk-in queue card stack (E-bc-12 territory), never replacing queue derivation (A/Chair; rule 8).
Merchant evidence: UNDOCUMENTED ask; OBSERVED workaround = filtered list + queue stack is the current product (D, Bookings.tsx:184-235); D rates impact MED ("parity-theater" dissent recorded), A MED.
Confidence: HIGH
CEO ruling (final): Not escalated — council ruling stands (the Chair's bundle implements the CEO's own Gap.md:354 redefinition; ruling-10 §Impacts attached via the location-aware-column condition).
