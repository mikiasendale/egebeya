# Debate — E-ca-02 Notification & marketing preferences

**Surface (declared per persona):** A: consumer marketplace | B: undeclared (per-row) | C: CM | D: CM (consumer-account) — flag: B carries no surface (Rule 1).

## 1 · Product Owner
Smallest unit: consumer prefs GET/PUT + "STOP everything" + Telegram `/stop` consumed in the existing webhook (T7.12). **NOW — as a DUTY, not a scored candidate** — consent captured in three places but withdrawn only on the merchant's CRM (`crm.ts:246-291` verified HIGH); PDPL 1321/2024 wants parity; blast appends "Reply STOP" and nothing reads it. One-way door; FSD-001's DUTY flag is right. **HIGH**.

## 2 · Engineering Lead
Effort **M** (COMPARE-04 said S — audit). Consent lives in three stores: `customer_stats.marketingOptIn` (schema.ts:288-292), `consumers.consentGivenAt` (:455-461), `telegram_links.consentGivenAt` (:420-429) — a consumer PUT must lower all three consistently and stamp withdrawal ("withdrawal as easy as grant"). Telegram `/stop` hooks the live webhook (telegram.ts:36). The SMS "Reply STOP" (crm.ts:206) has **no inbound path — sms.ts is send-only**; full SMS STOP = NOT-feasible-without-inbound-SMS-provider → ship centre + Telegram stop, delete or footnote the SMS promise. Affects cron W and blast (opt-in read SQL-side). No money-path gate; not in the payments register. **HIGH**.

## 3 · Council
**GREEN — classify as DUTY, ship before marketing expansion** (CM). PDPL 1321/2024 makes withdrawal a right, not a rankable feature (LEDGER:19, T7.12 DUTY?); merchant-only toggle (crm.ts:246-291) is "backwards for PDPL." Conditions: consumer toggle + STOP handling with recorded timestamps; `marketing_opt_in` stays real consent (never fabricate); gates E-mg-01 blasts and E-an-06 marketing sends. EGE-ADV #13 (PDPL-as-product) *strengthened*, not collided. **HIGH**.

## 4 · Support/CRM
Impact **HIGH as a DUTY (T7.12), LOW as a feature**. Workaround (code path): suffix "Reply STOP to opt out." (crm.ts:206) with **nothing reading the reply** (FSD-002:189) — "every un-honored STOP is a PDPL 1321/2024 exposure and a support ticket to the founder." OBSERVED-workaround (the suffix lies until a handler exists). Day-1: **y** — for the spammed consumer, which is the merchant's reputation. Product sentence: "reply STOP and we actually stop."

## 5 · Challenge round
**B → A:** A's unit says "STOP everything"; B shows the SMS half is NOT-feasible-without-inbound-provider — the promise must be deleted/footnoted, so A's wording over-delivers unless Telegram-only is stated.
**A/B vs COMPARE-04 (effort fact):** A and B both re-score the ledger's "S" (three consent stores / M); the class is PARTIAL by all.

## 6 · Chair log
- **Agreed:** ships NOW as a duty before any marketing expansion; PDPL withdrawal parity is the JTBD; gates blasts and marketing sends.
- **Contested:** whether the SMS "Reply STOP" promise is kept pending an inbound provider (B: delete/footnote) vs A's "STOP everything" scope; effort fact S (COMPARE-04) vs M (A, B).
- **Escalation:** None. — Register check: consent state only, no money move/record/promise.
- **Closure state:** CLEARED
