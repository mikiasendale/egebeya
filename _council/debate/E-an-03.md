# Debate — E-an-03 Rescheduled / cancelled notices (GAP, Gap.md:262-265)
**Surface:** A: platform (messaging engine) | B: none declared per row | C: MS | D: merchant SaaS. Flag: same platform-vs-MS blend as E-an-01.

## 1 · Product Owner
Smallest unit: T7.4 — owner told when a consumer reschedules (route verified HIGH at `public.ts:1293` returns JSON, dispatches nothing); consumer told on merchant cancel. **NOW**. Templates verified HIGH: mailTemplates.ts contains exactly bookingCustomer/bookingOwner/reminder/passwordReset. Band 1 step 6. Half of the lifecycle-messages bundle (E-an-03 + E-an-04 no-show/thank-you, A §3). **HIGH**.

## 2 · Engineering Lead
**S.** Verified: both endpoints (public.ts:1267-1291, :1293-1369) update rows and dispatch **zero** notifications today. Templates 4→6 keys ×en/am + notify() hooks; never-throw rule already enforced by the adapter (notifications.ts:186-215). Crons: none. Independently first-weeks-eligible. **HIGH**.

## 3 · Council
**GREEN-with-conditions** | MS. Transitions exist, templates don't (mailTemplates.ts:9-44). Conditions: notify() never throws (AGENTS law); **cancel notice for a paid booking must state the manual refund truth — do not template-write "refund on its way" while E-pm-15 is unresolved (same lie as en.json:63)**. Collision: NO. **HIGH**.

## 4 · Support/CRM
Impact: **HIGH.** Transitions exist; no dedicated message ships to either side (Gap.md:265; mailTemplates.ts exactly four; FSD-002:157-162). Concrete harm: "a consumer reschedules via link and the owner is uninformed — an empty chair that looked full all morning." One notify() per event through the existing adapter, no infra. Consumer-voice add: consumers who reschedule believe the shop knows; it doesn't — lands on the merchant's desk as a no-show argument. frequency: OBSERVED-workaround (silent transitions). Day-1: **y**.

## 5 · Challenge round
**C → A/D:** the cancel-template wording constraint — templates ship NOW only if refund copy states the manual truth while E-pm-15 stands unresolved.
**D → A:** adds consumer-side misread (shop presumed informed); both agree it ships Band 1.

## 6 · Chair log
- **Agreed:** ship now; four templates become six; never-throw preserved; silent-transition pain is code-proven on all sides.
- **Contested:** None (C's refund-copy rule is a condition on the same build, not a divergence).
- **Escalation:** None.
- **Closure state:** CLEARED
