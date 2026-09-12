# Debate — E-ts-03 No-show protection as a policy engine (PARTIAL, Gap.md:223-226) — MONEY-REGISTER CAUTION
**Surface:** A: consumer marketplace / platform (section header) — but row is merchant SaaS | B: none declared per row | C: MS | D: merchant SaaS. Flag: A's section header blends CM into a clearly-MS row.

## 1 · Product Owner
Smallest honest unit: surface the existing force-prepay as a named policy toggle in Settings. Behavioural half shipped and protected (no-show counter + per-phone forced prepay, `crm.ts:293-337` HIGH). Monetary half = COMPARE-03 item 4 — not reopenable (Rule 7). Verdict **DEFER** (UI polish, no new behavior). Deferred-as-a-ruling names "E-ts-03(monetary half — protected)". **HIGH**.

## 2 · Engineering Lead
**S/M, behaviour only.** Counters + forced-prepay work (bookings.ts:163-197; crm.ts:293-337). In-scope: rule automation (cancel-window → auto-flag) as settings. **Monetary fee capture is never-do** — no stored instrument (AGENTS; DIVERGENT-BY-DESIGN). CAUTION-adjacent: forced prepay flips initialStatus/cancelsAt → gate case pins pending behaviour. Crons: **R**. Effort audit row 6: COMPARE-04 M → **S** ("only the behavioural half is in-scope"). **HIGH**.

## 3 · Council
**PROTECTED-DO-NOT-TOUCH (monetary half)** | MS. Row's own text: fee capture prohibited — COMPARE-03 #4 (#2 for the instrument). Debate may still open the BEHAVIOURAL half as config (surfacing the no-show threshold as a merchant setting = policy config, zero money movement). Flag: "any proposal that re-opens fees = protected-item reopen request, CEO ruling required. Collision: YES — this row will attract fee-capture proposals." Money-gate case: "auto-flagged phone forced to prepay; no fee amount anywhere." **HIGH**.

## 4 · Support/CRM
Impact: **MED (already half-shipped, protected by law).** Behavioural half runs today: counter + health tag + per-phone forced prepay (Gap.md:226; crm.ts:293-337). "Owners feel the deterrent on day 2 — the half-built engine is a sales sentence, not a build item." Agent sentence: "A no-show loses the right to book free — automatically." frequency: OBSERVED-workaround-shipped. Day-1: **y** (it already fires).

## 5 · Challenge round
**A → B/C:** A defers the whole row (incl. the Settings toggle) as UI polish; B and C both keep the behavioural-config half live and shippable (B S, C "may still open").
**C → all:** warns this row "will attract fee-capture proposals" — guard against any toggle build drifting into the protected monetary half.

## 6 · Chair log
- **Agreed:** monetary fee capture stays dead (COMPARE-03 #4, never-do); behavioural force-prepay is shipped and protected.
- **Contested:** A defers even the Settings toggle vs B/C treat behavioural config as in-scope S-effort.
- **Escalation:** None (protected half not reopened this session; reopen would need CEO ruling).
- **Closure state:** CONTESTED-DEFER
