# Debate — E-cm-07 Block clients from booking

**Surface (declared per persona):** A: merchant SaaS | B: undeclared (per-row) | C: **MS+CM** | D: MS (client-management) — flag: C adds the consumer surface (the blocked party learns); B carries none (Rule 1).

## 1 · Product Owner
Smallest unit: mirror `consumer_blocks` (schema.ts:548, endpoints verified HIGH at trust.ts:95-152) into a tenant→consumer block **checked in the booking POST**. **NEXT, top of band 2** — "small, closes the asymmetry, real owner-safety story." COMPARE-01 F-sa-118. **HIGH**.

## 2 · Engineering Lead
Effort **S**. Mirror `consumer_blocks` reversed (schema.ts:548-555) + a check before the booking tx (public.ts:736). **Honest limit: phone-keyed identity is block-evasive with a new number — pair with require-upfront (crm.ts:293) as the real deterrent.** Crons: none. **HIGH**.

## 3 · Council
**AMBER-with-conditions** (MS+CM). Conditions: (a) **transparency — a blocked consumer MUST learn they're blocked at booking time with a stated reason + platform-appeal route**; "a silent block is a PDPL fairness/automated-decision problem" and a dark-pattern accusation Egebeya's trust brand (EGE-ADV #12, #13) cannot afford; (b) tenant-scoped refusal, not a platform-wide identity action; (c) block record lives platform-side with appeal — "deliberately the *opposite* of the report-a-merchant evidence rule (#12): there the accused must not hold the evidence; here the accused IS the consumer." Collision: NO; complements #12. **HIGH**.

## 4 · Support/CRM
Impact **MED**. Workaround (code path): force-prepay on the phone (crm.ts:293-337) — "the shipped deterrent — but an owner who wants *never again* has no lever; they 'lose' the slot anyway" (Gap.md:171). OBSERVED-workaround (prepay flag is the only lever; block absent). Day-1: n (prepay covers the common case).

## 5 · Challenge round
**C → B (effort fact):** B's S is a mirror + one check; C's transparency surface (stated reason + appeal route at booking time) is not in B's diff — S holds only for the silent version C forbids.
**A → D:** A calls it "real owner-safety story, top of band 2"; D grades it MED-day-1-n because the prepay flag already absorbs the common case.
**C → B:** B's "phone-keyed identity is block-evasive" undercuts A's "closes the asymmetry" framing — the asymmetry closes only on paper.

## 6 · Chair log
- **Agreed:** small diff on existing plumbing, checked at the booking POST; stays tenant-scoped; the require-upfront flag remains the real deterrent (B).
- **Contested:** scope/effort of C's transparency+appeal surface vs A/B's mirror-and-check; salience (A's top-of-band-2 vs D's day-1-n).
- **Escalation:** None. — Register check: no money; PDPL fairness handled by C's build conditions, no protected authority touched (complements, not collides, EGE-ADV #12).
- **Closure state:** CLEARED
