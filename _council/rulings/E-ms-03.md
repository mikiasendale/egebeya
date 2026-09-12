ID: E-ms-03 (+ Fresha pair F-sa-92)
Name: Blocked time & closures (write path)
Surface: merchant SaaS (A/C/D declared; B's paper-wide gap noted — no clash among declared)
Category: merchant-scheduling
Class: PARTIAL (COMPARE-01:104, :309)
Fresha behaviour: Merchants block ad-hoc time, breaks, and closures so they are never bookable. (OBSERVED — fb-scheduling; hc/101628, hc/18.)
Egebeya current state: Closures are enforced on every public availability read (src/api/public.ts:508-522, :651-662; schema.ts:110-115) but the table is write-orphaned — only seed/tests/accountDeletion ever write a row; no endpoint or UI can create one.
Blockers: none — strongest code-proven consensus in the band; the table and read-enforcement are fully live.
Debate summary: Unanimous BUILD NOW — the "strongest cross-position consensus in this band" (Chair): A promoted T7.6 into Band 1 over FSD-002's below-the-cut ordering (S-effort, two-way, and the write-orphan is "a correctness embarrassment"); B re-priced COMPARE-04's M down to S ("pure dead-surface resurrection"); C GREEN; D called it "my #1 dead surface by merchant cost" — a Meskel closure or funeral afternoon is unmarkable, so the shop stays bookable while shut, and the workaround is the owner phoning their own booking page. T7.6 scored 22/24 (LEDGER:18).
Council ruling: BUILD NOW (T7.6 closures writer).
Closure method (if BUILD): Scope = POST/DELETE /api/tenant/closures + a closures editor in Settings; optional Ge'ez holiday suggestions (A's smallest unit). Entity changes: none (tenant_closures exists; read enforcement exists). Endpoint changes: add closures CRUD under the tenant routes, inline eq(tenantId). UI changes: closures editor with date pickers in both scripts; am/en strings same commit. Test additions: a merchant-written closure block is invisible to public availability on the enforced read paths (public.ts:508-522, :651-662); C's attached duty — once closures are real, update the fill-rate denominator honesty note (server/lib/analytics.ts:252-255) so the quiet-hours caveat never drifts silently.
Substitute method (if any): none needed — this row IS the fix for the lying-signal substitutes (it unblocks E-ds-07 "open today" honesty and E-bc-03 "full-day" truth).
Owner: Engineering Lead
Effort: S (B's audit flips COMPARE-04's M: table + enforcement live, only writer + UI missing)
Money path: NO
Protected decision referenced (if any): none (AGENTS.md:21 respected — queue untouched).
EGE-ADVANTAGE collision (if any): NO (C/A); Ge'ez-holiday suggestions use the protected Ethiopian-calendar core (E-ms-06) as a convenience, not a copy of Fresha.
Merchant evidence: OBSERVED-workaround, strongest in the file (D #1 dead surface; day-1 y); frequency class OBSERVED (holiday closures are a real calendar event for every tenant — Enkutatash).
Confidence: HIGH
CEO ruling (final): Not escalated — council ruling stands.
