ID: E-pm-18 (+ Fresha pair F-bh-59)
Name: Manual/offline payment types
Surface: merchant SaaS
Category: payments-money
Class: GAP (COMPARE-01 — payments.method column exists, no entry surface)
Fresha behaviour: Recording cash and manual payment types against sales/client tabs (hc/126). KB provenance: OBSERVED.
Egebeya current state: `payments` already carries gateway/method nullable columns nobody writes (src/db/schema.ts:180-181); every payments row is created by a Chapa flow — no manual entry surface among the 134 endpoints (Gap.md:115; egebeya-features.json "trigger: None").
Blockers: none — cleared unanimously at the Chair's stop; the one money answer the register explicitly permits (record)
Debate summary: All four personas favored building; the fight was salience and caveats. D called it the #1 silent merchant pain in the tree — "the merchant runs two books," paper beside the app, day-1 yes; B insisted the settlement-sweep semantics and revenue-aggregate treatment be decided *in writing* inside the same change (the 04:00 sweep would mark cash rows stale forever, settlements.ts); C set the conditions — cash rows visibly excluded from settlement reconciliation, flagged `method='cash'` everywhere downstream, gate metrics never inflated, and a cash row may never complete a pending Chapa payment; A called it the sentence that closes Pro founders. The Chair cleared it as records-only, and it now anchors T7.5.
Council ruling: BUILD NEXT — anchor of T7.5
Closure method (if BUILD): Scope: owner records cash/off-platform completion → `payments` row with gateway=null, status='completed', no gateway call (T7.5(b) shape). Entity changes: none (nullable columns already exist at schema.ts:180-181); location-aware in its first migration per the ruling-10 impact. Endpoint changes: one tenant-side cash-entry route. UI changes: entry surface in the merchant dashboard; `method='cash'` flag carried into revenue aggregate (tenant.ts:450-546) and downstream reports. Decisions REQUIRED IN WRITING (B/C, part of this change): settlement posture — settlementStatus='settled' on entry or excluded from the 04:00 stale sweep (settlements.ts:25-47); and revenue treatment — included-and-labelled or excluded, "not by accident" (T7.5c). Never lets a cash row mark a pending Chapa payment completed; gate metrics/north-star checked for cash inflation (AGENTS.md:24-25). Tests — MONEY: NEW case in server/tests/chain-payments-billing.test.ts: offline row counts/labeled in revenue, settles-at-entry (or is excluded from the stale sweep), and never grants a subscription.
Substitute method (if SUBSTITUTE/DEFER-with-substitute): n/a (BUILD NEXT). Current substitute is precisely the pain: the paper notebook beside the app.
Owner: Engineering Lead
Effort: M (B §3 audit: "M kept, flag")
Money path: YES — CAUTION (RECORDS money; moves none)
Protected decision referenced (if any): none (COMPARE-03 §NOT-in-file: cash recording unprotected); AGENTS.md gate-metric honesty applies to the aggregate decision
EGE-ADVANTAGE collision (if any): none
Merchant evidence: HIGH — "#1 silent merchant pain in the tree"; OBSERVED-workaround, code-proven: paper notebook beside the app (two books); day-1: y (Sunday cash vs Monday numbers).
Confidence: HIGH
CEO ruling (final): Not escalated — council ruling stands (Chair: CLEARED; anchors the T7.5 ledger that rulings 6/7 ride). General precondition: ruling 1.
