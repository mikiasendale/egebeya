# Debate — E-pm-18 Manual/offline payment types

**Surface (declared per persona):** A: merchant SaaS (section) | B: undeclared (per-row) | C: merchant SaaS | D: payments section — flag: B carries no surface (Rule 1).

## 1 · Product Owner
Smallest unit: owner records cash/off-platform completion → `payments` row, `gateway=null`, `status='completed'`, no gateway call (T7.5(b)). **NEXT, ship independently of the tax half** — "records money, moves none; this is the sentence that closes Pro founders ('how much did I take this month')." Verified HIGH: `payments.method` exists (schema.ts:180) with no entry surface in the 134 endpoints. CAUTION. **HIGH**.

## 2 · Engineering Lead
Effort **M**. `payments` already has gateway/method nullable columns nobody writes (schema.ts:180-181). Write cash rows `gateway=null,status='completed'` + **settlement decision in writing**: `settlementStatus='settled'` on entry or the 04:00 sweep marks them stale forever (settlements.ts; cron **S**). Revenue aggregate (tenant.ts:450-546) counts completed → include+label or exclude, "not by accident" (T7.5c). Gate case: offline row counts/labeled in revenue, settles-at-entry (or excluded from stale sweep), never grants a subscription. CAUTION. **HIGH**. (§3 audit: "M kept, flag".)

## 3 · Council
**AMBER-with-conditions** (MS). Cash recording is unprotected (COMPARE-03 §NOT-in-file); `payments.method` enum anticipates it (schema.ts:180-181). **This RECORDS money (allowed).** Conditions: offline rows visibly excluded from settlement reconciliation (settlements.ts:25-47 tracks gateway truth — cash has none) and from gate metrics/north-star if they'd inflate (AGENTS:24-25 — the gate counts appointments not payments, but check the funnel; flag `method='cash'` everywhere downstream). Never lets a cash row mark a pending Chapa payment completed. No CEO-ruling request. Collision: NO. **HIGH**.

## 4 · Support/CRM
Impact **HIGH — "#1 silent merchant pain in the tree."** Every payments row is created by Chapa flows (Gap.md:115; egebeya-features.json: "trigger: None — no manual entry surface"); cash and hand-tapped telebirr — most of what an Addis shop collects — make revenue invisible. Chain documented: T7.8's analytics understate cash owners "and teach owners that Egebeya understates them" (FSD-002:98-100). **Workaround: paper notebook beside the app — the merchant runs two books.** OBSERVED-workaround (code-proven). Day-1: **y** (Sunday cash vs Monday numbers). Money: **RECORDS only (a marker, not a movement) — "the cheapest revenue-truth feature on the file"; from my seat it outranks its WAITING status.**

## 5 · Challenge round
**D → C:** D grades the two-books workaround HIGH day-1 and wants it to outrank T7.5's WAITING; C holds AMBER pending the settlement/gate-flag conditions — urgency vs posture.
**B → A:** A calls it "records money, moves none" and independent; B insists the settlement-sweep semantics and revenue-aggregate treatment be decided *in writing* as part of the same change — independence has a named caveat.

## 6 · Chair log
- **Agreed:** records-only, never a move or a completion of pending Chapa rows; ships with a named chain test case and `method='cash'` flags downstream (A, B, C, D all in favor of building).
- **Contested:** sequencing salience only — D ranks it above its ledger status; A/B/C keep it inside the T7.5(b) seam with settlement/gate conditions.
- **Escalation:** None. — Register check: money answer is **record**, the one the B-register explicitly permits; no "move" implied by any persona.
- **Closure state:** CLEARED
