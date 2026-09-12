ID: E-pm-07 (+ Fresha pair F-bh-47)
Name: Tap-to-pay / QR / self-checkout / Pay Now links
Surface: merchant SaaS + consumer marketplace (named pair: merchant generates link/QR; consumer lands on the charge)
Category: payments-money
Class: GAP (COMPARE-01 — no payment-link/QR route; v1 never charges)
Fresha behaviour: Tap-to-pay, QR self-checkout and Pay-Now links charge a consumer outside any booking (hc/381,383,382,101717). KB provenance: OBSERVED.
Egebeya current state: Only booking prepay + subscription checkout exist; the share-link serves bookings, not payments (src/api/public.ts:736-1235; src/api/v1.ts:158-307; src/lib/site-generator.ts:195).
Blockers: money (a "move" outside booking — LAW 5) — resolved by ruling 5; standing precondition: ruling 1 (ALLOW_UNVERIFIED_PAYMENTS=false, render.yaml:26)
Debate summary: A split the row — QR of the existing share-link ships NEXT (no money), charging links escalate; B priced links at M with a concrete `payment_links` table + webhook-branch design and a purpose-filter assertion; C ruled the whole row RED-needs-CEO because the webhook design presumes the money move is authorized; D priced merchant pain MED-HIGH (retail settles on personal telebirr and vanishes from the ledger). The clash: whole-row escalation (C) vs split-and-ship-half (A/B), with C's own E-pm-06 substitute depending on the half A freed.
Council ruling: SPLIT — (a) QR half: BUILD NEXT (no money); (b) charging links: was AWAITING-CEO, now BUILD NEXT restricted per CEO ruling 5; ad-hoc charging: SKIP per CEO
Closure method (if BUILD): (a) QR of the existing booking share-link — client-side encoding, rides E-cs-06, no entities, no endpoints, no money. (b) links may ONLY charge against an existing booking balance or a platform/merchant invoice reference — never ad-hoc amounts (ruling 5, C option (a) narrowed). Entity: `payment_links` table + payments rows tagged `meta.purpose='payment_link'` with the booking/invoice reference required; endpoints: hosted link page + webhook branch that MUST conform to `processed_webhook_events` idempotency, not fork it (AGENTS never-do). UI: merchant link generator; consumer charge page. Tests (MONEY — NEW cases in server/tests/chain-payments-billing.test.ts): a `payment_link` webhook can never reach `activateProSubscription`/`countFoundingCohort` (billing.ts:146-153); replay of the same link webhook is a no-op; a link without a booking/invoice reference is rejected at creation.
Substitute method (if SUBSTITUTE/DEFER-with-substitute): ad-hoc charging has none — the CEO declined that half outright.
Owner: Engineering Lead
Effort: S (QR half) + M (restricted links half)
Money path: YES for (b) — CAUTION (it MOVES money; the only sanctioned move outside booking+subscription this file); (a) NO
Protected decision referenced (if any): none reopened; conforms to protected webhook idempotency (AGENTS.md never-do); dilution of "money moves only inside a booking" is the CEO's ruling-5 call
EGE-ADVANTAGE collision (if any): none
Merchant evidence: MED-HIGH frequency, near-term; OBSERVED workaround — retail sales settle on personal telebirr numbers or cash and never enter the ledger; G4 residual names "QR codes and any merchant surface to retrieve the snippet" (FSD-003:97).
Confidence: HIGH on the split; MEDIUM on Chapa link capability (INFERRED, absence ledger)
CEO ruling (final): Ruling 5 — "E-pm-07 Payment links — narrow: links may only charge against an existing booking balance or a platform/merchant invoice — never ad-hoc. QR of share-links ships as approved (no money)." Ruling 1 is the precondition.
