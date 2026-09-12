# Debate — E-ai-04 Social-surface booking (Google Reserve / Meta)
**Surface (declared per persona):** A: merchant SaaS | B: n.d. per row | C: CM | D: merchant SaaS

## 1 · Product Owner
- **DEFER / rails-dead** — G2 kill stands (FSD-002 kill table: "integrations do not serve Ethiopian venues").
- EGE-ADVANTAGE note: the public /v1 API (E-ai-01) is *our* integration surface and is protected — "build *out* from it, not imitatively inward." **HIGH**

## 2 · Engineering Lead
- **M code, NOT-feasible-without-partner-approval**. Feed side rides the JSON-LD work in E-ds-06 ("S, do that now"); the booking-action side needs Google Business Profile verification + Meta's partner surfaces — external gating, not our infra.
- Reclassify: **NOT-feasible-without-X (third-party partnership)**. Crons: none. **MED**

## 3 · Council
- **RED (rails)** | CM. LEDGER:64 G2-dead; EGE-ADV #17 makes Egebeya API-*out*, not API-dependent-in — collision with the protected public /v1 API (E-ai-01) if built imitatively inward.
- Rule-20 substitute (mandatory, named): the Ethiopian social surface is Telegram — deepen the existing bot (EGE-ADV #15, linking/webhook observed) into a book-from-Telegram chat flow + shareable deep link/QR for Instagram-bio culture. Trade-off: zero Google/Meta panel presence; acceptable while the market lives on Telegram. **HIGH**

## 4 · Support/CRM
- **none-in-addis-today**: FSD-003 S-11 scores it value 9 — "a distribution wish, not a feature." Workaround already shipped: Instagram bio link = the tenant page.
- Listed in §3 "What NOT to build." Evidence: DECISION-recorded (G2). Day 1: **n**.

## 5 · Challenge round
**B → A:** B carves an actionable feed-side half (JSON-LD riding E-ds-06, "S, do that now"); A's ruling is whole-row DEFER with no such carve — the same row as half-dead vs half-now.
**C → D:** C's substitute is a build (Telegram chat booking flow); D holds that the bio-link-is-tenant-page workaround already absorbs the demand — how deep the named substitute must actually go is contested.

## 6 · Chair log
- **Agreed:** no Google/Meta booking-action build (rails external, market dead per G2/S-11); Rule-20 substitute + trade-off recorded (Telegram booking; no panel presence).
- **Contested:** feed-side JSON-LD half separable now (B); substitute depth (C's build vs D's already-shipped workaround).
- **Escalation:** None.
- **Closure state:** CLEARED
