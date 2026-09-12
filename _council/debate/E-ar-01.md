# Debate — E-ar-01 Reporting & analytics (merchant)
**Surface (declared per persona):** A: merchant SaaS | B: n.d. per row | C: MS | D: merchant SaaS

## 1 · Product Owner
- Smallest unit: render the already-fetched payload — `src/pages/Dashboard/index.tsx:597-598` declares `weeklyRevenue`/`weeklyDaily`, fetch sets at :641-650, grep confirms **no other reader** (verified HIGH).
- Zero new server code; "cheapest Pro-conversion asset." **NOW** — Band 1 #3 (T7.8). **HIGH**

## 2 · Engineering Lead
- **S** (T7.8). The endpoint computes 7-day revenue/bookings/top services/repeats (`tenant.ts:450-546`); dashboard fetches and discards (index.tsx:597-598,641-650).
- Pure render job + role rule: staff never see revenue (`bookings.ts:23-41`). Crons: none. Listed as independent-of-everything, first-weeks-eligible. **HIGH**

## 3 · Council
- **GREEN** | MS. Pure render of an endpoint that already computes; T7.8 shortlist 23 (LEDGER:14).
- Conditions: demo/seed exclusion preserved; am/en labels. "The cheapest honesty win in the 68 — stops the dashboard *looking* dead." Collision: NO. **HIGH**

## 4 · Support/CRM
- Impact **HIGH**; #3 on the daily-grind top-10. Workaround code path: the owner counts cash in the evening.
- Evidence class: OBSERVED-workaround (computed-but-unrendered, code-proven).
- Caveat: the cash-invisible note ships on the card face (FSD-002:98-100) "otherwise this feature *becomes* the E-pm-18 complaint." Notice day 1: **y**.

## 5 · Challenge round
No challenges.

## 6 · Chair log
- **Agreed:** render-only diff ships this cycle; all four rate it the cheapest row in the file; no server change, no money touch.
- **Contested:** None.
- **Escalation:** None.
- **Closure state:** CLEARED
