ID: E-an-04 (+ Fresha pairs F-sa-154, F-sa-155, F-sa-156, F-sa-157, F-sa-158)
Name: Did-not-show / thank-you / tip / waitlist / slot-available messages
Surface: merchant SaaS (A/C/D consensus; A's platform section tag noted, no substance differs)
Category: automation-notifications
Class: GAP (COMPARE-01:151-155; rule 13: five Fresha records, one set)
Fresha behaviour: Lifecycle messages closing the loop after a no-show (F-sa-154), a visit (F-sa-155), a tip (F-sa-156), a waitlist join (F-sa-157), and a reclaimed slot (F-sa-158). (OBSERVED — hc/103992, hc/101299.)
Egebeya current state: No template, trigger, or channel decision for any of the five (src/db/schema.ts: no reviews/waitlist/tips; mailTemplates.ts holds four keys; Gap.md:268).
Blockers: none for the transactional half; the tip half is blocked behind E-pm-08's parent (ruled, not absent — ruling 4/Spec A), the waitlist/slot halves behind E-bc-03's parent (DEFER, Chair: re-entry on one recorded tenant ask).
Debate summary: Split unanimously except one point the Chair resolved against C: did-not-show (on the merchant's no-show flip, bookings.ts:81 — behavioural tone, NO fee language) and thank-you-for-visiting (from appointment_services numbers, schema.ts:150-157) ship NOW inside T7.4; the T7.4 ticket itself scored 22/24 (LEDGER). A/B/D held (and the Chair ruled) that "a message for a nonexistent mechanic is a lie — the T7.17 principle": tip-thanks is E-pm-08's child and waitlist-joined/slot-available are E-bc-03's children, so C's proposal to ship slot-available now (paired to the queue console's reclaimed-slot substitute) was outvoted (A/B/D majority). D's channel-care: thank-you must stay quiet on an SMS market that carries reminders ("a noisy thank-you damages the channel"; FSD-002:169-171), and "slot-available before a waitlist exists is an offer for a queue nobody joined."
Council ruling: BUILD NOW (no-show + thank-you via T7.4); BUILD NEXT (tip-thanks, when tips ship per CEO ruling 4 / Spec A); DEFER (waitlist-joined + slot-available, bundled into E-bc-03 — cross-reference only, not this row's parents today).
Closure method (if BUILD): Scope = two template keys now: `did_not_show` (behavioural, zero fee language — the monetary half is COMPARE-03 #4 dead) and `thank_you_for_visiting` (carries the booking's own numbers, e.g. "you were with us 47 min"; kept restrained per D's channel-damage warning). Entity changes: none. Endpoint changes: notify() hooks at bookings.ts:81 (no-show flip) and the completed transition (bookings.ts:107-121) on the never-throw adapter. UI changes: none (templates, en+am same commit). Test additions: one notification_log row per trigger; no-fee-language assertion on the did-not-show body; channel failure never fails the request; i18n parity. Rule 13 honored: template registry + trigger table built once as a set; the tip/waitlist/slot keys land only with their parents.
Substitute method (if any): the ruled halves ARE the catalog first installment; the E-bc-03 substitute (derived reclaimed-slot visibility in the merchant queue console) needs no consumer message until demand proves the waitlist (named trade-off: consumers get no proactive offer).
Owner: Engineering Lead
Effort: S/M (B — two templates now, three keys ride their parents)
Money path: NO for the shipped halves; tip-thanks inherits E-pm-08's CAUTION when its parent lands (a thank-you records nothing; the tip itself is Spec A's money surface)
Protected decision referenced (if any): COMPARE-03 #4 family — no fee/deposit language in any template (T7.4 scope law: "no fee to threaten them with").
EGE-ADVANTAGE collision (if any): none; #9 honored — bilingual templates.
Merchant evidence: OBSERVED-workaround (four templates total today); day-1 y for no-show notice, n for thank-you (D); frequency class OBSERVED.
Confidence: HIGH
CEO ruling (final): Not escalated — council ruling stands (tip-thanks half cites ruling 4/Spec A as its parent trigger; nothing independently before the CEO).
