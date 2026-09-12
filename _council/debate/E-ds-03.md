# Debate — E-ds-03 Neighbourhood scoping
**Surface (declared per persona):** A: consumer marketplace | B: not declared per row | C: CM | D: consumer marketplace (paper-level)

## 1 · Product Owner
- Smallest unit: structured `settings.district` on save + district filter; seed the Addis sub-city list.
- **DEFER** — city-as-JSON-substring works today (`public.ts:106-111` verified HIGH); no consumer demand signal yet. Ship its data collection inside E-ds-04's coordinate unit.
- Cites COMPARE-01 F-mp-03. MED.

## 2 · Engineering Lead
- **M**: city is `json_extract(settings,'$.city') LIKE` (public.ts:106-111); new structured district field + per-city enum + capture path — "no existing form collects it, so there is backfill friction".
- Crons: none. Failure if unfixed: substring matching keeps misgrouping "Addis" vs "Addis Ababa". MED.

## 3 · Council
- **AMBER-with-conditions**: structured sub-city text zones are fine; the free-text substring on settings JSON (public.ts:106-111) is the liability to fix.
- Condition: **no lat/lon collection from consumers** (PDPL data-minimization); gazetteer redesign already parked at `EXECUTION_PLAN.md:442` per LEDGER G2. Collision: NO. HIGH.

## 4 · Support/CRM
- Impact MED. frequency: OBSERVED-workaround (free-text column + LIKE query; merchants write the city field exactly as agents dictate).
- Workaround consequence: "Addis Ababa" vs "አዲስ አበባ" vs "Addis" silently split the directory; sub-city text zones are the parked right-shape (LEDGER.md:65, EXECUTION_PLAN.md:442), cheaper than coordinates. Day-1: **n** merchants / **y** out-of-town caller.

## 5 · Challenge round
**D → A:** A defers on "no consumer demand signal" citing public.ts:106-111; D cites the same lines as OBSERVED-workaround and §4: "Bole" typed into the city box returns nothing, "teaching the consumer the directory is empty when it isn't".
**C → A:** A plans to collect coords inside the E-ds-04 unit; C conditions this row "no lat/lon collection" with the gazetteer G2-parked (A: Gap.md/DEFER note | C: EXECUTION_PLAN.md:442, LEDGER G2).

## 6 · Chair log
- **Agreed:** the right shape is structured sub-city text zones; the JSON-substring match is a liability; no map coordinates in this row.
- **Contested:**
  - Urgency: A DEFER (no demand) vs D MED/OBSERVED-workaround (misreads today).
  - Data path: A bundles coordinate collection into E-ds-04; C bars lat/lon collection and parks the gazetteer at G2.
- **Escalation:** None.
- **Closure:** CONTESTED-DEFER
