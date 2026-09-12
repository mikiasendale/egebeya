ID: E-bc-10 (+ Fresha pair F-sa-97)
Name: New-appointment assignment rules
Surface: merchant SaaS
Category: booking-core
Class: GAP (COMPARE-01 F-sa-97: consumer picks staff; no rules engine)
Fresha behaviour: Round-robin/seniority assignment rules for new appointments (features.json; help-center hc/102178 — OBSERVED at doc level).
Egebeya current state: Consumer picks staff explicitly (src/api/public.ts:441-465; PublicBooking.tsx:557-588); no server-side selection, no fairness counter.
Blockers: none (protected-behaviour boundary: consumer staff-pick)
Debate summary: A DEFERred the whole row as a 50+-staff concern absent from the 5–8-staff reality. C carved out a buildable merchant-side subset (rules on walk-in/phone-in and no-preference bookings only) while insisting the consumer pick stays first-class — the trust model. B added the correctness trap any future build must carry: round-robin that ignores staff_services capability edges books unqualified staff. D sided with A: in a 2-chair shop the consumer's explicit pick *is* the distribution rule.
Council ruling: DEFER
Closure method (if BUILD): —
Substitute method (if SUBSTITUTE/DEFER-with-substitute): C's carve-out recorded as the re-entry shape: rules apply only to merchant-created bookings (walk-in, phone-in, E-ms surfaces) and "no-preference" marketplace bookings; consumer-picks-staff is protected behaviour (E-bc-02 SAME) and must never be bypassed. Named trade-off: no automated distribution exists for the founding cohort's 5–8-staff shops — where the need is measurably low.
Owner: Council (C's shape carve-out is the only operative content in an otherwise unanimous DEFER)
Effort: M (B §1; not re-priced in §3 audit)
Money path: NO
Protected decision referenced (if any): E-bc-02 SAME consumer staff-pick = the market trust model (public.ts:441-465), per the Chair's boundary.
EGE-ADVANTAGE collision (if any): YES-if-rules-override-consumer-pick — prevented by the DEFER and C's carve-out boundary.
Merchant evidence: UNDOCUMENTED — none-in-addis-today; workaround: none needed (consumer pick is the rule); Day-1: n.
Confidence: MEDIUM
CEO ruling (final): Not escalated — council ruling stands.
