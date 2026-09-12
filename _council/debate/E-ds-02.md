# Debate — E-ds-02 Treatment-level search
**Surface (declared per persona):** A: consumer marketplace | B: not declared per row | C: CM | D: consumer marketplace (paper-level)

## 1 · Product Owner
- Smallest unit: add a `services.name LIKE` join to /discover — the treatment entity already exists (schema.ts:67 services, verified HIGH). The tt-page grammar is out.
- **DEFER** with trigger: after E-ds-06 cards ship and `search_intent` shows typed queries.
- Cites COMPARE-01 F-mp-02; `public.ts:113-117` name-only. MED.

## 2 · Engineering Lead
- **M** (the true tt-spine tail is **L**): v1 = join services and LIKE is S/M (schema.ts:67-75 free-text name); canonical treatment taxonomy + treatment×geo grammar is a content-system project.
- Crons: none. Failure if rushed: tenant-named services ("Special Gel-X") give junk results without the canonical layer. Dep: E-ds-01. MED.

## 3 · Council
- **AMBER-with-conditions**: build treatment as a searchable label on existing service rows, NOT a new canonical entity with its own pricing/SEO page grammar; search stays inside `/api/public/discover` (public.ts:113-117) with inline `eq(tenantId)` intact (AGENTS law).
- Collision: NO; but "a grammar without inventory is slop" (Rule 18). Confidence MEDIUM (KB GAP 10).

## 4 · Support/CRM
- Impact LOW. frequency: UNDOCUMENTED — consumers ask on Telegram, answer is a screenshot (KB-PATTERN SUBSTITUTE, not Egebeya evidence); no treatment entity (COMPARE-01:25).
- Workaround/copy defect: the Discover placeholder already lies — "Search for a business or service…" (Discover.tsx:122) — "fix the copy or build the feature". Day-1 notice: **n**.

## 5 · Challenge round
**B → A:** B prices v1 as S/M riding schema.ts:67-75; A still **DEFERs** on demand signal (A: public.ts:113-117 + search_intent trigger | B: v1 join is cheap, dep E-ds-01).
**D → A:** A defers the whole row; D says the placeholder promise fails silently today and the one-line honesty fix belongs in the T7.17 family regardless (A: DEFER | D: Discover.tsx:122, §4).

## 6 · Chair log
- **Agreed:** v1 = LIKE over existing service rows; no new canonical treatment entity; eq(tenantId) law preserved.
- **Contested:**
  - Urgency: A DEFER-with-trigger vs B "S/M now" vs C AMBER (buildable with conditions) vs D LOW.
  - Canonical layer: B wants it for result quality; C forbids a new canonical entity/grammar — same code, opposite prescriptions.
- **Escalation:** None.
- **Closure:** CONTESTED-DEFER
