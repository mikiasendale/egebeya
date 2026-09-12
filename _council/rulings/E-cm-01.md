ID: E-cm-01 (+ Fresha pair F-sa-110)
Name: Client profiles & history
Surface: merchant SaaS
Category: client-management
Class: PARTIAL (COMPARE-01 — derived stats present; notes/preferences/forms/wallet/chat absent)
Fresha behaviour: Full client profile — visit history, notes, preferences, files (hc/320,204; fb-connect). KB provenance: OBSERVED.
Egebeya current state: The profile is 100% derived — visits/spend/health/no-show columns only (customer_stats, schema.ts:279-300; src/api/crm.ts:34-96).
Blockers: none (PDPL handled by C's standing same-PR erasure condition; special-category data is E-cm-02's row, not this one)
Debate summary: A called the authored record "one of the two sentences that close a merchant in person" and bundled it as T7.11's seam; B confirmed M — the append-only notes table (loyalty_ledger precedent, schema.ts:481) is the authored-record schema the other client rows hang on; C hardened erasure into a sequence law: the erasure design lands in the same PR as the first authored field, not after; D graded day-1 n — owners trust their memory until a stylist leaves with the regulars in their head. The contest was salience and sequencing strictness, not direction; the Chair decoupled this row from the E-cm-02 allergy question.
Council ruling: BUILD NEXT (T7.11 bundle — notes/cancel-reason/files ship first; allergy field waits per the Chair's decoupling recommendation, taken in ruling 9)
Closure method (if BUILD): Scope: the T7.11 authored-record seam — E-cm-01/06 + E-bc-07 notes + E-bc-09 cancel-reason + E-cm-04 row-neighbor (forms per E-cm-03's structured-fields ruling). Entity changes: additive append-only notes table (loyalty_ledger precedent, schema.ts:481), fixed enums only; no free-text clinical fields (those route to E-cm-02's consent apparatus). Endpoint changes: crm.ts profile read/write surface. UI changes: merchant client-profile view. PDPL: erasure-matrix extension in the SAME PR as the first authored field (C's sequence law); staff projection must not leak phone/email (bookings.ts:23-41). Tests: no chain-payments-billing case (outside the payments register); erasure-matrix assertion via accountDeletion.ts coverage.
Substitute method (if SUBSTITUTE/DEFER-with-substitute): n/a (BUILD NEXT). Current substitute is the pain: the owner's contact book and memory (Gap.md:147).
Owner: Engineering Lead (T7.11)
Effort: M
Money path: NO (register check: no move/record/promise)
Protected decision referenced (if any): none
EGE-ADVANTAGE collision (if any): none
Merchant evidence: MED; OBSERVED-workaround: transaction-derived stats + owner's memory/phone contacts — "regulars are a one-person failure mode when a stylist leaves with them" (Gap.md:147); day-1: n; agent sentence: "Your regulars belong to the shop, not to a phone's memory."
Confidence: HIGH
CEO ruling (final): Not escalated — council ruling stands. Ruling 9's decoupling instruction ("decouples the T7.11 bundle split per the Chair") confirms this row ships without the allergy field.
