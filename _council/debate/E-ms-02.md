# Debate — E-ms-02 Shift scheduling / rosters (GAP, Gap.md:181-184)
**Surface:** A: merchant SaaS | B: none declared per row | C: MS | D: merchant SaaS. No clash among declared.

## 1 · Product Owner
Smallest unit: staff sees their own week on the same grid via existing role projection (`bookings.ts:23-58` verified MED; StaffRedirect.tsx exists). **NEXT**, same build as E-ms-01 — per-weekday windows already exist (`tenant.ts:373` HIGH in repo-map). Half under debate = the staff-week half of the shared-calendar bundle. **MED**.

## 2 · Engineering Lead
**M**. `staff_availability` is per-weekday only (schema.ts:93-99, tenant.ts:373-404); add DATED shift rows + a staff login view; rides the E-ms-01 grid. Crons: none. Grid chain: E-ms-01 ─► E-bc-08 ─► E-ai-03′ ─► E-ms-02/E-tp-03 views. **MED**.

## 3 · Council
**AMBER-with-conditions** | MS. Rows exist; publishing them to staff logins is **read-scoping, not new entity**. Conditions: staff see only their tenant's roster (inline eq(tenantId) law on every new query); no compensation surfaces ride along (E-tp-04 boundary). Collision: NO. **HIGH**.

## 4 · Support/CRM
Impact: **LOW alone — but it is E-ai-03's front door, and there D rates the shared calendar HIGH**. This is the half D means: "Your staff see their week on their own phone — no phone calls to you" (D §1, E-ai-03; agent sentence here: "Your staff stop calling you to ask if they're on"). Workaround path: Telegram message "ቅዳሜ 8-5" — no record, no confirmation (Gap.md:184). Evidence: UNDOCUMENTED ask. Day-1: n alone, **y paired with the E-ai-03 re-scope**. D wants the week strip, not the canvas.

## 5 · Challenge round
**C → B:** C: "read-scoping, not new entity" vs B: "add dated shift rows" — entity disagreement (fact).
**D → A:** D ships staff-week first and cheap (E-ai-03 re-scope "this season's cheapest version", verdict: before the queue exists) while A sequences it NEXT-cycle inside the E-ms-01 grid build.

## 6 · Chair log
- **Agreed:** staff read-view over existing availability/appointment data is a real job (D's E-ai-03 HIGH, C's read-scoping, A's bundle); tenant-scoped queries mandatory; no pay surfaces attach.
- **Contested:**
  - Dated shift rows (B, M) vs read-scoping existing per-weekday rows (C).
  - Whether the view rides the E-ms-01 grid (A, B) or a non-grid week strip (D).
- **Escalation:** None.
- **Closure state:** CONTESTED-DEFER
