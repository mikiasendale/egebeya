# Debate — E-cs-06 Book button / embed / share link
**Surface (declared per persona):** A: merchant SaaS | B: n.d. per row | C: CM | D: merchant SaaS

## 1 · Product Owner
- Smallest unit: QR of the existing share-link + copy-the-snippet block in the dashboard (share-link endpoint verified HIGH, site-generator.ts:195).
- **NEXT**, "pairs with the E-pm-07 QR half." WordPress path **DEFER**. Band 2 #13 (Share & QR bundle). **HIGH**

## 2 · Engineering Lead
- **S**. iframe embed + share links exist (EmbedBooking.tsx:17-42; site-generator.ts:195); QR = client-side lib on the same URL; "the one-link-for-everything is an aggregation page, not infra"; WordPress = a docs page. Crons: none; first-weeks-eligible. **HIGH**

## 3 · Council
- **GREEN-with-conditions** | CM. QR is client-side encoding of the tenant booking URL — no new data, **no PII in the URL** (no phone/token in QR payloads).
- Condition: QR must work on the low-end Android share flow (EGE-ADV #10). Collision: NO. **HIGH**

## 4 · Support/CRM
- Impact **MED-HIGH (it's the QR)**: Instant Empire's whole acceptance is "a salon owner shares her site to Telegram within 5 minutes of signup" (ROADMAP §1) — "sharing exists; **printing** is the gap"; a mirror QR converts the walk-in who won't type a URL. Merchant snippet-retrieval is the recorded G4 residual (FSD-003:97).
- Evidence: OBSERVED-workaround (no merchant-visible snippet/QR surface). Day 1: **y**.

## 5 · Challenge round
**A → C:** A pairs this row with "the E-pm-07 QR half"; C classifies E-pm-07 RED-needs-CEO-ruling — C's clean, no-PII booking-QR build must not queue behind the pay-link money ruling.
**B → A:** B prices it S/first-weeks-eligible standalone; A holds it NEXT and couples it to a money-pending sibling.

## 6 · Chair log
- **Agreed:** S-size client-side QR + snippet block over the existing share URL; no PII in QR payloads; honors the low-end Android share flow.
- **Contested:** coupling to E-pm-07's QR half (A) vs shipping standalone (B); the pair should split so the booking-QR is not hostage to the pay-link ruling.
- **Escalation:** None.
- **Closure state:** CLEARED
