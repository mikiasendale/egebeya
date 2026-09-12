ID: E-bc-07 (+ Fresha pair F-mp-26)
Name: Appointment statuses & notes
Surface: merchant SaaS
Category: booking-core
Class: PARTIAL (COMPARE-01 F-mp-26: statuses present; per-appointment notes absent — no column)
Fresha behaviour: Full appointment status set plus per-appointment notes on the record (features.json fb-scheduling; help-center hc/600, hc/29 — OBSERVED).
Egebeya current state: Status lifecycle real (src/api/bookings.ts:89-92); `appointments` has no notes column (src/db/schema.ts:117-148).
Blockers: legal-adjacent only for the clinical half — now resolved: allergy/patch-test data moved to E-cm-02 under CEO ruling 9 (consent flow, retention, erasure); notes alone need the PDPL erasure matrix in the same PR
Debate summary: A wanted to ship notes NEXT inside the T7.11 authored-record bundle, "same seam, same PDPL erasure assertion" — alongside E-cm-02's clinical fields. C ruled the clinical half RED-needs-CEO-ruling (PDPL special-category) and warned "do NOT let a build slip in as 'a notes field'," so the bundle composition was the real clash. B's paper contradicted itself — §1 notes it S, §3 audit row 21 re-prices to M ("the 'S' was counting the column, not the file") — and the Chair held the audit governs. D's OBSERVED workaround: the owner memorizes and the info dies with the shift. CEO ruling 9 locked allergy WITH consent and decoupled the bundle per the Chair's split.
Council ruling: BUILD NEXT (T7.11 half-1: notes + status lifecycle; the allergy half ships separately as E-cm-02 with the consent matrix)
Closure method (if BUILD): Scope: additive `appointments.notes` TEXT column + write in the status PUT + staff-role projection + PDPL erasure-matrix wiring (notes are the subject's personal data; accountDeletion.ts anonymize set). Notes must never carry allergy/clinical text — that routes to E-cm-02. Entity changes: one guarded, idempotent ADD COLUMN (migrations.ts convention). Endpoint changes: bookings status PUT (bookings.ts:89-92) accepts notes; detail reads project it per role (precedent bookings.ts:23-41). UI changes: textarea in the merchant booking detail card (Bookings.tsx). Test additions: server/tests/booking-crud.test.ts — notes write/read + projection cases; server/tests/account-deletion.test.ts — erasure-matrix coverage for appointments.notes. (Not a money row; no chain-payments-billing case required.)
Substitute method (if SUBSTITUTE/DEFER-with-substitute): —
Owner: Product Owner (A's sequencing carried the notes half; C's ruling moved only the clinical half; B's audit governs the letter)
Effort: M (B §3 audit row 21 — the audit governs per the Chair, not B's §1 S)
Money path: NO
Protected decision referenced (if any): CEO ruling 9 (special-category consent/retention/erasure); Chair's internal-conflict resolution "the audit governs."
EGE-ADVANTAGE collision (if any): None — notes ≠ clinical text is the enforced boundary.
Merchant evidence: OBSERVED-workaround — "the owner memorizes or writes on their hand that Selam wants the senior braider; the info dies with the shift"; T7.11 at 21/24, one-way, WAITING (LEDGER.md:24); Day-1: n.
Confidence: HIGH
CEO ruling (final): Ruling 9 — allergy stored WITH a consent flow (real legal, real retention), decoupling the T7.11 bundle per the Chair: E-bc-07 half-1 (notes/status) ships first; E-cm-02 ships separately with the consent matrix.
