# Debate — E-mg-05 Review engine, collect/reply/report (GAP, Gap.md:240-243)
**Surface:** A: merchant SaaS (section header) | B: none declared per row | C: CM + MS | D: merchant SaaS. Flag: row is intrinsically dual-surface (merchant collects, consumers see) — C's CM+MS naming is the sharpest.

## 1 · Product Owner
Smallest unit: reviews table + post-visit 1–5 SMS *riding the same completed-appointment transition T7.4 already adds* + aggregate display (unblocks E-ds-05, seeds E-mg-07). **NEXT-cycle minimal**; reply/report/moderation UI (E-ts-02) DEFER. No reviews entity verified HIGH. Review-seed bundle: E-mg-05(minimal)+E-ds-05+E-ar-02+E-mg-01 (A §3). **MED**.

## 2 · Engineering Lead
**L.** Reviews entity + post-visit invite (hook exists: completed transition, bookings.ts:107-121) + reply/moderation + abuse posture in a one-reputation market — "fake-review exposure is existential here." Google sync: separate L. **"Lite shape (verified-visit only, no photos, 24h publish grace) is still L."** Gates E-ts-02, E-ds-05. Crons: R-adjacent. **MED**.

## 3 · Council
**AMBER-with-conditions** | CM+MS. Invites ride free messaging (no #2 collision — transactional, not marketing). Duties: (a) public UGC — consumer deletion must delete reviews (erasure matrix); (b) fake/extortion moderation = standing labour cost for a solo operator — "honestly price that"; (c) static testimonials (puck.config.tsx:303) must be visually separated from real reviews. Google sync deferred (rule 9 INFERRED). Sequencing: after E-ca-02. Collision: NO. **MEDIUM** (merchant-app review UI unobserved).

## 4 · Support/CRM
Impact: **LOW-MED.** No review entity, no post-visit prompt (Gap.md:243). Sequencing from D's seat: reviews need E-an-04's thank-you message as their delivery truck — build the catalog first (Rule 13). Workaround: owner screenshots compliments into a marketing deck that reads a localStorage key production never sets (MarketingDeck.tsx:12-24) — "a dead surface on top of a missing feature." frequency: UNDOCUMENTED. Day-1: **n**.

## 5 · Challenge round
**B → A:** A's "smallest unit / NEXT-cycle minimal" vs B's audit that even the lite shape is L — the minimalism claim is contested.
**D → A:** D puts the message catalog (E-an-04) strictly before review invites; A already rides T7.4's transition, so compatible in ladder, contested as stated order.

## 6 · Chair log
- **Agreed:** reviews table is the seed for E-ds-05/E-ts-02/E-mg-07; post-visit invite is transactional (no #2 collision); after E-ca-02; erasure + moderation duties named.
- **Contested:**
  - Effort/scope: A "minimal NEXT-cycle" vs B "lite is still L".
- **Escalation:** None.
- **Closure state:** CONTESTED-DEFER
