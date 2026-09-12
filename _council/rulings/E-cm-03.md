ID: E-cm-03 (+ Fresha pair F-sa-113)
Name: Custom intake & consultation forms
Surface: merchant SaaS
Category: client-management
Class: GAP (COMPARE-01 — PublicBooking capture is a fixed schema)
Fresha behaviour: Custom intake/consultation form builders with typed answers attached to appointments (hc/607,61,610,183; fbv-health-practice). KB provenance: OBSERVED.
Egebeya current state: Booking capture is fixed zod — PublicBooking.tsx:15-23 (identity contract) and the schema at src/api/public.ts:596-621; intake today happens in post-booking Telegram chat (Gap.md:155).
Blockers: legal-adjacent (E-cm-02's special-category ruling binds any clinical-adjacent capture); no independent blocker — ruling 9 answered the form question
Debate summary: A's minimal substitute — one free-text "notes for the salon" feeding E-cm-02 — was rejected by the Chair while E-cm-02 was unresolved: C's laundering argument stood ("health answers arrive in 'any questions?' boxes — free-text becomes shadow health data the PDPL matrix can't see"); B insisted preset JSON forms (M) not a merchant form *builder* ("that is the Fresha depth and is L; don't confuse them"); C allowed only allowlisted question types, per-form retention labels, and the fixed zod capture untouched as the identity contract; D rated the pain LOW with the Telegram workaround. Agreement: no builder this cycle; the fight was free-text vs preset vs allowlist.
Council ruling: DEFER (engine) with structured-fields-only substitute (CEO ruling 9 + Chair's no-laundering rule)
Closure method (if BUILD): — (engine deferred; substitute below is what ships inside T7.11)
Substitute method (if SUBSTITUTE/DEFER-with-substitute): structured-fields-only intake — intake answers must be TYPED fields (fixed enums/allowlisted question types per C's allowlist: no free-text clinical prompts), never free text; per-form retention label; answers stored phone-keyed → erasure matrix; the fixed zod booking capture (PublicBooking.tsx:15-23) stays the identity contract; post-visit notes are written by the MERCHANT inside T7.11, kept off the pre-booking capture schema. Named trade-off: merchants cannot self-author forms this season — preset/typed questions only, so long-tail intake needs keep flowing through Telegram chat and stay invisible to analytics (D's workaround persists). Re-entry of the engine (B's preset JSON forms at M) is now unblocked in principle by ruling 9's consent apparatus, gated on C's allowlist + retention conditions shipping with it.
Owner: Product Owner (question allowlist + retention labels) → Engineering Lead (typed-field capture)
Effort: S for the structured-fields substitute inside T7.11; M for preset forms at re-entry; L for any builder (never this cycle)
Money path: NO
Protected decision referenced (if any): none directly; bound by E-cm-02's PDPL posture (ruling 9) which its answers could otherwise launder past
EGE-ADVANTAGE collision (if any): none
Merchant evidence: LOW; OBSERVED-workaround, code-proven: fixed capture schema; intake outsourced to Telegram chat (Gap.md:155); day-1: n.
Confidence: MEDIUM (C MED on the laundering vector; B MED on preset-form shape)
CEO ruling (final): Ruling 9 (second clause): "Unblocks E-cm-03's form question (still: no free-text laundering — intake answers stored as structured fields)." Combined with the Chair's standing no-laundering rule (E-cm-03 form-engine DEFER; A's free-text substitute REJECTED), the council ruling stands.
