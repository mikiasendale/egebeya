ID: E-ar-02 (+ Fresha pair F-sa-181)
Name: Automation performance
Surface: merchant SaaS
Category: analytics-reporting
Class: GAP
Fresha behaviour: Shows merchants which automations, campaigns and messages drive bookings and revenue. KB: COMPARE-01:172 (hc/101309,101315,101320,101323,103889), docs/Gap.md:282-285.
Egebeya current state: Platform-wide channel success only (server/lib/notificationStats.ts:31-125); no per-template or per-campaign merchant view, though notification_log already carries channel/template/status/refType/refId (src/db/schema.ts:438-449, verified).
Blockers: none (full booking-attribution deferred behind the Spec B job ledger; not a blocker for the rollup)
Debate summary: A scoped the smallest unit as a per-template delivery rollup from notification_log, NEXT in step 12 after E-mg-01/E-mg-05 seed. B priced M and noted the missing pieces: campaign identity (E-mg-01 dependency) and the refId→appointments→completed join; "do the job-ledger widening when a worker exists, not before." C gave GREEN-with-conditions: aggregates are additive tenant-scoped queries riding the delivery-ledger advantage (EGE-ADV #10), but success-rate claims must inherit the mailer-stub caveat (server/lib/mailer.ts, [MAILER STUB] path) or "delivery stats lie." D rated impact LOW and insisted: fix the ledger before selling the graph. Chair cleared on the additive per-template rollup; E-mg-01 dependency left contested.
Council ruling: BUILD NEXT
Closure method (if BUILD): scope: per-template delivery rollup for the owner — counts and success rate by template × channel from notification_log, tenant-scoped; no campaign-identity or revenue-attribution claims in v1. Entity changes: none (notification_log as-is). Endpoint changes: new tenant-scoped GET (analytics area of src/api/tenant.ts) with inline eq(tenantId). UI changes: analytics/automation card on the merchant dashboard; am/en labels for every string. Test additions: per-template rollup matches notification_log rows; cross-tenant leak impossible (eq(tenantId) audit); email success-rate display gated/labeled until the mailer-stub fix. Spec B citation: full booking attribution and the widened job ledger land with Phase 1 (`job_outbox`) — do not pre-widen notification_log before the poller exists.
Substitute method (if any): none.
Owner: Engineering Lead
Effort: M
Money path: NO
Protected decision referenced (if any): EGE-ADV #10 (delivery ledger) — this row extends it honestly, never inflates it; "channels never throw" posture untouched.
EGE-ADVANTAGE collision (if any): NO (C §3 — it rides the ledger advantage).
Merchant evidence: UNDOCUMENTED frequency; no observed merchant workaround; notice day 1: n.
Confidence: MEDIUM (A/B MED; contested dependency on E-mg-01)
CEO ruling (final): BUILD NEXT — per-template notification_log rollup, as debated.
