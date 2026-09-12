# Debate — E-bc-09 Cancellation with reason capture
**Surface (declared per persona):** A: consumer marketplace | B: not declared per row | C: MS — ⚠ A/C declare different surfaces | D: paper-level CM+MS

## 1 · Product Owner
- Smallest unit: fixed enum + optional text on both cancel paths (public + merchant). "Money register: no money — records *why*, never charges."
- **NEXT** — T7.11 bundle.
- Cites `public.ts:1267-1291` verified HIGH: sets status='cancelled', zero reason fields. HIGH.

## 2 · Engineering Lead
- **S**: enum + free text on `appointments`; two write points: public cancel (public.ts:1267-1291) and merchant flip (bookings.ts:81); one column in the CSV export (tenant.ts:2122). No money ("reason→policy, no money"). Crons: none.
- §4: listed as "independent-of-everything and first-weeks-eligible" — it does not wait for T7.11. HIGH.

## 3 · Council
- **GREEN-with-conditions**: no money moves (ground-rules register: reason→policy, no money).
- Condition: the reason must NEVER become a gate for a fee/charge — COMPARE-03 #4 protects behavioural-only no-show defence (crm.ts:293-337 force-prepay is the sanctioned deterrent). Collision: **YES-if-reason-gates-money**. HIGH.

## 4 · Support/CRM
- Impact LOW-MED. frequency: UNDOCUMENTED.
- Workaround: "the owner asks in the phone call and remembers". Recorded re-entry: reason feeds policy only after data exists; no money attached (ground-rules register). Day-1: **n**.

## 5 · Challenge round
**B → A:** A ships reason capture *inside* the T7.11 bundle (NEXT cycle); B lists E-bc-09 as independent-of-everything, first-weeks-eligible at **S** (B: bookings.ts:81, tenant.ts:2122 | A: "T7.11 bundle").
C's guard (no reason→fee gating, COMPARE-03 #4) conditions both plans, not clashes with either.

## 6 · Chair log
- **Agreed:** small diff, no money semantics (register: reason→policy, no money); enum + text on both cancel paths; reason can never gate a charge.
- **Contested:**
  - Sequencing: A bundles into T7.11 vs B ships standalone week one.
  - Surface: A CM vs C MS.
- **Escalation:** None — answers move/record/promise: none (export column only, B tenant.ts:2122).
- **Closure:** CONTESTED-DEFER
