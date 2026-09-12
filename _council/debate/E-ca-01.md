# Debate — E-ca-01 Client account & marketplace profile

**Surface (declared per persona):** A: consumer marketplace | B: undeclared (per-row) | C: CM | D: CM (consumer-account) — flag: B carries no surface (Rule 1).

## 1 · Product Owner
Smallest unit: name-only profile editor on /my-bookings. **DEFER** — "identity-lite *is* the market-fit advantage" (E-ca-03 SAME: self-service without accounts — `public.ts:1382-1430` status/cancel/reschedule by opaqueId+phone, verified HIGH); deepening the account surface now adds friction, not activation. EGE-ADVANTAGE note (Rule 8) at E-ca-01. COMPARE-01 F-mp-70. **MED**.

## 2 · Engineering Lead
Effort **M**. Consumer JWT + phone OTP exist (consumer.ts:49-215); `appointments.consumerId` already backfilled (schema.ts:133-135) so a bookings-list endpoint is a scoped select — **S**; profile editor S. **The Fresha record's wallet: not buildable, prohibited** (AGENTS.md cashback/wallets never-do). Failure mode: an account surface showing another consumer's data if scope slips — the inline-eq law applies cross-consumer. Crons: none. **HIGH**.

## 3 · Council
**GREEN-with-conditions** (CM). Bookings list + profile editor on the existing phone-keyed JWT (consumer.ts, OBSERVED). Condition: ship bookings/profile only — the wallet half is COMPARE-03 #6, DO-NOT-BUILD; new editable fields join the erasure matrix. Collision: YES-if-wallet-creep. No CEO-ruling request. **HIGH**.

## 4 · Support/CRM
Impact **LOW (deliberately)**. Workaround (code path): account-free self-service via opaqueId already ships (COMPARE-01:83 — E-ca-03 SAME); "a marketplace profile assumes browsing demand the directory doesn't have yet" (Gap.md:134). UNDOCUMENTED. Day-1: n. Agent sentence (consumer-facing): "You don't need an account — your phone number is your ticket."

## 5 · Challenge round
**A → C:** A defers because the thin account *is* the advantage; C rules GREEN — the list/editor are additive and the wallet is explicitly excluded. Same facts (PARTIAL class), opposite ladder placement.
**B → A:** B notes the bookings-list is an S-sized scoped select on an already-backfilled column — "friction, not activation" doesn't apply to a read-only list.

## 6 · Chair log
- **Agreed:** no wallet ever (#6 protected, uncontested); erasure matrix covers any new editable field; phone-keyed self-service stays first-class.
- **Contested:** DEFER as advantage-protection (A, D) vs GREEN/S-sized read list (C, B); class PARTIAL agreed by all.
- **Escalation:** None. — Register check: no money move/record/promise (the wallet half nobody proposes is already dead law).
- **Closure state:** CONTESTED-DEFER
