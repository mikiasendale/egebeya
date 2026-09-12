ID: E-ds-04 (+ Fresha pair F-mp-04)
Name: Map view
Surface: consumer marketplace
Category: discovery-search
Class: GAP (COMPARE-01 F-mp-04), corrected this session: DATA-BLOCKED / NOT-feasible-without-address-coordinate-collection (B §1 + §6 reclassification)
Fresha behaviour: Map/venue presentation on bt-city venue pages (COMPARE-01 F-mp-04, OBSERVED; caveat KB GAP 2 — venue pages /a/* unobserved, provisional).
Egebeya current state: Zero lat/lng anywhere (src/db/schema.ts:3-22; no geo in src/api/public.ts:56-209); the per-site map block already ships in the builder (src/lib/puck.config.tsx:218-237; Gap.md:19).
Blockers: infra (no coordinate data; no geocoding rail for Addis subcities — imported assumption flagged in COMPARE-00 market-fit)
Debate summary: A wanted an optional lat/lng seed field on settings save now ("two-way door, invisible today"), with Map UI only after ≥50 listed Addis tenants carry coords. B reclassified the row L/DATA-BLOCKED and ruled that effort scoring is meaningless until coordinates exist. C called it RED on rails (G2 kill, LEDGER.md:65) and named a rule-20 substitute of sub-city zone browsing + textual "near Bole" badges. D defended taxi-and-landmark culture: "a pin beats nothing; building a map before an address model is parity theater." Chair refused the UI, approved only the optional coordinate field, and adopted the map-block substitute.
Council ruling: SUBSTITUTE
Closure method (if BUILD): —
Substitute method (if SUBSTITUTE/DEFER-with-substitute): Address text plus the already-shipping per-site map block (puck.config.tsx:218-237) stands in for the map view until the locations design-doc lands; the approved optional lat/lng field rides the E-ds-03 settings-save unit as a location attribute of that schema (ruling 10 ripple), with no UI. Named trade-off: no proximity sort — directory orders by the E-mg-05 activity blend when it seeds, not by distance; proximity discovery stays impossible until ≥50 listed tenants self-carry coordinates (A's trigger, adopted).
Owner: Engineering Lead (Chair refused the UI on B's L/DATA-BLOCKED finding)
Effort: L for the refused map build (B §1; the substitute itself is already live)
Money path: NO
Protected decision referenced (if any): G2 recorded kill on the gazetteer/map redesign (LEDGER.md:65) — not reopened; C's no-consumer-coordinates PDPL condition.
EGE-ADVANTAGE collision (if any): None.
Merchant evidence: DECISION-recorded — G2 dead-until-redesigned (LEDGER.md:65); workaround: landmark directions ("come from Bole Medhanialem, second gate") + the per-site map block; Day-1: n.
Confidence: HIGH
CEO ruling (final): Ruling 10 — coordinates are re-parented as location attributes of the locations design-doc (cp4 §Impacts); the Chair's UI refusal stands beneath it.
