ID: E-ar-04 (+ Fresha pairs F-sa-182, F-sa-183)
Name: Client-source attribution & ads conversion tracking
Surface: merchant SaaS (attribution view; capture rides the consumer booking flow)
Category: analytics-reporting
Class: GAP (split ruling: attribution half GAP-buildable; pixels reclassified G2-dead)
Fresha behaviour: Tells merchants which channel (Telegram, directory, Instagram, ads) brought each client, and lets them attach GA/Meta conversion tags. KB: COMPARE-01:173-174 (hc/15; hc/103391,448,449), docs/Gap.md:286-289.
Egebeya current state: appointments.bookingSource exists with online|walk_in semantics (src/db/schema.ts:145-147, verified; docstring-vs-code disagreement flagged in COMPARE-02 §G); tenant-level acquired_via_code only (schema.ts:19-20); no GA/Meta tags in src/pages/PublicBooking.tsx.
Blockers: none for the attribution half; legal+money for pixels (third-party PII consent, PDPL cross-border — C §4 ruling request 12)
Debate summary: A scoped the smallest unit as carrying a `src` param from share/widget URLs through POST bookings into the EXISTING appointments.bookingSource column — "half the plumbing already exists" — with pixels as G2-dead rails; NEXT (T7.16 minus the pixel tail). B priced M and proposed an additive `booking_source_detail` carried through BookingSchema (public.ts:596-621), deferring pixels as a separate consumer-PII consent decision. C split the row: attribution AMBER-buildable, pixels RED-needs-CEO-ruling. D contested how much bookingSource plumbing is trustworthy given the §G semantics disagreement, and noted T7.16 waits per LEDGER:26. Chair cleared: attribution ships NEXT on the existing column; "pixels ship never without a ruling."
Council ruling: BUILD NEXT (attribution); pixels SKIP (G2 rails absent market; no Meta/GA consent surface)
Closure method (if BUILD): scope: per-booking channel attribution riding the existing appointments.bookingSource column — extend its accepted values beyond online|walk_in and carry a `src` param from share links (site-generator.ts shareLinkFor) and widget URLs through the booking POST (public.ts:596-621 BookingSchema). Entity changes: no new column for v1 (bookingSource is the source of truth; §G semantics resolved by the tests below, not by a parallel field — B's booking_source_detail idea stays a recorded alternative). Endpoint changes: public booking POST accepts optional src; merchant bookings/analytics read paths surface it. UI changes: source shown on merchant booking rows and per-source counts on the dashboard; share/QR URLs gain the src param; am/en for all strings. Test additions: src values persist per booking and survive the online|walk_in default; unknown src falls back safely; cross-tenant isolation (eq(tenantId)); §G docstring-vs-code semantics pinned by an explicit test. No cron touches.
Substitute method (if any): for the skipped pixel half — owned attribution (this row) is the substitute for paid-tag conversion tracking; named trade-off: no ad-platform conversion signals until a consent surface and paid acquisition exist (Season 0 forbids the latter).
Owner: Engineering Lead
Effort: M
Money path: NO
Protected decision referenced (if any): G2 rails gate (feature-selection §G2); C §4 ruling request 12 (pixel consent posture awaits CEO if ever revived); LEDGER:26 sequencing note.
EGE-ADVANTAGE collision (if any): NO (C §3).
Merchant evidence: DECISION-recorded frequency (tenant acquired_via_code exists); workaround = merchants eyeball which shared link a client mentions; notice day 1: n.
Confidence: HIGH (row split agreed by all four)
CEO ruling (final): BUILD NEXT on the existing appointments.bookingSource column; pixels SKIP (G2 rails; Meta/GA absent market).
