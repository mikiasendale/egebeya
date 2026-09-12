ID: E-bc-03 (+ Fresha pair F-mp-22)
Name: Waitlist
Surface: consumer marketplace (owner actor secondary)
Category: booking-core
Class: GAP (COMPARE-01 F-mp-22: no waitlist columns; grep-zero repo-wide)
Fresha behaviour: Appointment-shaped waitlist with join + slot-available offers and updates (features.json /for-business/features/scheduling; help-center 259-waitlist, 169-waitlist-updates — OBSERVED at doc level; logged-in app UI is KB GAP 3).
Egebeya current state: No waitlist anywhere (src/db/schema.ts:117-148); the physical line is served by the walk-in queue (server/lib/queue.ts:127-217); expired slots are already reclaimed via cancels_at (src/api/public.ts:942).
Blockers: none (demand gate: LEDGER.md:28 "returns with a tenant request"; consent duty attaches to any future offer SMS)
Debate summary: A's smallest unit was a `slot_waitlist` table + full-day join CTA + first-in-line SMS offer; C forbade importing Fresha's parallel construct because the chair-shaped queue is EGE-ADV #5/#6/#7 and AGENTS.md:21-22 bars touching queue derivation — both cited T7.7 and read it oppositely. B re-priced COMPARE-04's M to L (new entity + claim-token state machine + race-acceptance test) and required the winback-style opt-in gate before any offer SMS. D held that in Addis the waitlist *is* the physical line the queue already serves. Chair DEFERred to Band 3 on C's boundary and adopted C's derived-visibility substitute.
Council ruling: DEFER (Band 3; re-entry on one recorded tenant ask)
Closure method (if BUILD): — (at re-entry: separate `slot_waitlist` table only, queue.ts untouched; B's L re-price and opt-in gate govern; boundary per T7.7 as ledgered)
Substitute method (if SUBSTITUTE/DEFER-with-substitute): Derived reclaimed-slot visibility in the merchant queue console (C's idea — the data already exists via the `cancels_at` sweep at public.ts:942). Named trade-off: consumers get no proactive offer, so the feature earns nothing until demand proves it.
Owner: Council (C's shape boundary settled the contested construct; EGE-ADV #5 honored by all four)
Effort: L (B §3 audit row 10, accepted over COMPARE-04's M)
Money path: NO
Protected decision referenced (if any): EGE-ADV #5/#6/#7 walk-in queue shape; AGENTS.md:21-22 (queue derivation is not refactorable); B's consent-gate requirement (runWinbackAutomations.ts:111, AGENTS.md:26).
EGE-ADVANTAGE collision (if any): YES-if-built-as-Fresha-does-it (C, transcript §3) — avoided by the Chair's boundary: separate table beside queueState only, never a re-cut of the queue.
Merchant evidence: DECISION-recorded — LEDGER.md:28, demand unobserved locally; workaround: take-a-number queue + expired-slot reclaim; agent sentence: "don't — sell the live queue board"; Day-1: n.
Confidence: MEDIUM
CEO ruling (final): Not escalated — council ruling stands.
