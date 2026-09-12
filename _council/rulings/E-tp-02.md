ID: E-tp-02 (+ Fresha pair F-sa-201)
Name: Custom permission roles
Surface: merchant SaaS
Category: team-permissions
Class: GAP
Fresha behaviour: Merchants define per-member permission matrices beyond fixed roles. KB: COMPARE-01:181 (hc/100687,100692,101715; fb-connect FAQ), docs/Gap.md:299-302.
Egebeya current state: Three fixed roles (owner/staff/admin) at src/db/schema.ts:31 (verified) checked server-side (auth.ts:120-127; per-route requireAuth({roles})).
Blockers: protected (the three-role model IS the audited security posture; a matrix multiplies the tenant-isolation bug surface)
Debate summary: A deferred outright: three fixed roles are the security model, a matrix is "L-effort with no activation payoff." B priced M but security-sensitive — matrix means a permission store, middleware swap and auditing all 134 endpoints' gates: "defer until a tenant literally begs." C recommended defer (AMBER): in a solo codebase "one missed check is a tenant-isolation breach — the inline-eq law exists because isolation is existential," and offered a rule-20 substitute: staff-visibility settings (which nav/data a staff login sees) WITHIN the fixed roles, trade-off: enterprise checklists stay unchecked. D: none-in-addis-today — three roles fit 1-3 staff shops exactly; listed in "What NOT to build." Chair cleared: fixed roles stand, L-vs-M effort and whether the substitute earns its own ticket stayed contested.
Council ruling: DEFER
Closure method (if BUILD): n/a — deferred. Re-entry trigger: a recorded tenant request for a per-member matrix.
Substitute method (if any): C's staff-visibility settings inside the fixed roles — named trade-off: no real permission matrix; enterprise-ish checklists remain unchecked. Whether it gets its own ticket was left open by the Chair.
Owner: Product Owner
Effort: L (A's classification governs the full matrix; B's M note recorded — the 134-endpoint audit ladder lands closer to L)
Money path: NO
Protected decision referenced (if any): the three-role server-side model (schema.ts:31; auth.ts:120-127) as security posture; AGENTS.md inline-eq isolation law (C cite).
EGE-ADVANTAGE collision (if any): NO (C §3).
Merchant evidence: UNDOCUMENTED frequency; none-in-addis-today; workaround = hand the admin account to the trusted lieutenant or none; notice day 1: n.
Confidence: HIGH (DEFER unanimous; only effort classification contested)
CEO ruling (final): DEFER — three fixed roles are the security model; the matrix is L with no activation. Not escalated at CP4.
