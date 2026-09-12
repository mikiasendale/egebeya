ID: E-cs-05 (+ Fresha pair F-sa-241)
Name: Custom domain (verification)
Surface: merchant SaaS
Category: content-site
Class: PARTIAL
Fresha behaviour: Merchants connect a custom domain to their Fresha-powered site (ownership verified). KB: COMPARE-01:192 (hc/109900,109901,109902), docs/Gap.md:321-324.
Egebeya current state: PUT /api/tenant/domain exists, Pro-gated and format-check-only (src/api/tenant.ts:406-448, verified: requireActiveSubscription + customDomainAllowed + regex); resolution happens by Host header (ARCHITECTURE.md:92-100); no DNS-ownership check.
Blockers: none for the verification half; money+legal for the purchase half (registrar rail, E-pm-07 coupling)
Debate summary: A scoped the smallest unit as DNS TXT verification before a domain binds — NEXT, Band 2 #13; purchase DEFER. B priced M and named the actual risk: resolution by Host header means "an unverified domain claim is a takeover waiting for DNS to point"; fix = a TXT-token challenge (outbound DNS lookup) before active; purchase = reseller decision, out. C gave AMBER-with-conditions: this is security debt (competitor's domain pointed at platform infra / cert-issuance abuse), any new column idempotent-guarded, and purchase RED-needs-CEO-ruling as a money move outside booking that E-pm-07's ruling must cover first. D rated merchant demand at zero — the workaround is slug.egebeya.et printed on Telegram stickers; "the missing verification is the security debt to note, not a merchant pain." Chair cleared: the challenge ships on security grounds independent of demand; feature-vs-debt classification contested; purchase rides the E-pm-07 CEO question.
Council ruling: BUILD NEXT (TXT verification); domain purchase DEFER
Closure method (if BUILD): scope: prove-before-serve domain binding — issue a random TXT token on domain claim; tenant domain stays inactive (Host-header resolution refuses it) until an outbound DNS lookup confirms the token; re-verify on change. Entity changes: domain_verification_token + domain_verified_at as guarded plain ADD COLUMN on tenants (idempotent; AGENTS.md:38 law). Endpoint changes: PUT /api/tenant/domain (tenant.ts:406-448) gains the challenge lifecycle (claim → pending → verified); a verify trigger (endpoint or short bounded DNS poll); tenant-resolution middleware (ARCHITECTURE.md:92-100 seam) serves only verified domains. UI changes: Settings domain card shows token + pending/verified state with instructions; am/en strings. Test additions: unverified domain cannot resolve by Host header; token rotation on re-claim; verified → serves; cleared → back to pending; Pro gate unchanged; eq(tenantId) law on writes. Crons: none (bounded lookups in-request or via existing seam; if a poll job is ever added it acquires a Spec B Phase 0 cron_locks lease). (Purchase half: no closure method — DEFER; re-entry rides E-pm-07/ruling 5's payment mechanic and the registrar decision.)
Substitute method (if any): none needed for verification; for purchase the named substitute stays the slug subdomain on Telegram stickers (D) — trade-off: no branded TLD.
Owner: Engineering Lead
Effort: M
Money path: NO (verification ships free on the existing Pro seam; purchase, if ever, is a money move → CEO/E-pm-07 territory and is deferred)
Protected decision referenced (if any): ruling 5 / E-pm-07 scope (purchase coupling, C §3); Pro-gate for custom domains (existing plan semantics, tenant.ts:406-411).
EGE-ADVANTAGE collision (if any): NO (C §3).
Merchant evidence: UNDOCUMENTED frequency (D: zero measured demand); workaround = slug.egebeya.et on stickers, discovery runs on Telegram; notice day 1: n.
Confidence: HIGH on the security framing (B/C); MEDIUM on merchant value (D's zero-demand stands)
CEO ruling (final): BUILD NEXT — DNS TXT verification on the existing Pro-gated seam; domain purchase DEFER. Not escalated at CP4.
