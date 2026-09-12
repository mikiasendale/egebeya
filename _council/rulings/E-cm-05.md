ID: E-cm-05 (+ Fresha pair F-sa-116)
Name: Client list import/export/merge/delete
Surface: merchant SaaS
Category: client-management
Class: PARTIAL (COMPARE-01 — CSV export exists with no UI; import/merge/per-client delete absent)
Fresha behaviour: Full list migration — import from competitors, merge duplicate clients, export, delete (hc/101243,58,57,60). KB provenance: OBSERVED.
Egebeya current state: Export endpoint is live and dead-surfaced — src/api/tenant.ts:2122 streams CSV with zero UI callers (repo-map dead_surfaces); no import, no merge, per-client delete maps only to the consumer-erasure path (accountDeletion.ts).
Blockers: none for export; import/merge blocked on a merge-safety design doc (one-way door; append-only-ledger danger)
Debate summary: All four converged on the export button — live endpoint, no callers, "free win" — shipping inside T7.17. A deferred import/merge/delete outright; B priced them at M with mechanics named (parse ≤2k rows in-request; merge re-points appointments/customer_stats; delete MUST map to anonymize, not row-drop, because payments are immutable money records); C grounded the danger in OBSERVED keys — customer_stats PK is (tenantId, phone) and loyalty_ledger is append-only with phone keys (accountDeletion.ts:44-49), so a merge must not orphan punches or double-count spend; D ranked it MED as *switching* pain ("re-type clients by phone over two weeks"), noting the displacement quote is a KB-pattern substitute, not Egebeya evidence. The Chair split exactly along those lines.
Council ruling: SPLIT — export: BUILD NOW; import/merge: DEFER (per-client delete folds into the existing PDPL erasure matrix work, not a new surface)
Closure method (if BUILD): Export half: a UI caller on the existing tenant.ts:2122 CSV stream (T7.17) — entity changes: none; endpoint changes: none; UI: export button on the client list. Both locales. No chain-payments-billing case (no money semantics touched; export already obeys immutable-money rules).
Substitute method (if SUBSTITUTE/DEFER-with-substitute): For the deferred halves: merge-safety DESIGN DOC first (Chair: "C's append-only-ledger danger is a design requirement, not a mood"; feature-selection §6 one-way door) — re-entry of import/merge only after it names the punch/ledger re-point rules; per-client delete is served by the existing anonymize-never-row-drop erasure matrix (B's pattern, Chair-adopted). Trade-off named: merchants switching platforms still re-type their book for a season; import additionally carries bulk third-party PII intake (merchant warrants consent, platform is processor — C's DPA-language requirement rides the doc).
Owner: Engineering Lead (export now); Product Owner (merge-safety doc)
Effort: S (export button) / M (deferred import+merge, B's price against the future doc)
Money path: NO (merge/delete rules exist precisely so money records stay immutable; register check passed)
Protected decision referenced (if any): none; immutable-money-record pattern honored via the anonymize rule
EGE-ADVANTAGE collision (if any): none
Merchant evidence: MED — the *switching* pain; OBSERVED-workaround (code-proven): buttonless export, no import — re-type by phone or keep the paper book parallel (Gap.md:163); day-1: n merchants, y at every competitor displacement.
Confidence: HIGH (Chair split on unanimous facts)
CEO ruling (final): Not escalated — council ruling stands (Chair: SPLIT — export button NOW via T7.17; import/merge DEFER pending merge-safety doc; per-client delete folded into the PDPL erasure matrix work).
