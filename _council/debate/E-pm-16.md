# Debate — E-pm-16 Void, raise, edit sale; receipts

**Surface (declared per persona):** A: merchant SaaS (section) | B: undeclared (per-row) | C: merchant SaaS | D: payments section — flag: B carries no surface (Rule 1).

## 1 · Product Owner
Smallest unit: void flag + reprint on payment rows — "inside T7.5's sale ledger." **DEFER behind T7.5**; invoices today cover platform billing only (`tenant.ts:720-836`, schema.ts:324). **MED**. Bundled in the T7.5 "Money ledger" seam (`public.ts:877` calc + ReceiptTicket.tsx + revenue aggregate `tenant.ts:450-546`).

## 2 · Engineering Lead
Effort **M**. Platform invoices exist with void status (schema.ts:324-340; the gate test already asserts **void-never-grants** at :114-147); booking-level sale ledger does not exist — receipts are tickets. Scope to *recorded* corrections only: **raise-above-paid is COMPARE-03 item 8 territory, prohibited upward.** CAUTION. New gate case: sale-level void/edit never touches the subscription ledger; reprint deterministic. Crons: none. **MED**.

## 3 · Council
**AMBER-with-conditions** (MS). A sale-level ledger is money-**recorded** (allowed, cf. E-pm-18 precedent) but must never mutate settled payment rows — void = compensating entry, append-only discipline like loyalty_ledger (accountDeletion.ts:44-49, OBSERVED). Condition: receipts keep Amharic-first ("ደረሰኝ", COMPARE-02 #9). No CEO-ruling request. Collision: NO. **HIGH**.

## 4 · Support/CRM
Impact **MED**. Workaround (code path): wrong entry = cancel + rebook, "or a whispered cash correction"; no sale-level edit surface exists (Gap.md:107). OBSERVED-workaround. Day-1: n (matters at first reconciliation). Money: **RECORDS.**

## 5 · Challenge round
**C → A:** C rules AMBER — the recorded-correction ledger is shippable now under append-only discipline; A parks the whole row behind T7.5's ledger shape (defer-vs-now).
**B → A (fact):** B calls it M with an existing void precedent in the gate test; A offers no effort and bundles it into T7.5 — the half that is *not* CEO-gated.

## 6 · Chair log
- **Agreed:** corrections are void-plus-compensating-entry only; settled rows immutable; upward raises stay impossible (COMPARE-03 #8, uncontested).
- **Contested:** sequencing — A defers behind T7.5; B and C both scope a standalone recorded-corrections build.
- **Escalation:** None. — Register check: *records* money only; no move, no promise. Void-never-grants is an existing gate assertion to preserve, not reopen.
- **Closure state:** CONTESTED-DEFER
