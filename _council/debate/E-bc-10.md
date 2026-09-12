# Debate — E-bc-10 New-appointment assignment rules
**Surface (declared per persona):** A: merchant SaaS | B: not declared per row | C: MS | D: paper-level CM+MS

## 1 · Product Owner
- Round-robin/seniority engine.
- **DEFER** — "consumer-picks-staff is the market behavior (E-bc-02 SAME); rules engine is a 50+-staff concern". Listed in Deferred-as-a-ruling.
- Cites `public.ts:441-465`. MED.

## 2 · Engineering Lead
- **M**: server-side staff selection + per-staff fairness counter + fallback when none free — new branch inside the booking POST before the tx. Crons: none.
- Failure: "round-robin that ignores staff_services capability edges books unqualified staff. Value at 5–8-staff shops: low." MED.

## 3 · Council
- **AMBER-with-conditions**: round-robin/seniority conflicts with the marketplace's explicit staff pick (E-bc-02 SAME, public.ts:441-465 — "consumers here choose their stylist; that is the trust model").
- Shape: rules apply only to merchant-created bookings (walk-in, phone-in, E-ms surfaces) and "no-preference" marketplace bookings. Collision: NO **if consumer pick stays first-class**. MEDIUM.

## 4 · Support/CRM
- Impact: none-in-addis-today. frequency: UNDOCUMENTED — consumer picks staff explicitly (public.ts:441-465), "which in a 2-chair shop *is* the distribution rule"; round-robin assumes a staff pool the single-chair founding cohort (ROADMAP target) doesn't have.
- Workaround: none needed. Agent sentence: none. Day-1: **n**.

## 5 · Challenge round
**C → A:** A defers the whole row as a 50+-staff concern; C preserves a buildable merchant-side subset (walk-in/phone-in assignment) while protecting the consumer pick (A: public.ts:441-465 | C: same lines, shape carve-out). D's §3 lists this row under "what NOT to build", siding with A.

## 6 · Chair log
- **Agreed:** no marketplace-side rules now; consumer staff-pick is the trust model (public.ts:441-465); the 50+/multi-chair pool doesn't exist yet.
- **Contested:** verdict shade — A DEFER-as-ruling vs C AMBER-with-conditions (merchant-created subset shape); B notes a correctness trap (staff_services edges) any build must carry.
- **Escalation:** None.
- **Closure:** CONTESTED-DEFER
