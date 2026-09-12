ID: E-cm-04 (+ Fresha pair F-sa-114; also F-sa-115 segments)
Name: Tags & segments
Surface: merchant SaaS
Category: client-management
Class: PARTIAL (COMPARE-01 — computed health tags/segments only; no free-form client tags or custom segments)
Fresha behaviour: Free-form tags on clients plus custom saved segments for campaigns (hc/100679; hc/100685,100686,103794). KB provenance: OBSERVED.
Egebeya current state: Computed health tags exist (src/lib/customer-health.ts:27); crm.ts:34-89 filters already carry inactive_days as a param — segments = saved filter presets away (schema.ts:279-300).
Blockers: none (C's shadow-clinical-record condition and the E-ca-02 sequence gate apply as build conditions)
Debate summary: A wanted a tags array on customer_stats as a T7.11 row-neighbor; B specified a separate tenant tag table plus a crm.ts filter param at S, noting segments feed campaign audiences later; C conditioned both: free-form tags become a shadow clinical record unless they stay marketing/behaviour vocabulary with a moderation heuristic and a doc rule against clinical text — and segments may feed campaigns ONLY after E-ca-02 exists; D rated impact MED with the "segments by eye" workaround. The unresolved-in-debate detail was storage shape (array vs table — one of them is the wrong file); the Chair cleared the row.
Council ruling: BUILD NEXT (T7.11 row-neighbor; campaign use gated behind E-ca-02, which now precedes it as a BUILD-NOW duty)
Closure method (if BUILD): Scope: free-form tenant tags + custom saved segments. Entity changes: tenant tag table (B's shape — array-on-stats left as the debate's unresolved detail, Engineering Lead to pick on the PR and note it); segments persisted as saved filter presets over crm.ts:34-89 params. Endpoint changes: tag CRUD + filter param on crm.ts. UI changes: CRM tag chips beside computed health tags + segment save. Conditions (C, binding on the build): tags are marketing/behaviour vocabulary; moderation heuristic + written doc rule against clinical text in tags (computed health tags stay the sanctioned derived set); segments feed campaigns only after E-ca-02 ships. Tests: no chain-payments-billing case (outside the payments register; campaign audiences inherit E-ca-02's consent gate).
Substitute method (if SUBSTITUTE/DEFER-with-substitute): n/a (BUILD NEXT). Current substitute: the owner segments by eye ("the ones from church group", Gap.md:159).
Owner: Engineering Lead
Effort: S
Money path: NO
Protected decision referenced (if any): none
EGE-ADVANTAGE collision (if any): none
Merchant evidence: MED; OBSERVED-workaround (computed-only): eye-segmentation + computed health segments powering winback (Gap.md:159); day-1: n ("founding cohort too small to feel it").
Confidence: HIGH (B on the seam; A MED on the customer-health anchor, class agreed)
CEO ruling (final): Not escalated — council ruling stands (Chair: cleared row; E-mg-01's ruling enforces the after-E-ca-02 sequence).
