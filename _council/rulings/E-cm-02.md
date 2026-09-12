ID: E-cm-02 (+ Fresha pair F-sa-111)
Name: Allergy & patch-test records
Surface: merchant SaaS
Category: client-management
Class: GAP (COMPARE-01 — no clinical fields anywhere in schema.ts)
Fresha behaviour: Allergy flags and patch-test outcomes stored on the client record with staff alerts (hc/53; hc/55). KB provenance: OBSERVED.
Egebeya current state: Zero clinical columns — schema.ts:117-148 and 279-300 verified this session; the chair-side conversation is the record.
Blockers: legal — PDPL 1321/2024 special-category (health) data; lifted by ruling 9 WITH a consent flow, retention period, and erasure wiring; design doc required before code (CEO required decision record #4)
Debate summary: A shipped clinical fields inside the NEXT T7.11 bundle and B priced it S-after-E-cm-01 (two fields on the queue card, QueueConsole.tsx:184-242); C blocked the identical bundle seam as "the single largest legal exposure in the 68-row scope" — health data under PDPL 1321/2024 — demanding a CEO ruling before any code and warning "do NOT let a build slip in as 'a notes field'"; D undercut the urgency with LOW/UNDOCUMENTED (in Addis the client tells you at the chair). The clash was build-now-in-bundle vs CEO-blocked-pending-ruling vs don't-bother; C's exposure framing won the escalation, ruling 9 chose C's option (b) with teeth.
Council ruling: BUILD NEXT (was AWAITING-CEO at session close)
Closure method (if BUILD): Scope: allergy + patch-test record on the client, visible at the chair (QueueConsole card), riding the E-cm-01 authored-record seam. Required BEFORE code: the "allergy consent/retention matrix" design doc (CEO required decision record #4) and the retention-period decision. Consent flow: explicit capture consent at the moment of capture — special-category data; purpose-limitation (visible only to staff on that appointment, per C's option (b)). Entity changes: structured fields (fixed enums) on the T7.11 record — no free-text clinical laundering. Legal changes: retention rule + erasure wired into server/lib/accountDeletion.ts (ruling 9's explicit instruction; C §3 register: new table → anonymize/delete by phone AND by tenant path); no print in notifications (B). Tests: no chain-payments-billing case (Money NO); erasure-matrix coverage in the deletion-path tests is mandatory in the same PR.
Substitute method (if SUBSTITUTE/DEFER-with-substitute): n/a once built; C's rejected option (a) (paper-card checkbox + free-text prohibition) remains the pre-ruling interim — which is exactly what the market does today (D).
Owner: Product Owner (consent/retention matrix doc) → Engineering Lead (fields + accountDeletion wiring)
Effort: S per B's pricing (two fields + card visibility); ruling 9's consent/retention/erasure apparatus is scope, not size
Money path: NO — legal YES (special-category data; the file's heaviest non-money exposure)
Protected decision referenced (if any): none (C: no COMPARE-03 collision; heavy PDPL instead)
EGE-ADVANTAGE collision (if any): none — but it joins the PDPL-as-product surface family (EGE-ADV #13) and must honor it
Merchant evidence: LOW; workaround: the client tells you at the chair; "record-what-you-heard instinct is strong in this market" (Gap.md:151); UNDOCUMENTED; day-1: n.
Confidence: HIGH
CEO ruling (final): Ruling 9 — "Allergy & patch-test — store it, WITH a consent flow: real product, real legal, real retention rules. Special-category data requires explicit capture consent, erasure wired into server/lib/accountDeletion.ts, and a retention period. Unblocks E-cm-03's form question … and decouples the T7.11 bundle split per the Chair."
