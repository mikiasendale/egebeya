ID: E-ai-04 (+ Fresha pairs F-sa-261, F-sa-262)
Name: Social-surface booking (Google Reserve / Meta)
Surface: consumer marketplace (booking action), merchant SaaS (activation)
Category: api-integrations
Class: GAP → reclassified NOT-feasible-without-partner-approval (B §2, accepted by Chair)
Fresha behaviour: Consumers book directly from Google (Reserve), Facebook and Instagram surfaces. KB: COMPARE-01:199-200 (hc/179; hc/456 + /pricing), docs/Gap.md:334-336.
Egebeya current state: Profile links only on Settings (src/pages/Dashboard/Settings.tsx:449-510); no Google Reserve, no FB/IG booking integration.
Blockers: none-in-house — external rails (Google Business Profile verification + Meta partner surfaces) and G2 market rails are absent; not an infra or money blocker
Debate summary: A moved DEFER on the standing G2 rails-kill (FSD-002 kill table: "integrations do not serve Ethiopian venues") with the EGE-ADVANTAGE note that the protected public /v1 API (E-ai-01) is our integration surface — "build out from it, not imitatively inward." B separated code from feasibility: M code, but NOT-feasible-without-partner-approval; the feed side rides E-ds-06's JSON-LD ("S, do that now"). C held RED (rails): LEDGER:64 G2-dead, and building imitatively inward collides with EGE-ADV #17 (Egebeya is API-*out*); C's mandatory rule-20 substitute is Telegram — deepen the existing bot into a book-from-chat flow + shareable deep link/QR for Instagram-bio culture; trade-off: zero big-tech panel presence. D scored it "a distribution wish, not a feature" (FSD-003 S-11) with the bio-link-is-tenant-page workaround already shipped. Chair cleared no booking-action build; feed-side separability and substitute depth stayed contested.
Council ruling: SKIP — G2 rails-dead (Google Reserve/Meta booking absent market)
Closure method (if BUILD): n/a — skipped. Recorded adjacent work, not part of this ruling: B's feed-side JSON-LD half rides E-ds-06's own row if/when it ships.
Substitute method (if any): EGE-ADVANTAGE direction (binding): build OUT from the protected /v1 API (E-ai-01) — integration demand should arrive to us via our open surface, not via imitation of big-tech panels. C's named rule-20 substitute: Telegram booking flow on the existing bot + shareable deep link/QR (rides E-cs-06); named trade-off: no Google/Meta booking panel presence until a partner asks — acceptable while the market lives on Telegram (EGE-ADV #15).
Owner: Council (kill-table custodian; re-entry only by partner-program reality)
Effort: M (moot — external approval, not hours, is the gate)
Money path: NO
Protected decision referenced (if any): G2 rails gate (feature-selection §G2; LEDGER:64); EGE-ADV #17 (public /v1 API posture, E-ai-01); FSD-002 kill table.
EGE-ADVANTAGE collision (if any): YES if built imitatively inward — copying Fresha's Google/Meta integration posture collides with the protected API-out advantage (C §3). Building out from /v1 avoids it.
Merchant evidence: DECISION-recorded frequency (G2 decision, not merchant noise); none-in-addis-today; workaround = Instagram bio link → tenant page; notice day 1: n.
Confidence: HIGH
CEO ruling (final): SKIP — G2 rails-dead (Google Reserve/Meta booking absent market); EGE-ADVANTAGE note stands: build OUT from the protected /v1 API (E-ai-01) instead; trade-off: no big-tech surface until a partner asks.
