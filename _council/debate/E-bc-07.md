# Debate — E-bc-07 Appointment statuses & notes
**Surface (declared per persona):** A: merchant SaaS | B: not declared per row | C: MS | D: paper-level CM+MS

## 1 · Product Owner
- Smallest unit: `appointments.notes` TEXT column + textarea in the booking detail card.
- **NEXT** — ship inside the T7.11 authored-record bundle ("same seam, same PDPL erasure assertion").
- Cites `bookings.ts:89-92` statuses verified; no notes column verified HIGH. HIGH.

## 2 · Engineering Lead
- §1: **S** for notes — additive column + write in status PUT + staff-role projection (precedent bookings.ts:23-41) + PDPL erasure matrix (accountDeletion.ts); no notes column today (schema.ts:117-148). Crons: none.
- ⚠ B's own effort audit (row 21, F-mp-26 notes) re-scores COMPARE-04's S to **M**: "append table + staff projection + PDPL erasure matrix — the 'S' was counting the column, not the file."

## 3 · Council
- **AMBER-with-conditions**: notes are new consumer-record data → PDPL register row; merchant-authored notes are the subject's personal data; erasure matrix must anonymize/delete them (§3 table: appointments.notes joins the anonymize set).
- Condition: **notes must never carry allergy/clinical text** — route to E-cm-02's ruling. Collision: NO (for notes alone). HIGH.

## 4 · Support/CRM
- Impact MED. frequency: OBSERVED-workaround — "the owner memorizes or writes on their hand that Selam wants the senior braider; the info dies with the shift".
- Workaround code path: memory is the store; T7.11 carries this at 21/24, one-way, WAITING (LEDGER.md:24). Day-1: **n**.

## 5 · Challenge round
**A → C:** A ships E-bc-07 *inside* the T7.11 bundle alongside E-cm-02 clinical fields ("same seam", bundle table §3); C rules E-cm-02 **RED-needs-CEO-ruling** (health data under PDPL 1321/2024) and warns "do NOT let a build slip in as 'a notes field'" — the bundle cannot ship its allergy half on A's NEXT. (A: schema.ts customer_stats/crm.ts seam | C: §1 E-cm-02, §4 register.)

## 6 · Chair log
- **Agreed:** statuses ship already; notes ride T7.11 with the PDPL erasure matrix in the same PR; notes ≠ clinical text.
- **Contested:**
  - Effort letter inside B's paper: §1 **S** vs §3 audit **M** — name both.
  - Bundle composition: A's one-seam T7.11 (notes + allergy) vs C's CEO-gate on the clinical half.
- **Escalation:** ESCALATE: does the T7.11 authored-record bundle ship notes without the E-cm-02 allergy half (C: RED-needs-CEO-ruling, PDPL special-category)?
- **Closure:** AWAITING-CEO
