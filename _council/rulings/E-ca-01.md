ID: E-ca-01 (+ Fresha pair F-mp-70)
Name: Client account & marketplace profile
Surface: consumer marketplace
Category: consumer-account
Class: PARTIAL (COMPARE-01 — identity-lite JWT present; no bookings list, no profile editor, no wallet)
Fresha behaviour: Consumer accounts with marketplace profile, bookings list and wallet (auth copy; hc/101646). KB provenance: OBSERVED.
Egebeya current state: Phone-keyed consumer JWT + OTP exist (src/api/consumer.ts:49-215) and appointments.consumerId is already backfilled (schema.ts:133-135); account-free self-service (status/cancel/reschedule by opaqueId+phone) ships at public.ts:1382-1430.
Blockers: none (the wallet half is dead law: COMPARE-03 #6 + AGENTS.md never-do)
Debate summary: C ruled GREEN for a bookings list + profile editor on the existing JWT and B noted the list is an S-sized scoped select on an already-backfilled column; A held DEFER because "identity-lite *is* the market-fit advantage" — E-ca-03 achieved self-service without accounts — and D seconded: a marketplace profile assumes browsing demand the directory doesn't have yet. Same PARTIAL facts, opposite ladder placement; the Chair resolved the CONTESTED-DEFER for A/D's rule-8 argument.
Council ruling: DEFER (Chair)
Closure method (if BUILD): — (re-entry unit recorded: B's scoped S/M bookings-list + name-only profile editor on the phone-keyed JWT, triggered by /my-bookings traffic; wallet never, new editable fields join the erasure matrix from day one)
Substitute method (if SUBSTITUTE/DEFER-with-substitute): the shipped substitute is the advantage itself — account-free self-service by opaqueId+phone (COMPARE-01:83, E-ca-03 SAME). Named trade-off: no cross-device account continuity and no marketplace profile; consumers keep "your phone number is your ticket."
Owner: Product Owner (re-entry trigger)
Effort: M as debated (B: list S + editor S against M surface)
Money path: NO (the wallet half nobody proposes is already dead law)
Protected decision referenced (if any): COMPARE-03 #6 (wallets DO-NOT-BUILD — collision YES-if-wallet-creep, uncontested)
EGE-ADVANTAGE collision (if any): YES-in-spirit — deepening the account surface copies Fresha's shape against the identity-lite advantage (A/D's rule-8 argument, Chair-adopted)
Merchant evidence: LOW (deliberately); workaround: self-service by phone already ships; demand UNDOCUMENTED (D: "a marketplace profile assumes browsing demand the directory doesn't have yet", Gap.md:134).
Confidence: HIGH (class agreed by all four; the ladder was the only dispute)
CEO ruling (final): Not escalated — council ruling stands (Chair: DEFER per A/D's rule-8 argument; B's scoped S/M profile editor recorded as the re-entry unit).
