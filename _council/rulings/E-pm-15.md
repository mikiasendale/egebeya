ID: E-pm-15 (+ Fresha pair F-bh-56)
Name: Refunds & deposit refunds
Surface: consumer marketplace + merchant SaaS (named pair: the refund promise faces consumers; the act is merchant-side)
Category: payments-money
Class: GAP (COMPARE-01 — cancel text is manual-only)
Fresha behaviour: Platform-initiated refunds and deposit refunds through Fresha Payments (hc/368; hc/632). KB provenance: OBSERVED.
Egebeya current state: Landing promises "Refunded automatically if the business cancels" (src/pages/Landing.tsx:1029 ↔ en.json:63) while cancel says "A refund must be issued manually" (src/api/public.ts:1283-1285) and chapa.ts has NO refund call (exports: create/initiate/authorize/verify, verified).
Blockers: money (a PROMISE today; automation would MOVE) + rail (Chapa refund capability INFERRED/absence-ledger) — ruling 2 closes the move question; precondition: ruling 1 (ALLOW_UNVERIFIED_PAYMENTS=false, render.yaml:26)
Debate summary: Everyone called the landing-vs-cancel contradiction a defect, not a backlog item — A split it (copy fix NOW / ack NEXT / API NEVER), B confirmed the missing refund export makes platform-initiated refund NOT-feasible-without-API-confirmation, C demanded the lie and the rail be judged separately and recommended (a)+(b), D graded the whole row a day-1 HIGH duty ("every refund an agent's merchant cannot execute is a Telegram DM to the founder"). Contested only at the edges: whether the ack path also escalates (D) and whether the rail is OBSERVED-absent or INFERRED-absent (B vs C).
Council ruling: BUILD NEXT — (a) copy fix NOW as a duty, (b) one-tap "refund issued" record; NO Chapa automation (ruling 2)
Closure method (if BUILD): (a) DUTY NOW: fix the false public money promise in BOTH locales (Landing.tsx:1029 / en.json:63 — and am.json the same commit, AGENTS.md law) to match the manual truth at public.ts:1283-1285 (T7.9a shape). (b) One-tap "refund issued" acknowledgement for the owner: idempotent, tenant-scoped, stamps payments.status/meta (no new gateway call), emails the consumer a bilingual note (T7.9 shape). Entity changes: none (payments.meta JSON). Endpoint changes: one tenant-side ack route. UI changes: landing copy + owner refund-ack button on the payment/appointment surface. Tests — MONEY: NEW cases in server/tests/chain-payments-billing.test.ts: the ack is idempotent, stamps meta, and never mutates invoice/settlement; plus a landing-copy == cancel-text assertion (B's named gate case). Explicitly NOT in scope: any Chapa refund-initiation call (ruling 2).
Substitute method (if SUBSTITUTE/DEFER-with-substitute): n/a for (a)/(b) (both BUILD); for the refused (c), the substitute IS (b) — the recorded merchant act, trade-off named: the consumer still waits on a human off-platform.
Owner: Product Owner (copy duty); Engineering Lead delivers the ack stamp
Effort: S (copy fix) / M (recorded-ack half)
Money path: YES — CAUTION (records a manual refund act; settles the standing false promise)
Protected decision referenced (if any): none — refunds are explicitly unprotected (COMPARE-03 §NOT-in-file); option (c) would have flirted with #1/#7 and was refused
EGE-ADVANTAGE collision (if any): none; the copy fix protects the honesty posture D flagged day-1
Merchant evidence: HIGH frequency — a DUTY, not a feature; OBSERVED-workaround: the documented false promise itself; day-1 = y (first business-cancelled booking teaches everyone).
Confidence: HIGH
CEO ruling (final): Ruling 2 — "Refunds — copy fix + one-tap 'refund issued' record. No automation. Merchant allows it. No Chapa refund-initiation call." Precondition from ruling 1. The Chair's register check (promise today, record only in the fix) is preserved.
