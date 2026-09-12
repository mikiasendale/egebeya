# Debate — E-ts-02 Report / reply to reviews (GAP, Gap.md:218-221)
**Surface:** A: consumer marketplace / platform | B: none declared per row | C: CM + PL | D: merchant SaaS (section header) but treats it consumer-trust. Broadly aligned.

## 1 · Product Owner
Smallest unit: none — **DEFER** behind E-mg-05; nothing to report (no reviews table, verified HIGH). COMPARE-01 F-mp-281. **HIGH**.

## 2 · Engineering Lead
**M, after E-mg-05.** content_reports + admin PATCH queue already exist for merchants (trust.ts:43-84; admin.ts:512-568) and are the moderation pattern to copy. Zero reviews to moderate today (no table). Crons: none. Dep: E-mg-05 entity. **HIGH**.

## 3 · Council
**AMBER (dependency-blocked)** | CM+PL. No reviews table (OBSERVED) — nothing to moderate. Sequence after E-mg-05 and inherit its duties: platform holds report evidence away from the accused merchant (EGE-ADV #12, schema.ts:525-542 rationale), stated SLA like the 7-day report path (trust.ts:75-79). Collision: NO. **HIGH**.

## 4 · Support/CRM
Impact: **none-in-addis-today.** No reviews table; nothing to report (Gap.md:221). Egebeya's shipped trust surface is consumer→platform reporting of *merchants* with evidence held off tenant storage (trust.ts:43-84; COMPARE-01:219) — "keep that, don't clone the review-moderation product before reviews exist." frequency: structurally N/A. Day-1: **n**.

## 5 · Challenge round
No challenges — unanimous dependency-block behind E-mg-05.

## 6 · Chair log
- **Agreed:** defer behind E-mg-05; existing consumer→platform report path (EGE-ADV #12) is the moderation template.
- **Contested:** None.
- **Escalation:** None.
- **Closure state:** CLEARED
