# Debate — E-mg-02 Deals & promotions (PARTIAL, Gap.md:236-239) — MONEY-REGISTER CAUTION
**Surface:** A: merchant SaaS | B: none declared per row | C: MS | D: merchant SaaS. No clash.

## 1 · Product Owner
A splits this feature. Half under debate = **lying-widgets half (honesty sweep T7.17)**: `WIN10` hardcoded (WinBackWidget.tsx:56-62, matrix-cited) ships **NOW** inside T7.17. The deal wrapper (window+audience+redemptions from `usedCount`) is **NEXT**. CAUTION (touches price semantics; up-pricing remains impossible per COMPARE-03 item 8). COMPARE-04 T7.14. **HIGH**.

## 2 · Engineering Lead
**M.** First the bug: WinBackWidget.tsx:56-62 shows `WIN10`, MarketPulseWidget.tsx:126-130 shows "15% off" — neither mints a real code; CustomerHealth does (crm.ts:98). "Every UI-produced discount must be redeemable (T7.14)." Then a thin deal wrapper over promo_codes + usedCount perf. CAUTION: in-tx promo re-check (public.ts:921-927) is law; upward price adjustment stays impossible (COMPARE-03 item 8). Crons: none. Independently first-weeks-eligible: "E-mg-02's WIN10-lie bugfix." **HIGH**.

## 3 · Council
**AMBER-with-conditions** | MS. Promo engine exists (schema.ts:302-318 + validation public.ts:816-845). Flash deals = time-windowed promos, additive discounts only — Math.max(0,…) floor and down-only direction (COMPARE-03 #8 protects: discounts fill idle, no surge). Condition: deal-performance view rides E-ar-02. Collision: NO. Money-gate case: "every UI-string discount redeems at the discounted amount; upward adjustment still impossible." **HIGH**.

## 4 · Support/CRM
Impact: **MED, plus a lie to kill.** Promo codes + quiet-hours ship (Gap.md:239); flash-sale engine absent. Day-1 defect: both widgets mint no code, both fail at booking (FSD-002:119-121; T7.14's bug-half promoted into T7.17). "A merchant who sends a dead code to 40 clients learns twice: the product lied, and their name is on it. Fix first; engine later." frequency: OBSERVED-workaround (lying widgets, code-proven). Day-1: **y** (via the bug).

## 5 · Challenge round
No challenges — all four separate the bug (NOW, T7.17) from the engine (NEXT, T7.14); FSD-002's T7.14→T7.17 split is confirmed (A §2).

## 6 · Chair log
- **Agreed:** kill the WIN10/15%-off lies now (redeemable or removed); deal wrapper next; discounts down-only, never up (COMPARE-03 #8).
- **Contested:** None.
- **Escalation:** None (records/promises no new money semantics; promo path already gated).
- **Closure state:** CLEARED
