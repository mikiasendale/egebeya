ID: E-tp-03 (+ Fresha pair F-sa-202)
Name: Timesheets & clock in/out
Surface: merchant SaaS
Category: team-permissions
Class: GAP
Fresha behaviour: Staff clock in/out; merchants track actual hours worked. KB: COMPARE-01:182 (hc/101636), docs/Gap.md:303-306.
Egebeya current state: Planned availability only (staff_availability, schema.ts:93-99 per-weekday); no timesheet entity anywhere in src/db/schema.ts.
Blockers: protected (adjacent to the CEO-struck pay-runs scope E-pm-20) + legal (labour-law evidentiary role of ET timesheets unresearched — C counsel flag)
Debate summary: A deferred: no entity exists and the row is "payroll-adjacent, near the struck E-pm-20 boundary." B priced a schedulable M — a clock_events table + in/out endpoints + staff view riding the E-ms-02 view, noting the build itself must exist to hold A's adjacency worry off. C gave AMBER-with-conditions: employment records need a PDPL register entry, schedule-management-only purpose, and clock data must NOT silently become wage-computation input (the E-tp-04 boundary, C §4-11) nor leak into platform metrics. D rated impact LOW: "staff live above the shop; clocking in is walking up the stairs"; §3 What-NOT-to-build list. Chair resolved CONTESTED-DEFER over B's offer: building the hours-capture half invites the compilation half; re-entry only with the E-ml-01 strategy ruling.
Council ruling: DEFER
Closure method (if BUILD): n/a — deferred. Re-entry condition is now ALIVE: CEO ruling 10 locked multi-location as THE strategy (ceo-rulings-cp4.md), which was the Chair's stated re-entry gate. Action: schedule an E-tp-03 re-debate inside the locations design-doc phase (ruling 10's one-way-door doc, ceo-rulings-cp4.md:100-101); any future clock_events schema must carry the no-wage-computation purpose constraint structurally (C), and location attribution per ruling 10.
Substitute method (if any): none named (B's standalone build was the rejected alternative, not a substitute).
Owner: Council (sequencing) / Product Owner (re-debate scheduling)
Effort: M
Money path: NO (and the ruling's core clause is that it must stay NO: clock data must never feed wage computation)
Protected decision referenced (if any): struck E-pm-20 pay-runs (docs/Gap.md:121); E-tp-04 boundary inherited per C §4-11; ruling 10 locations strategy (re-entry key).
EGE-ADVANTAGE collision (if any): NO (C §3).
Merchant evidence: UNDOCUMENTED frequency; none-in-addis-today; workaround = walking up the stairs; notice day 1: n.
Confidence: MEDIUM (C's counsel flag open; the four-way split on deferral-vs-build was the session's most contested DEFER)
CEO ruling (final): DEFER per Chair (payroll adjacency + struck E-pm-20); re-entry rides ruling 10 — and that condition is now satisfied, so E-tp-03 re-debates inside the locations design-doc phase.
