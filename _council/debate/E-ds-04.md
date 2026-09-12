# Debate — E-ds-04 Map view
**Surface (declared per persona):** A: consumer marketplace | B: not declared per row | C: CM | D: consumer marketplace (paper-level)

## 1 · Product Owner
- Smallest unit: collect lat/lng on settings save ("two-way door, invisible today"); Map UI only after ≥50 listed Addis tenants carry coords.
- **DEFER** — G2-killed as a build-now (FSD-003 S-12: no coordinates exist anywhere; OSM redesign parked). "Collecting the seed field is cheap; rendering an empty map is a demo-killer."
- Cites FSD-003 S-12; `public.ts:56-209` no coords verified. LOW (KB GAP 2: venue pages unobserved).

## 2 · Engineering Lead
- **L, DATA-BLOCKED**: zero lat/lng anywhere (schema.ts:3-22; public.ts:56-209); needs coordinate capture + a geocoder resolving Addis subcities — COMPARE-00 market-fit flags street-address geocoding as an imported assumption.
- Reclassify: **NOT-feasible-without-address/coordinate collection**. Crons: none. HIGH (that it's not S).

## 3 · Council
- **RED (rails)**: G2-dead per LEDGER.md:65 — no coordinates collected; no geocoding rail. Rule-20 substitute: sub-city zone browsing + "near Bole" textual badges.
- Named trade-off: no proximity sort; consumers trade map-scan for zone-scan, acceptable where sub-city is the mental map. Collision: none. HIGH.

## 4 · Support/CRM
- Impact: none-in-addis-today. frequency: DECISION-recorded (G2 dead-until-redesigned, LEDGER.md:65).
- Workaround: taxi-and-landmark culture — "come from Bole Medhanialem, second gate" beats a pin; building a map before an address model is parity theater. Sell the per-site map block that already ships (Gap.md:19). Day-1: **n**.

## 5 · Challenge round
**A → C:** A keeps a coordinate seed-field as cheap and two-way; C rules the row RED (rails) with a substitute that deliberately excludes coordinates, gazetteer G2-parked (A: FSD-003 S-12 "seed field" | C: LEDGER.md:65, substitute = zone badges). B supports C: a geocoder is an imported assumption (schema.ts:3-22, COMPARE-00).

## 6 · Chair log
- **Agreed:** no map build now; G2 kill on the map itself is uncontested; Rule-20 substitute exists (C's zone badges; A's seed field is a different kind of substitute).
- **Contested:**
  - Seed data: A wants lat/lng collected on settings save now; C bars lat/lon collection and B reclassifies NOT-feasible-without-X.
  - Effort class: A treats the seed as cheap-S vs B **L, DATA-BLOCKED** — different readings of the same missing-column fact (schema.ts:3-22 / public.ts:56-209).
- **Escalation:** None — G2 is a recorded kill decision, no protected item reopened.
- **Closure:** CONTESTED-DEFER
