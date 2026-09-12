ID: E-cs-06 (+ Fresha pair F-sa-242)
Name: Book button / embed / share link (QR + snippet)
Surface: merchant SaaS (snippet retrieval); the QR lands the consumer on the marketplace booking page
Category: content-site
Class: PARTIAL
Fresha behaviour: Merchants get a booking link, embeddable button, QR code and one-link-for-everything. KB: COMPARE-01:45 (hc/434; /pricing "Direct booking links — Free"), docs/Gap.md:325-328.
Egebeya current state: iframe embed + share links exist (src/pages/EmbedBooking.tsx:17-42; site-generator.ts:195 shareLinkFor/GET share-link, verified); no QR surface and no merchant-visible snippet block (the recorded G4 residual, FSD-003:97).
Blockers: none
Debate summary: A's smallest unit: QR of the existing share-link + a copy-the-snippet block in the dashboard — NEXT, in the Band 2 Share & QR bundle, paired with "the E-pm-07 QR half." B priced S: QR is a client-side lib over the same URL; "the one-link-for-everything is an aggregation page, not infra"; WordPress is a docs page. C GREEN with the hard condition of no PII (no phone/token) in QR payloads and low-end Android share-flow integrity (EGE-ADV #10). D rated impact MED-HIGH: Instant Empire's whole acceptance is sharing to Telegram within 5 minutes of signup (ROADMAP §1) — "sharing exists; printing is the gap"; notice day 1: yes. Chair cleared S-sized QR+snippet standalone and split the pair so the booking-QR is not hostage to the pay-link money ruling; A's coupling vs B's standalone stayed contested until CEO ruling 5 approved the share-link QR explicitly.
Council ruling: BUILD NEXT
Closure method (if BUILD): scope: client-side QR encoding of the tenant's existing share/booking URL + a copy-the-snippet block in the dashboard (the G4 snippet-retrieval residual); WordPress guidance ships as a docs page only. Entity changes: none. Endpoint changes: none (rides GET /api/tenant/share-link, site-generator.ts:195; QR generated in the browser). UI changes: Share & QR card in the merchant dashboard: QR render, download/share via the Android share sheet, snippet textarea with the existing iframe markup; am/en strings. Test additions: QR payload equals the tenant booking URL and contains no PII token/phone (C condition); snippet matches the embed component's contract; low-end Android share-flow check (manual QA noted in the PR); no new server surface to test. (Pay-link QR is ruling 5's narrow half and ships on that row's schedule — this row must not queue behind it; Chair split.)
Substitute method (if any): none.
Owner: Product Owner
Effort: S
Money path: NO (CEO ruling 5: "QR of share-links ships as approved (no money)")
Protected decision referenced (if any): ruling 5 (E-pm-07 narrow scope — this QR is the share-link half, never an ad-hoc charge surface); EGE-ADV #10 (low-end Android share flow).
EGE-ADVANTAGE collision (if any): NO (C §3).
Merchant evidence: OBSERVED-workaround frequency (no merchant-visible snippet/QR surface, code-proven dead gap); workaround = copy the URL from a browser and retype it; notice day 1: y.
Confidence: HIGH
CEO ruling (final): BUILD NEXT — QR + snippet riding the share link; this is the QR half of ruling 5.
