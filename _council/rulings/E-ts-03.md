ID: E-ts-03 (+ Fresha pair F-sa-282)
Name: No-show protection as a policy engine
Surface: merchant SaaS (row is clearly MS; A's section header blends CM — Chair-flagged, rejected)
Category: trust-safety
Class: PARTIAL — the behavioural half is shipped; the Fresha monetary half is DIVERGENT-BY-DESIGN, so the buildable residue is config surface only (COMPARE-01:129, :324)
Fresha behaviour: Fees, deposits, or prepay requirements protect the calendar from no-shows; fee captured from a stored card/deposit at the status event. (OBSERVED — fbv-health-practice / medspa / physical-therapy section headings; fbv-nails alert.)
Egebeya current state: Behavioural engine live — no-show counter + health tag + per-phone forced prepay (src/api/crm.ts:293-337; bookings.ts:163-197); enforcement rides the reminders/expiry sweep (sendReminders.ts:154-184). No Settings surface names the policy; monetary fee capture is prohibited by design (no stored instrument).
Blockers: protected (COMPARE-03 #4 monetary half — never-do; not reopened this session); the behavioural half has no blocker.
Debate summary: A deferred the whole row — the behaviour ships and is protected, so only UI polish remains; B and C both kept a live half: surface the existing force-prepay as a named policy toggle in Settings (B re-priced COMPARE-04's M to S — audit row 6 — because "only the behavioural half is in-scope"), and C: "debate may still open the BEHAVIOURAL half as config; policy-as-feature." C warned the row "will attract fee-capture proposals" — any such drift is a protected-item reopen needing a CEO ruling. The Chair ruled BUILD for the naming toggle (B/C over A), with the monetary half explicitly out of the ruling.
Council ruling: BUILD NEXT — Settings toggle naming the existing force-prepay policy only (Chair; Band 2). Monetary half: PROTECTED, stays dead.
Closure method (if BUILD): Scope = zero behavior change: a named Settings control ("no-shows force full prepay for future bookings") reading/writing the existing require-upfront policy state (crm.ts:293-337); optionally the cancel-window → auto-flag rule as settings (B). Entity changes: none. Endpoint changes: settings blob GET/PUT only (tenant.ts:1185-1204 pattern). UI changes: Settings row + agent-facing copy, both locales ("A no-show loses the right to book free — automatically" — D's sentence, am/en same commit). Test additions: money-gate case pins the forced-prepay flip — "auto-flagged phone forced to prepay; no fee amount anywhere" (C); pending/`cancels_at` behaviour unchanged.
Substitute method (if any): none — the deterrent already fires today (D: "day 2"); this row makes a live protection visible, not new.
Owner: Engineering Lead
Effort: S (B's audit flips COMPARE-04's M — deviation recorded: only the behavioural half is in-scope)
Money path: NO — names an existing money-adjacent protection (register lists E-ts-03 as CAUTION-adjacent; the toggle records and displays nothing new; gate case pins no-fee)
Protected decision referenced (if any): COMPARE-03 item 4 — no-show/late-cancellation FEE capture is dead (no stored instrument; item 2 for the instrument); AGENTS.md never-do on stored cards. This ruling does not touch it; any fee proposal is a reopen request, CEO authority only (rule 7).
EGE-ADVANTAGE collision (if any): none — the behavioural answer (flag the phone, force prepay) IS the recorded divergent design (COMPARE-03 §"strategy, not shortfall").
Merchant evidence: OBSERVED-workaround-shipped, day-1 y (D: "the half-built engine is a sales sentence, not a build item"); frequency MED impact.
Confidence: HIGH
CEO ruling (final): Not escalated — council ruling stands (monetary half untouched; no reopen requested).
