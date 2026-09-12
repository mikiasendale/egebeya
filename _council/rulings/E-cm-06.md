ID: E-cm-06 (+ Fresha pair F-sa-117)
Name: Files on client profiles
Surface: merchant SaaS
Category: client-management
Class: GAP (COMPARE-01 — media library is tenant-scoped, not client-scoped)
Fresha behaviour: Photos and documents (consent forms, reference images) attached to individual client profiles (hc/596). KB provenance: OBSERVED.
Egebeya current state: Upload + media plumbing exist and are tenant-scoped (src/api/tenant.ts:1401-1470; schema.ts:217-225); no nullable customer link exists.
Blockers: none (retention split keys off the E-cm-02 ruling, now settled by ruling 9 — adds no new authority question)
Debate summary: A bundled files NEXT into T7.11 with the PDPL erasure assertion promised; B priced the mechanism S — a nullable `customer_phone` link on existing upload rows, riding tenant.ts:1401; C's challenge turned materiality: consent-form photos are *the* legal record pair to E-cm-03 answers and need SPLIT retention (keep signed consent, purge clinical photos on request), file-type/size limits, and erasure that deletes customer-linked media OBJECTS, not just rows — "more than add nullable customer_phone"; D graded pain LOW with Telegram reference photos "honestly better for now" (Gap.md:167). The Chair cleared the row; the contest was effort/materiality and demand class, both recorded.
Council ruling: BUILD NEXT (T7.11 bundle; decoupled from the allergy field per the Chair's recommendation, taken in ruling 9)
Closure method (if BUILD): Scope: link existing tenant upload to a client. Entity changes: nullable customer link on media rows (schema.ts:217-225 tenant-scoped today). Endpoint changes: upload gains optional client target; client-profile media list. UI changes: files tab on the T7.11 profile view. Conditions (C, binding): split retention classes — signed-consent artifacts keep, clinical photos purge on request; file-type/size limits; the erasure matrix must delete customer-linked media blobs, not just rows (consumer path has no media today — add it, C §3 register). Tests: no chain-payments-billing case (Money NO); blob-erasure assertion in the deletion-path coverage.
Substitute method (if SUBSTITUTE/DEFER-with-substitute): n/a (BUILD NEXT). Interim: reference photos travel on Telegram (D: adequate current store).
Owner: Engineering Lead
Effort: S per B, flagged by C as understated once split retention + blob-level erasure are included (no official re-price — recorded as an effort dispute, not resolved)
Money path: NO
Protected decision referenced (if any): none
EGE-ADVANTAGE collision (if any): none
Merchant evidence: LOW; workaround: Telegram photo exchange (Gap.md:167); UNDOCUMENTED; day-1: n.
Confidence: HIGH (B, C on mechanism; A MED on the demand read)
CEO ruling (final): Not escalated — council ruling stands (Chair cleared; ruling 9's decoupling note confirms T7.11 ships without the allergy field).
