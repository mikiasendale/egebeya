ID: E-ms-02 (+ Fresha pair F-sa-91)
Name: Shift scheduling / rosters
Surface: merchant SaaS (A/C/D declared; B's paper-wide gap noted — no clash among declared)
Category: merchant-scheduling
Class: GAP (COMPARE-01:103, :308)
Fresha behaviour: Merchants publish shift rosters and give staff a schedule surface; staff see their own shifts. (OBSERVED — fb-scheduling; hc/252.)
Egebeya current state: Per-weekday availability windows the owner edits; nothing published to staff, no roster view (src/api/tenant.ts:373-404; schema.ts:93-99; StaffRedirect.tsx exists as a staff-login surface).
Blockers: none (sequenced inside the shared-calendar bundle; B's dated-shift entity was rejected by the Chair in favor of read-scoping)
Debate summary: A placed the staff-week half in the same bundle as E-ms-01; B would add dated shift rows (M); C insisted the honest build is read-scoping the existing per-weekday rows plus appointments through the role projection (`bookings.ts:23-58`), not a new entity; D rated the row LOW alone but HIGH as "E-ai-03's front door" — "your staff stop calling you to ask if they're on" — with today's workaround a Telegram message ("ቅዳሜ 8-5") that leaves no record. The Chair resolved the entity dispute FOR C: staff login sees their own week on the shared grid via role projection; trade-off accepted: no shift-swap/approval; publishing rosters to non-login staff DEFERs. This is the CEO's redefinition of E-ai-03 (Gap.md:354) in its staff-facing half.
Council ruling: BUILD NEXT — staff half of the shared-calendar bundle (Chair), on this row's own grid dependency: it rides the E-ms-01 build.
Closure method (if BUILD): Scope = staff-login view of their own week on the shared grid; no new entity, no dated-shift table, no roster PDF publishing (DEFER). Entity changes: none — read of existing staff_availability + appointments; if any column is added it rides location-aware in its first migration (ruling-10 §Impacts). Endpoint changes: staff-scoped selection through the existing role projection (bookings.ts:23-58), inline eq(tenantId) on every new query (AGENTS law), staff see only their own bookings. UI changes: week view for staff logins; both locales; strings in BOTH am.json and en.json. Test additions: staff-scope assertion (a staff login never sees another staff member's week); tenant-scope audit.
Substitute method (if any): until the bundle lands, the OBSERVED workaround stands — owner messages shifts on Telegram; no record, no confirmation (Gap.md:184).
Owner: Engineering Lead
Effort: M (B's price; the ruled read-scoping shape is cheaper than B's dated-shift variant — deviation recorded)
Money path: NO (C's condition enforced: no compensation surfaces ride along — E-tp-04 boundary; pay-runs struck, E-pm-20)
Protected decision referenced (if any): E-tp-04 / struck E-pm-20 boundary named as a build constraint (no pay surfaces attach).
EGE-ADVANTAGE collision (if any): none (C/A); sits beside the queue stack per AGENTS.md:21.
Merchant evidence: D impact LOW alone / HIGH as E-ai-03 front door; frequency UNDOCUMENTED ask; workaround OBSERVED (Telegram shift messages, no record).
Confidence: HIGH
CEO ruling (final): Not escalated — council ruling stands (Chair resolved entity dispute FOR C; the row is the CEO's Gap.md:354 redefinition, staff half).
