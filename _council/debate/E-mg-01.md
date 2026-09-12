# Debate — E-mg-01 Blast campaigns, email & text (PARTIAL, Gap.md:232-235) — MONEY-REGISTER CAUTION
**Surface:** A: merchant SaaS | B: none declared per row | C: MS | D: merchant SaaS. No clash among declared.

## 1 · Product Owner
Smallest unit: scheduled sends + per-template performance view from `notification_log` (template column HIGH, schema.ts:438). **NEXT, strictly AFTER E-ca-02 ships** — "expanding marketing sends before consumers can withdraw consent is backwards." Email blocked honestly: mailer is a logged stub without SMTP_HOST — "do not sell what is stubbed; SMS-only until mail config is real." COMPARE-01 F-sa-130. **MED**.

## 2 · Engineering Lead
**M.** Blast today = synchronous loop inside the request (crm.ts:182-237, every recipient awaited; no throttle unlike winback's 50@1/s; **no Pro gate in code despite Gap.md's description — tree wins**). Failure: big blast = timeout, no resume, retry double-sends. Fix = `campaigns` + `campaign_recipients` marker rows (billing_reminder_sends precedent, schema.ts:405-415), bounded in-process chunks — "the only one of the 68 that genuinely wants worker semantics; at 25 tenants marker-first is sufficient." Crons: **W** (+job slot). **MED**.

## 3 · Council
**AMBER-with-conditions** | MS. Conditions: (a) E-ca-02 consent centre ships FIRST; (b) >10k throttle stays parked (LEDGER:50); (c) mailer stub-truth bug (mailer.ts:31-34 records stub sends as success) fixed before any email perf claim; (d) never-throw rule. Email introduces the first per-send platform cost against EGE-ADV #2 (unmetered messaging): "YES-if-metered-to-merchant — reverses #2/#12 posture" (CEO ask 7). E-mg-01 in money-register. **HIGH**.

## 4 · Support/CRM
Impact: **MED.** One-shot SMS blast with STOP suffix + Pro gate exists (crm.ts:182-244). Incumbent workaround: Telegram broadcast lists — free, Amharic-capable, already installed. "Until STOP is honored (E-ca-02 duty), blasts convert trust into complaints — and complaints land on the founder's Telegram, which is my queue." frequency: OBSERVED-workaround. Day-1: **y** (blast ships today; the missing half is the opt-out).

## 5 · Challenge round
**B → C/D (fact):** B: "no Pro gate on /marketing/blast (crm.ts:182) — tree wins" vs C and D both citing the Pro gate as OBSERVED — unreconciled fact disagreement.
**A → any email scope:** SMS-only until SMTP config is real; C adds the stub-stats fix precondition.

## 6 · Chair log
- **Agreed:** scheduled sends + perf view after E-ca-02; marker-first in-process chunking, no Redis; >10k parked; no email performance claims while mailer stubs.
- **Contested:**
  - Pro gate present? C/D OBSERVED yes, B tree-verified no.
  - D's blast ships today vs A's NEXT-after-consent ordering (A: sends expand only after withdrawal exists).
- **Escalation:** None this session (email-cost posture — merchant-SMTP/absorb/meter — only if email campaigns are pursued; metering reverses EGE-ADV #2/#12, C ask 7).
- **Closure state:** CONTESTED-DEFER
