# Debate — E-ms-03 Blocked time & closures (PARTIAL, Gap.md:185-188)
**Surface:** A: merchant SaaS | B: none declared per row | C: MS | D: merchant SaaS. No clash among declared.

## 1 · Product Owner
Smallest unit: T7.6 POST/DELETE closures + Ge'ez holiday suggestions. **NOW** — table write-orphan verified HIGH this session (closures written only by seed/cleanup/accountDeletion; enforced on every availability read at `public.ts:508-514,651`). "A merchant who closes for Enkutatash cannot say so. Cheapest trust win in the file." **HIGH**.

## 2 · Engineering Lead
**S** (effort audit: COMPARE-04 scored M — B calls it "pure dead-surface resurrection"). Table + read enforcement fully live (public.ts:508-514, :651-662; schema.ts:110-115); only `POST/DELETE /api/tenant/closures` + settings UI missing. Crons: none. Unblocks: fill-rate denominator honesty (analytics.ts:252-255), E-ds-07, E-bc-03 "full-day" truth. **HIGH**.

## 3 · Council
**GREEN** | MS. Closure table write-orphaned (OBSERVED); T7.6 scored 22/WAITING (LEDGER:18). Ship write endpoint + UI. Condition: after closures become real, update the quiet-hours fill-rate honesty note (analytics.ts:252-255) — "keep the caveat true or fix the denominator, never let it drift silently". Collision: NO. **HIGH**.

## 4 · Support/CRM
Impact: **HIGH — "my #1 dead surface by merchant cost."** Enforced on every public read (public.ts:508-522, 651-662) but no endpoint/UI can create a row (repo-map "write-orphaned"; writers are seed/tests only). Consequence: Meskel closure or funeral afternoon unmarkable; shop stays bookable while shut or closes every Wednesday to cover one. Workaround: owner phones their own booking page's bookings — "the highest-awkwardness call in commerce". T7.6 22/24, "needs only a new cycle" (LEDGER.md:18). Evidence: OBSERVED-workaround — strongest code-proven pain in the file. Day-1: **y**.

## 5 · Challenge round
**A → FSD-002 ordering:** A explicitly amends FSD-002's "#6, below the cut", promoting T7.6 into Band 1 (S-effort, two-way, write-orphan "a correctness embarrassment"); B/C/D concur with the promotion.
**C vs ledger timing (minor):** LEDGER says T7.6 "WAITING/needs a new cycle" (C, D citations) vs A NOW — resolved in §5 above.

## 6 · Chair log
- **Agreed:** ship the closure write path + UI now; strongest cross-position consensus in this band (D #1 pain, B S, C GREEN, A NOW).
- **Contested:** None.
- **Escalation:** None.
- **Closure state:** CLEARED
