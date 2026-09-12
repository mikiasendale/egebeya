# Debate — E-an-01 Appointment reminder lead time (PARTIAL, Gap.md:256-261)
**Surface:** A: platform (messaging engine) | B: none declared per row | C: MS | D: merchant SaaS. **Flag:** surface-discipline disagreement — A files it platform, C/D merchant SaaS (the merchant sets the lead time); Law 7 says never blend.

## 1 · Product Owner
Smallest unit: T7.2 `settings.reminder_lead_minutes`, default 120 = byte-identical behavior for every existing tenant. **NOW** — two-way door, rides the settings blob. Hardcoded 2h–2.5h window verified HIGH (`sendReminders.ts:51-52` read this session). Band 1 step 5. **HIGH**.

## 2 · Engineering Lead
**S** (T7.2). Window hardcoded now+2h..2.5h (sendReminders.ts:51-52) → default 120 = zero behaviour change; settings pattern (tenant.ts:1185-1204). Crons: **R** (the only change; "15-min scan granularity caps resolution — honest"). reminderSent/sentVia semantics untouched. Independently first-weeks-eligible. **HIGH**.

## 3 · Council
**GREEN** | MS. T7.2 shortlist 22 (LEDGER:16). Conditions: `reminderSent` flag idempotency preserved (sendReminders.ts:63,148); merchant-set window must not schedule reminders inside quiet hours; templates in both scripts (EGE-ADV #9, Amharic-authored). Collision: NO. **HIGH**.

## 4 · Support/CRM
Impact: **HIGH — "the cheapest trust win on this board."** Workaround: 2h SMS for a 9am appointment arrives at 7am; for a late booking it lands mid-commute — "nobody adjusts, everybody absorbs" (Gap.md:259; sendReminders.ts:51-52). Honest counter kept: the *ask* is UNDOCUMENTED ("Nobody has asked", FSD-002:150); only the fixed-window *workaround* is OBSERVED in code. Day-1: **y** — a missed reminder gets blamed on the app, not the window.

## 5 · Challenge round
No challenges — unanimous NOW; only the platform-vs-merchant surface tag differs (chair note above).

## 6 · Chair log
- **Agreed:** ship the settings field now; default 120 keeps byte-identical behavior; quiet-hours guard + reminderSent idempotency preserved.
- **Contested:** None (surface tag A vs C/D noted, no substance differs).
- **Escalation:** None.
- **Closure state:** CLEARED
