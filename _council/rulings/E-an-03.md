ID: E-an-03 (+ Fresha pairs F-sa-152, F-sa-153)
Name: Rescheduled / cancelled notices
Surface: merchant SaaS (A/C/D consensus; A's platform section tag noted, no substance differs)
Category: automation-notifications
Class: GAP (COMPARE-01:149-150)
Fresha behaviour: Both sides notified when an appointment is rescheduled or cancelled — distinct templates in the automated-message catalog. (OBSERVED — hc/103992, hc/101299; rule 13: catalog ships as a set, in dependency order.)
Egebeya current state: The transitions exist but dispatch nothing — consumer reschedule (public.ts:1293-1369) returns JSON and tells the owner nothing; merchant cancel (public.ts:1267-1291) tells the consumer nothing; mailTemplates.ts holds exactly four keys (bookingCustomer/bookingOwner/reminder/passwordReset — verified HIGH).
Blockers: none.
Debate summary: Unanimous BUILD NOW, Chair-logged CLEARED — the silent transitions are code-proven on all sides: B verified both endpoints update rows and fire zero notifications (S effort: four templates become six, ×en/am, notify() hooks on the never-throw adapter, notifications.ts:186-215); C conditioned the build on honesty law — a cancel notice for a paid booking must state the manual-refund truth, no "refund on its way" while E-pm-15 stands (the same lie as en.json:63; CEO ruling 2 fixes that copy); D rates impact HIGH with the concrete harm: "a consumer reschedules via link and the owner is uninformed — an empty chair that looked full all morning," and consumers wrongly assume the shop knows. A sequences it as Band 1 step 6, half of the T7.4 lifecycle bundle.
Council ruling: BUILD NOW (T7.4 reschedule/cancel half).
Closure method (if BUILD): Scope = two template keys (rescheduled, cancelled) ×en/am. Entity changes: none. Endpoint changes: notify() hooks at the two existing transitions (public.ts:1267-1291, :1293-1369) — reschedule notifies owner + consumer with new Ge'ez/Gregorian date; consumer cancel notifies owner; merchant cancel notifies consumer. UI changes: none (message templates only, mailTemplates.ts:9-44). Test additions: exactly one notification_log row per transition with correct template + ref_type='appointment'; channel failure never fails the request (AGENTS.md:22); cancel-copy for paid bookings states the manual refund per ruling 2 (no automatic-refund promise); i18n parity.
Substitute method (if any): none — silent transitions are the defect; this is the cheapest fix in the set.
Owner: Engineering Lead
Effort: S (B; no cron — event-driven at existing transitions)
Money path: NO
Protected decision referenced (if any): none directly; the refund-wording constraint rides ruling 2's manual-refund posture (COMPARE-03 #4 family — no promised money movement).
EGE-ADVANTAGE collision (if any): none; #9 honored — Amharic-authored templates in the same commit (AGENTS.md:36).
Merchant evidence: OBSERVED-workaround (silent transitions — nothing notifies anyone); day-1 y; frequency class OBSERVED (D HIGH).
Confidence: HIGH
CEO ruling (final): Not escalated — council ruling stands (refund-copy condition aligns with ruling 2).
