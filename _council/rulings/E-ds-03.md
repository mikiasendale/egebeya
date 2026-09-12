ID: E-ds-03 (+ Fresha pair F-mp-03)
Name: Neighbourhood scoping
Surface: consumer marketplace
Category: discovery-search
Class: PARTIAL (COMPARE-01 F-mp-03: city present as free-text; district/neighbourhood level absent)
Fresha behaviour: City + area scoping on the bt-city/bt-area exemplars (features.json; COMPARE-01 F-mp-03 — OBSERVED on public pages).
Egebeya current state: City matched as `json_extract(settings,'$.city') LIKE` substring (src/api/public.ts:106-111); no district field, no capture path (Discover.tsx:133-143).
Blockers: none (design-doc dependency: the locations schema per CEO ruling 10)
Debate summary: A DEFERred on "no consumer demand signal" and planned to collect coordinates inside E-ds-04's unit. D objected with an OBSERVED-workaround on the same lines: "Addis" vs "አዲስ አበባ" vs "Addis Ababa" silently split the directory today and typing "Bole" returns nothing. B priced structured district + per-city enum + capture path at M with backfill friction. C barred lat/lon collection from this row (PDPL data-minimization; gazetteer G2-parked) and endorsed structured sub-city text zones as the right shape. Chair SPLIT: field on save = BUILD, consumer filter = DEFER.
Council ruling: BUILD NEXT
Closure method (if BUILD): Scope: structured `settings.district` (seeded per-city sub-city enum) collected on merchant settings save; consumer-facing district filter DEFERred with E-ds-02. Per CEO ruling 10's ripple, the district (and E-ds-04's optional coordinates) are location attributes of the locations design-doc — this build must not invent a parallel geo schema. Entity changes: settings-blob keys only, no new columns. Endpoint changes: GET/PUT /api/tenant/settings (tenant.ts:1185-1204 pattern); discover city matcher unchanged until the filter re-entry. UI changes: merchant settings district field only; no consumer UI. Test additions: server/tests/chain-settings-hours.test.ts — new "district save round-trips; legacy free-text city still matches" case; server/tests/discover.test.ts — "district does not change current results while filter is deferred".
Substitute method (if SUBSTITUTE/DEFER-with-substitute): —
Owner: Product Owner (Chair: A's "collect the data, ship the UI later" survives D's objection and costs nothing on its own diff)
Effort: M (B §1; row not re-priced in §3 audit)
Money path: NO
Protected decision referenced (if any): C's PDPL data-minimization condition (no lat/lon from consumers); gazetteer redesign stays G2-parked (LEDGER.md:65).
EGE-ADVANTAGE collision (if any): None.
Merchant evidence: OBSERVED-workaround — free-text column + LIKE query; merchants write the city exactly as agents dictate; Day-1: n merchants / y out-of-town caller.
Confidence: MEDIUM
CEO ruling (final): Ruling 10 — multi-location is THE strategy; coordinates/district become location attributes inside the locations design-doc (cp4 §Impacts), which this closure method cites as a dependency.
