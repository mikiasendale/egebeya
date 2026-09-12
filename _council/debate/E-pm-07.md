# Debate — E-pm-07 Tap-to-pay / QR / self-checkout / Pay Now links

**Surface (declared per persona):** A: merchant SaaS | B: undeclared (per-row) | C: merchant SaaS | D: payments section, per-row undeclared — flag: B carries no surface (Rule 1).

## 1 · Product Owner
Split recorded: **(a)** QR *of the existing booking share-link* = **NEXT** — no money movement, rides the E-cs-06 seam. **(b)** payment links that charge outside a booking = **DEFER + ESCALATE** — a brand-new money surface (moves money), one-way door, CEO territory per the money register ("any 'move' is CEO territory"). Evidence: repo-map endpoints verified HIGH — zero payment-link/QR route; v1 never charges. **HIGH**.

## 2 · Engineering Lead
Effort **M** (links only), **L** for self-checkout; the QR itself is **S** (client lib, rides E-cs-06). Reuse `createCheckout` (chapa.ts:54-79); new `payment_links` table + hosted page + webhook branch with `appointmentId=NULL`, `meta.purpose='payment_link'`. Money-path: the webhook purpose discrimination must never let a link payment reach `activateProSubscription`/`countFoundingCohort` (billing.ts:146-153 — assert it); failure mode is the gate's exact shape (test:60-112). One-way door + CAUTION. **MED**.

## 3 · Council
**RED-needs-CEO-ruling** (MS). This MOVES money outside a booking — LAW 5. Mechanics would reuse directCharge (chapa.ts:81-136) + existing webhook and MUST conform to `processed_webhook_events` idempotency, not fork it (AGENTS never-do). CEO options: (a) merchant-amount links with booking-less payments rows (new `payment_kind`), (b) defer until E-pm-15 refund semantics settle (a refunded link sale hits the missing rail). Standing precondition: `ALLOW_UNVERIFIED_PAYMENTS` must be false first. Collision: NO direct, but dilutes "money moves only inside a booking." **HIGH** exposure / **MEDIUM** Chapa link capability (INFERRED).

## 4 · Support/CRM
Impact **MED-HIGH** (watch the near-term). Workaround (code path): retail sales settle on personal telebirr numbers or cash and vanish from the ledger; the share-link exists for *booking* not payment (site-generator.ts:195). G4 residual names exactly this: "QR codes and any merchant surface to retrieve the snippet" (FSD-003:97). OBSERVED-workaround. Day-1: n. Money: **MOVES — CEO territory per LAW 5; only the link-generation half is product.**

## 5 · Challenge round
**B → A:** B specs `payment_links` as a buildable M with a named webhook assertion; A parks the same half entirely with the CEO.
**C → B:** C rules the whole row RED-needs-CEO including the webhook design; B's "assert the purpose filter" presumes the CEO has already allowed the money move.
**A → C:** C's E-pm-06 substitute is the Pay-Now QR at the counter — but C also blocks Pay-Now; the split (a) frees C's own substitute.

## 6 · Chair log
- **Agreed:** QR of the existing share-link moves no money and is separable (A(a), B "QR is S", D "only the link half is product").
- **Contested:** whole-row RED-needs-CEO (C) vs split-and-ship-half (A, B); D prices merchant pain MED-HIGH while A's ladder puts the buildable half at Band 2.
- **Escalation:** ESCALATE: does the CEO authorize money to move outside booking+subscription via payment links (C option a), contingent on `ALLOW_UNVERIFIED_PAYMENTS=false` and on E-pm-15 refund posture? Register check: this is the one "move" in the payments debate that any persona seeks.
- **Closure state:** AWAITING-CEO
