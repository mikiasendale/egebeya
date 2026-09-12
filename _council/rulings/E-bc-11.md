ID: E-bc-11 (+ Fresha pair F-sa-98)
Name: Sell-online toggle + lead/max-notice controls
Surface: merchant SaaS (C's blended "MS+CM" label rejected; the consumer flow only observes the toggle's effect)
Category: booking-core
Class: PARTIAL (COMPARE-01 F-sa-98: active flags exist; no sellable-online toggle, no scheduling-window/lead controls)
Fresha behaviour: Per-service sell-online toggle plus minimum-notice / maximum-lead booking windows (features.json; help-center hc/100643, hc/496 — OBSERVED at doc level).
Egebeya current state: services.active + staff.active exist (src/db/schema.ts:74, 85) as the only, blunt controls; enforcement point is assertSlotAllowed in the availability generator (citation drift B :623-714 vs C :802 resolved against the tree; settings seam tenant.ts:1185-1204).
Blockers: none
Debate summary: No substantive challenges — the row cleared unanimous-BUILD. A took it NEXT riding T7.2's settings-blob seam ("genuinely requested merchant hygiene"); B priced S/M as settings-blob fields + availability-generator enforcement, with the walk-in path bypassing online toggles by design (E-bc-12 semantics). C conditioned min-notice to compose with the pending-payment slot-expiry reclaim so the tool never creates "windows where a slot is bookable but always expires unfunded". D supplied the demand: owners set the service inactive for everyone to dodge 9pm online bookings — the forced-blunt-instrument class of pain. The only contested entries were clerical (line-number drift) and a surface label.
Council ruling: BUILD NEXT (Band 2)
Closure method (if BUILD): Scope: per-service sellable_online flag + lead/max-notice fields on the settings blob, enforced in the availability generator only. Entity changes: nullable services.sellable_online (guarded ADD COLUMN) + settings-blob keys (tenant.ts:1185-1204 pattern); no new tables. Endpoint changes: GET/PUT /api/tenant/settings keys; assertSlotAllowed + grid start offset honor them; walk-in path (bookings.ts:345) bypasses online toggles by design. UI changes: merchant per-service sell-online toggle + lead window inputs (Settings); strings in am.json AND en.json same commit. Test additions: server/tests/booking-concurrency.test.ts (or discover/availability suite) — new cases "sellable_online=false hides slots online but walk-in books", "min-notice never fights the pending-slot reclaim".
Substitute method (if SUBSTITUTE/DEFER-with-substitute): —
Owner: Engineering Lead (B's infra-shaped seam — settings blob + assertSlotAllowed — is the operative paper; the Chair resolved the citation drift against the tree)
Effort: S/M (B §1 letter, kept as recorded; not re-priced in §3)
Money path: NO
Protected decision referenced (if any): EGE-ADVANTAGE E-bc-12 walk-in semantics — walk-ins must bypass online toggles by design.
EGE-ADVANTAGE collision (if any): None — the boundary is built into the closure method.
Merchant evidence: OBSERVED-workaround — only the blunt active flag exists (schema.ts:74); owner deactivates the service for everyone to protect the calendar; Day-1: y (the first busy Saturday).
Confidence: HIGH
CEO ruling (final): Not escalated — council ruling stands.
