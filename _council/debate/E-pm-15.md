# Debate — E-pm-15 Refunds & deposit refunds

**Surface (declared per persona):** A: merchant SaaS (section) | B: undeclared (per-row) | C: **CM+MS** | D: payments section — flag: C adds consumer marketplace (the refund promise faces consumers); B carries none (Rule 1).

## 1 · Product Owner
Split ticket: **(a) copy fix NOW** — the landing page promises "Refunded automatically if the business cancels" (`en.json:63` verified HIGH) while cancel says "A refund must be issued manually" (`public.ts:1283-1285`) and the cron says never-automatic; "a false public money promise is a defect, not a backlog item" (FSD-002 Duties). **(b) one-tap "refund issued" ack = NEXT** (records a manual act, no movement). **(c) Chapa refund initiation = DEFER + ESCALATE** (moves money). CAUTION on (b)/(c). **HIGH**. (A's escalation #2 covers (c) only.)

## 2 · Engineering Lead
**Copy S / recorded-M.** Fix both locales first — it's a defect (T7.9a, `Landing.tsx:1029` ↔ en.json). Chapa lib has **no refund call** (exports verified: create/initiate/authorize/verify) → platform-initiated refund = **NOT-feasible-without-Chapa-refund-API-confirmation**; honest substitute = owner "refund issued" ack stamping `payments.meta` + bilingual email. Money-path gate cases (chain-payments-billing.test.ts register): ack idempotent, stamps meta, never mutates invoice/settlement; **landing-copy == cancel-text test**. CAUTION. **HIGH**.

## 3 · Council
**RED-needs-CEO-ruling + one mandatory fix** (CM+MS). Do not blend: (1) **the lie** (en.json:63 vs public.ts:1283-1285, OBSERVED) is a DUTY per LEDGER:20 (T7.9) — fix the copy or make it true; consumer-protection + PDPL-fairness exposure. (2) **the rail**: chapa.ts has no refund call (OBSERVED); whether Chapa offers one is absence-ledger (INFERRED, L-confidence). CEO options: (a) copy fix only (manual stays), (b) verify-then-instruct — platform records refund-owed, merchant executes in Chapa dashboard, reconciled via settlement rows: money *recorded*, not moved; (c) full API refunds — needs capability + custody posture review, flirts with #1/#7. **Recommend (a)+(b).** No COMPARE-03 collision. **HIGH** on contradiction.

## 4 · Support/CRM
Impact **HIGH — a DUTY, not a feature** (T7.9). `en.json:63` → Landing.tsx:1030 vs `public.ts:1283-1285`; FSD-002:190-193 rules it a launch defect; LEDGER.md:20 marks DUTY?. "Every refund an agent's merchant cannot execute through the product is a Telegram DM to the founder — the support queue I own." OBSERVED-workaround (documented false promise). Day-1: **y** — first business-cancelled booking teaches everyone. Money: **PROMISES today, would MOVE on fix — CEO final call.**

## 5 · Challenge round
**D → A:** D flags the whole row (incl. the ack path) as a founder-ticket fire ranked HIGH; A sequences the ack as merely NEXT and treats only (c) as escalated.
**C → B (evidence class):** B treats the missing Chapa refund call as an OBSERVED export-list fact reclassifying (c) NOT-feasible-without-API-confirmation; C treats rail existence as absence-ledger INFERRED L — same conclusion, different evidentiary footing for the CEO's read.

## 6 · Chair log
- **Agreed:** the copy fix ships NOW regardless of any ruling — all four call the landing-vs-cancel contradiction a defect/duty; the ack stamp is money-recorded, never a movement.
- **Contested:** rail capability evidence class (B OBSERVED-exports vs C INFERRED-absence); D grades the entire row HIGH-day-1 vs A's a=NOW/b=NEXT/c=NEVER split.
- **Escalation:** ESCALATE (C ruling #1): refund posture — (a) copy fix only, (b) record-refund-owed + merchant executes off-platform, or (c) Chapa API refunds (capability INFERRED-unverified, custody review)? Register check: today the platform *promises* money (duty fix not escalated); (c) would *move* money — CEO territory.
- **Closure state:** AWAITING-CEO
