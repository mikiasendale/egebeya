# Debate — E-ms-04 Time-off types (GAP, Gap.md:189-192)
**Surface:** A: merchant SaaS | B: none declared per row | C: MS | D: merchant SaaS. No clash.

## 1 · Product Owner
Smallest unit: none proposed — DEFER. Request/approval flow assumes HR; closures + per-weekday availability cover the real behavior for 3-staff shops. No table (verified HIGH). **HIGH**.

## 2 · Engineering Lead
**M**. Table + approval flag; the real cost is DATED staff unavailability flowing through `assertSlotAllowed` (public.ts:678-711) and the grid — the availability model only understands day-of-week. Crons: none. Dep: E-ms-03's date-based pattern. **MED**.

## 3 · Council
**AMBER-with-conditions** | MS. Employment-adjacent PDPL: absence types that encode health status (sick vs leave) are staff special-category data. Condition: types are non-medical labels only; request/approval log tenant-scoped and staff-visible-to-self. Collision: NO. Confidence: MEDIUM.

## 4 · Support/CRM
Impact: **LOW.** No time-off table (Gap.md:189). Sick day = owner deletes a booking. Request/approval flows assume HR, not family-run shops. frequency: UNDOCUMENTED. Day-1: **n**. D also lists E-ms-04 among "HR-grade surfaces for 1-3 person shops" the market-fit axis kills (§3).

## 5 · Challenge round
No challenges.

## 6 · Chair log
- **Agreed:** DEFER — the availability model only understands day-of-week; HR-shaped; no merchant evidence.
- **Contested:** None.
- **Escalation:** None.
- **Closure state:** CLEARED
