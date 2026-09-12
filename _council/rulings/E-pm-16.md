ID: E-pm-16 (+ Fresha pair F-bh-57)
Name: Void, raise, edit sale; receipts
Surface: merchant SaaS
Category: payments-money
Class: PARTIAL (COMPARE-01 — platform invoices/receipts exist; sale-level void/raise/edit and reprint absent)
Fresha behaviour: POS sale-level void, raise (add to), and edit with printable receipts (hc/367,355,173,133,100664,171,88). KB provenance: OBSERVED.
Egebeya current state: Invoices exist for platform/subscription billing only with void status (src/api/tenant.ts:720-836; schema.ts:324-340; the gate test already asserts void-never-grants at :114-147); booking receipts are tickets, not a ledger (ReceiptTicket.tsx:128-138).
Blockers: none (money-recorded only) — inside the T7.5 offline ledger; anchor row is E-pm-18
Debate summary: A parked the row behind T7.5's ledger shape; C ruled it AMBER and shippable under append-only discipline (void = compensating entry, loyalty_ledger precedent at accountDeletion.ts:44-49); B noted the existing void precedent makes it M with named gate cases; D called the workaround "cancel + rebook, or a whispered cash correction." The Chair resolved the sequencing clash for B/C against A's full-deferral — explicitly NOT blocked behind the CEO's then-pending tax decision (since cleared by ruling 3). All agreed upward raises stay impossible (COMPARE-03 #8).
Council ruling: BUILD NEXT — inside the T7.5 ledger
Closure method (if BUILD): Scope: recorded corrections only, inside the T7.5 offline-sale ledger that E-pm-18 anchors (gateway=null cash rows); void = status flag + reprint, NEVER a gateway call; settled payment rows immutable; raise-above-paid prohibited (COMPARE-03 #8, uncontested). Entity changes: none beyond the T7.5 ledger's own shape; location-aware first migration per the ruling-10 impact. Endpoint changes: tenant-side sale void/edit endpoints on the ledger. UI changes: void + reprint on the sale surface; reprint rides existing receipts plumbing and keeps Amharic-first ("ደረሰኝ", C's condition, COMPARE-02 #9). Tests — MONEY: NEW cases in server/tests/chain-payments-billing.test.ts: sale-level void/edit never touches the subscription ledger; reprint deterministic; preserve the existing void-never-grants assertion (:114-147) rather than reopen it.
Substitute method (if SUBSTITUTE/DEFER-with-substitute): n/a (BUILD NEXT). Current workaround until it lands: cancel + rebook or a whispered cash correction.
Owner: Engineering Lead
Effort: M
Money path: YES — CAUTION (records money; no move, no promise)
Protected decision referenced (if any): COMPARE-03 #8 (downward-only price semantics — raise-above-paid prohibited); protected void-never-grants gate assertion preserved
EGE-ADVANTAGE collision (if any): none (receipt language honors #9's Amharic-first posture)
Merchant evidence: MED; OBSERVED-workaround: cancel + rebook or a whispered cash correction — no sale-level edit surface exists (Gap.md:107); day-1: n, matters at first reconciliation.
Confidence: HIGH on posture / MEDIUM on effort (B, MED)
CEO ruling (final): Not escalated — council ruling stands (Chair: BUILD as recorded corrections inside the offline-ledger shape, not blocked behind the CEO's tax decision). General preconditions: ruling 1; rulings 3/18 define the ledger it sits on.
