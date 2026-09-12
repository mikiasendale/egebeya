ID: E-ms-04 (+ Fresha pair F-sa-93)
Name: Time-off types (absence taxonomy + request/approval)
Surface: merchant SaaS (A/C/D declared; B's paper-wide gap noted — no clash)
Category: merchant-scheduling
Class: GAP (COMPARE-01:105, :310)
Fresha behaviour: Merchants record absence with types (sick, holiday) and use request/approval flows. (OBSERVED — hc/582; hc/21.)
Egebeya current state: No time-off table, no absence record, no request or approval anywhere (src/db/schema.ts — verified HIGH by A; D confirms Gap.md:189).
Blockers: none hard; the row is HR-shaped and C flags an employment-adjacent PDPL duty if types ever encode health status.
Debate summary: All four DEFERred, and the Chair logged it CLEARED with no contest: A — request/approval assumes HR, closures + per-weekday availability cover the real behavior for 3-staff shops; B priced M but named the true cost (dated unavailability must flow through assertSlotAllowed — the availability model only understands day-of-week); C AMBER with the duty that absence types must stay non-medical labels, because sick-vs-leave taxonomies are staff special-category data; D rated impact LOW and listed the row among the "HR-grade surfaces for 1-3 person shops" the market-fit axis kills — a sick day today is the owner deleting a booking.
Council ruling: DEFER (with named substitute below; re-entry needs a dated-unavailability path through the availability model — naturally E-ms-05's terrain after T6.4 — and C's non-medical-labels condition on the day types exist).
Closure method (if BUILD): N/A — DEFER.
Substitute method (if any): mechanic — E-ms-03 closures (once written) plus per-weekday staff availability windows (tenant.ts:373) cover the observable behavior: the day simply is not bookable. Named trade-off (per this session's directive): no sick/holiday taxonomy on the record and no request/approval trail — the "why" of the absence is invisible to the owner's own history, which is exactly what keeps it out of staff special-category data for now.
Owner: Product Owner
Effort: M (B, if ever built)
Money path: NO
Protected decision referenced (if any): none; PDPL special-category duty (C) recorded as a condition, not a gate.
EGE-ADVANTAGE collision (if any): NO (C).
Merchant evidence: frequency UNDOCUMENTED; workaround OBSERVED-in-practice (owner deletes a booking / messages off shift); day-1 n (D).
Confidence: HIGH
CEO ruling (final): Not escalated — council ruling stands.
