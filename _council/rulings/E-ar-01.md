ID: E-ar-01 (+ Fresha pair F-sa-180)
Name: Reporting & analytics (merchant)
Surface: merchant SaaS
Category: analytics-reporting
Class: PARTIAL
Fresha behaviour: Insights surfaces 7-day revenue, bookings, top services and repeat-customer counts to the owner. KB: COMPARE-01:171 (for-business Manage frame; Insights pricing row), docs/Gap.md:278-281.
Egebeya current state: The endpoint computes everything (tenant.ts:450-546); the dashboard fetches into weeklyRevenue/weeklyDaily and never renders them (src/pages/Dashboard/index.tsx:597-598, 641-650 — verified this session).
Blockers: none
Debate summary: A called it the cheapest row in the file — render-only, zero server change, Band 1 #3 (T7.8). B confirmed S and role rule (staff never see revenue, bookings.ts:23-41). C gave GREEN: "the cheapest honesty win in the 68", conditioned on demo/seed exclusion and am/en labels. D rated impact HIGH (#3 daily grind, owner counts cash in the evening) and required the cash-invisible note on the card face (FSD-002:98-100) or the feature becomes the E-pm-18 complaint. No challenges; CLEARED.
Council ruling: BUILD NOW
Closure method (if BUILD): scope: render the already-fetched 7-day payload (revenue, bookings, top services, repeats) on the owner dashboard; demo/seed exclusion preserved. Entity changes: none. Endpoint changes: none (zero server change). UI changes: analytics card set on Dashboard/index.tsx; staff role never sees revenue (bookings.ts:23-41); cash-invisible caveat note on card face; every new string in BOTH am.json AND en.json (AGENTS.md:36). Test additions: dashboard renders fetched payload (no silent discard); staff-role render hides revenue; i18n parity test (server/tests/i18n.test.ts) for new keys.
Substitute method (if any): none needed.
Owner: Product Owner
Effort: S
Money path: NO (renders existing completed-payment aggregates; touches no charge/webhook/ledger line)
Protected decision referenced (if any): Gap.md:492 — "T7.8 needs no infra change — it's a UI fix" (CEO to-do, confirmed).
EGE-ADVANTAGE collision (if any): NO (C §3).
Merchant evidence: OBSERVED-workaround frequency (computed-but-unrendered, code-proven); workaround = owner counts cash in the evening; notice day 1: yes.
Confidence: HIGH
CEO ruling (final): BUILD NOW — render the fetched-but-unread payload; T7.8; zero server change.
