# Debate — E-ds-05 Aggregate rating display
**Surface (declared per persona):** A: consumer marketplace | B: not declared per row | C: CM | D: consumer marketplace (paper-level)

## 1 · Product Owner
- Smallest unit: print avg+count from the E-mg-05 reviews table — "nothing to display until that table exists".
- **DEFER** strictly behind E-mg-05.
- Cites COMPARE-01 F-mp-05; no reviews table verified HIGH in schema. HIGH.

## 2 · Engineering Lead
- **M, blocked by E-mg-05**: display + avg is S once a reviews table exists; discover already batch-joins per-tenant counts (public.ts:147-165) so the aggregate pattern is proven.
- "The NEW badge is not a rating." Failure if rushed: fake ratings. Dep: E-mg-05. HIGH.

## 3 · Council
- **AMBER (dependency-blocked)**: nothing to aggregate — reviews table does not exist (schema scan, OBSERVED). Sequence after E-mg-05.
- Conditions when it lands: score+volume printed together (07-TRUST-MECHANICS2 rating rules); review counts must exclude demo tenants (`server/lib/demoTenant.ts:63-95`). Inherits E-mg-05's UGC duties. Collision: NO. HIGH.

## 4 · Support/CRM
- Impact MED. frequency: UNDOCUMENTED — in a one-reputation market trust travels by Telegram word-of-mouth; "a rating with n=3 reviews is worse than NEW".
- Workaround: the NEW badge + "No bookings yet" (public.ts:178-186; Discover.tsx:245-252) — D defends the honesty, not the placement. Day-1: **y** (consumers misread absence).

## 5 · Challenge round
No challenges. All four condition any display on the E-mg-05 reviews entity existing; D's "no agent sentence until E-mg-05" matches A's strict DEFER.

## 6 · Chair log
- **Agreed:** hard-blocked behind E-mg-05's reviews table; fake or thin ratings are the named failure; NEW stays until then.
- **Contested:** None.
- **Escalation:** None.
- **Closure:** CLEARED
