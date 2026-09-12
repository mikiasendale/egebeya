# Debate — E-an-04 Did-not-show / thank-you / tip / waitlist / slot-available (GAP, Gap.md:266-268)
**Surface:** A: platform (messaging engine) | B: none declared per row | C: MS | D: merchant SaaS. Flag: platform-vs-MS tag differs; substance unaffected.

## 1 · Product Owner
T7.4 ships the **no-show + thank-you half NOW** (both event-driven at existing transitions). Tip/waitlist/slot messages are **bundled into their parent features** (E-pm-08 / E-bc-03) rather than half-built — Rule 13: the catalog is a set, shipped in dependency order, not Fresha's order. **HIGH**.

## 2 · Engineering Lead
**S/M.** No-show message on merchant flip (bookings.ts:81); thank-you from appointment_services numbers (schema.ts:150-157); **"waitlist-joined/slot-available are E-bc-03 children; tip-thanks is E-pm-08's child — don't promise those two without their parents."** Crons: none. **HIGH** on the split.

## 3 · Council
**AMBER (split)** | MS. Ship now: did-not-show (behavioural tone, **no fee language**), thank-you-for-visiting (pairs with E-mg-05 when reviews arrive), **slot-available (pairs with E-bc-03's reclaimed-slot shape)**. Defer: thank-you-for-tipping (upstream E-pm-08 ruling), waitlist-joined (upstream E-bc-03). Rule 13: build the template registry + trigger table once, as a set. Collision: NO. **HIGH**.

## 4 · Support/CRM
Impact: **MED-HIGH.** No template/trigger/channel for the whole set (Gap.md:268). T7.4 ranks 22/24 with caveat: ship the three transactional first; "a noisy thank-you on an SMS market damages the channel that carries reminders" (FSD-002:169-171). **"Slot-available is waitlist-adjacent — do NOT build it before E-bc-03 exists (an offer for a queue nobody joined)."** frequency: OBSERVED-workaround (four templates total). Day-1: y for no-show notice, n for thank-you.

## 5 · Challenge round
**A/B/D → C:** C lists slot-available under "ship now" (paired to E-bc-03's shape) while A/B/D gate it strictly behind E-bc-03, which is itself NEXT-cycle-back/LATER (A) awaiting a tenant request (LEDGER:28).
**A/B → Fresha's order:** the catalog is one set shipped in dependency order (Rule 13), not five tickets.

## 6 · Chair log
- **Agreed:** no-show + thank-you ship now with T7.4; tip-thanks and waitlist-joined bundled into E-pm-08/E-bc-03; no fee language in the no-show tone; thank-you kept quiet on an SMS market.
- **Contested:**
  - slot-available: "ship now, paired with E-bc-03's shape" (C) vs blocked until E-bc-03 exists (A, B, D).
- **Escalation:** None.
- **Closure state:** CONTESTED-DEFER
