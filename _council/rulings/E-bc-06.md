ID: E-bc-06 (+ Fresha pair F-mp-25)
Name: Service sequencing / rooms
Surface: merchant SaaS
Category: booking-core
Class: GAP (COMPARE-01 F-mp-25: no ordered steps; durations sum into one block)
Fresha behaviour: Ordered service steps / treatment rooms with mid-appointment handoff (features.json; help-center hc/74 — OBSERVED at doc level).
Egebeya current state: Multi-service bookings sum durations into one contiguous block (src/api/public.ts:776-779, :798-800, OBSERVED); no resource/room entity; fixed 30-min grid at :571.
Blockers: none (prerequisite chain: T6.4 → E-ms-05 buffers; company-shaped entity model)
Debate summary: No challenges; unanimous defer. A ruled it "company-shaped" — "no Addis salon is losing bookings to missing consult-then-treat enforcement." B priced L: ordered steps break the sum-into-one-block model, need a resources table and an availability-generator rewrite, and a half-built version "silently corrupts the calendar that everything else reads." C's AMBER rested on the same T6.4/expandSeries dependency chain and named the already-live substitute with its trade-off. D noted the single-chair shop does it by hand and would never configure a resource model.
Council ruling: DEFER
Closure method (if BUILD): —
Substitute method (if SUBSTITUTE/DEFER-with-substitute): Multi-service contiguous block is already live (public.ts:798-800, OBSERVED) — it covers the salon "cut-then-colour" job. Named trade-off: no mid-appointment staff handoff. Revisit after E-ms-01/E-ms-05.
Owner: Product Owner (A's DEFER-as-a-ruling, unanimous; C's substitute fact recorded in the ledger)
Effort: L (B §1, HIGH on the letter)
Money path: NO
Protected decision referenced (if any): —
EGE-ADVANTAGE collision (if any): None.
Merchant evidence: UNDOCUMENTED — consult-then-treat matters to med-spas, not the founding cohort; workaround: manual ordering at the chair; Day-1: n.
Confidence: HIGH
CEO ruling (final): Not escalated — council ruling stands.
