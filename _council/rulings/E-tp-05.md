ID: E-tp-05 (+ Fresha pair F-sa-205)
Name: Login permissions & member lifecycle
Surface: merchant SaaS
Category: team-permissions
Class: PARTIAL
Fresha behaviour: Merchants invite, archive, suspend and off-board staff with history intact. KB: COMPARE-01:185 (/pricing Team column; hc/113), docs/Gap.md:312-315.
Egebeya current state: Invite + hard delete exist (src/api/tenant.ts:129-260; delete verified at :248 region); users.tokenVersion already exists for force-logout (schema.ts:35, verified); no archive/suspend state on staff.
Blockers: none
Debate summary: A's smallest unit: a staff.status enum (active/suspended/archived) so owners archive instead of DELETE and history survives — NEXT, Band 2 #9 bundled with E-tp-01. B priced S: "DELETE of a staff with appointment history is the current cliff"; tokenVersion makes force-logout one update; "stop hard-deleting." C GREEN-with-conditions: appointment attribution (staffId) must survive archive — history intact is the whole point — and the delete path keeps working. D rated it MED, "the data-loss one": a departing stylist means either losing attribution or paying for a ghost (staff count is plan-gated, tenant.ts:101); the workaround is a disabled thing with a fake name. Chair cleared archive/suspend + token kill with attribution surviving; whether the archive flag must also release the plan slot stayed contested (D's billing angle, outside A/B/C's stated units).
Council ruling: BUILD NEXT
Closure method (if BUILD): scope: staff.status enum (active|suspended|archived); archive-not-delete as the owner default; suspend bumps users.tokenVersion (force-logout). Entity changes: additive staff.status column via guarded plain ADD COLUMN (idempotent; AGENTS.md migration law). Endpoint changes: POST /staff/:id/archive + suspend/resume (or PUT status) in tenant.ts; delete route stays functional; archived staff excluded from booking availability and consumer picker. UI changes: archive/suspend actions on StaffPage; archived rows visibly retired, historical bookings keep their staff name; am/en strings. Test additions: appointment.staffId attribution survives archive and still appears in history/reports; archived staff cannot be booked or appear on the public page; suspend invalidates sessions via tokenVersion; eq(tenantId) on all state writes. Open item carried from the Chair log: whether archive releases the requirePlanLimit('staff') slot (tenant.ts:101) — Product Owner decision inside the build PR, recorded here, not silently resolved.
Substitute method (if any): none.
Owner: Product Owner
Effort: S
Money path: NO (the plan-slot question touches subscription counting but moves no money; flagged as open, not as CAUTION)
Protected decision referenced (if any): plan-gated staff count (tenant.ts:101) — any archive-slot change touches it; no queue/ledger law involved.
EGE-ADVANTAGE collision (if any): NO (C §3).
Merchant evidence: OBSERVED-workaround frequency (delete-only surface, code-proven); workaround = a disabled fake-named staff entry that still costs a plan slot; notice day 1: n — y at first staff exit (INFERRED-from-industry).
Confidence: HIGH (all four GREEN-with-concordance; only the billing-slot extension contested)
CEO ruling (final): APPROVED at CP5. Open item resolved: **archived staff STILL consume the paid plan slot** (requirePlanLimit counts active|suspended|archived; only DELETE frees the seat, tenant.ts:101). Archive-confirmation copy must state this, both locales. See ceo-rulings-cp4.md CP5 ADDENDUM item 2.
