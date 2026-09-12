ID: E-an-01 (+ Fresha pair F-sa-150)
Name: Appointment reminder lead time
Surface: merchant SaaS (A/C/D consensus; A's "platform messaging engine" section tag noted as the lone flag, no substantive disagreement)
Category: automation-notifications
Class: PARTIAL (COMPARE-01:147)
Fresha behaviour: Pre-appointment reminder whose timing the merchant customizes. (OBSERVED — hc/103992, hc/101299 automated-messages set; rule 13: one system, not 20 tickets.)
Egebeya current state: Reminder cron fires on a hardcoded now+2h..2.5h window (server/cron/sendReminders.ts:51-52, read HIGH this session); reminderSent/sentVia idempotency at :63/:148; the merchant can set nothing.
Blockers: none.
Debate summary: Unanimous BUILD NOW, Chair-logged CLEARED — a textbook two-way-door settings row: A's smallest unit is T7.2's `settings.reminder_lead_minutes` default 120 so existing tenants keep byte-identical behaviour; B prices S riding the settings-blob pattern (tenant.ts:1185-1204) with the honest caveat that the 15-min */15 scan granularity caps resolution; C adds the conditions — reminderSent idempotency preserved, merchant windows must never schedule inside quiet hours, and templates stay in both scripts (EGE-ADV #9, Amharic-authored). D rates it HIGH impact, "the cheapest trust win on this board" — a 2h SMS for a 9am appointment lands at 7am and nobody can adjust — while honestly keeping the counter: the ASK is undocumented (FSD-002:150), the fixed-window workaround is what code proves.
Council ruling: BUILD NOW (T7.2).
Closure method (if BUILD): Scope = one settings field; nothing else. Entity changes: none (settings JSON blob). Endpoint changes: none (existing tenant settings GET/PUT). Cron changes: sendReminders.ts:51-52 reads `settings.reminder_lead_minutes` instead of the hardcoded window; default 120 = zero behaviour change. UI changes: numeric lead-time input on the merchant Settings page, both locales. Test additions: default-120 byte-identical reminder selection; quiet-hours guard (no reminder scheduled inside quiet hours); reminderSent idempotency; i18n parity.
Substitute method (if any): none — reminder ships; timing is the missing half.
Owner: Engineering Lead
Effort: S (B; COMPARE-04 agrees)
Money path: NO
Protected decision referenced (if any): none.
EGE-ADVANTAGE collision (if any): none; #9 honored via bilingual (am/en) reminder templates.
Merchant evidence: workaround OBSERVED (fixed 2h window "nobody adjusts, everybody absorbs", Gap.md:259); ASK UNDOCUMENTED (D's honest counter); day-1 y — a missed reminder gets blamed on the app, not the window.
Confidence: HIGH
CEO ruling (final): Not escalated — council ruling stands.
