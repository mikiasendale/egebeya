# Debate — E-ds-07 Same-day availability surfacing
**Surface (declared per persona):** A: consumer marketplace | B: not declared per row | C: CM | D: consumer marketplace (paper-level)

## 1 · Product Owner
- Smallest unit: `openToday` boolean on the same discover payload, batched (queue.ts:44-63 discipline).
- **NOW** — "same diff as E-ds-06; the availability generator already exists (`public.ts:477-591`)"; ships in Band 1 item 2 with E-ds-06.
- Cites COMPARE-01 F-mp-07. HIGH.

## 2 · Engineering Lead
- **M**: needs a bounded per-tenant rollup ("any open slot today?"); at 25 tenants an on-read bounded scan is honest, at scale a precompute job — "an 8th cron or the future worker, and it is the **first genuine queue-benefit item in the 68**".
- Dep: **E-ms-03** — "closures must be respected or 'open today' lies". Failure without infra: slow reads inside `discoverLimiter` at scale. MED.

## 3 · Council
- **GREEN-with-conditions**: availability already computed per day (public.ts:477-591, OBSERVED); surface a boolean "opens today" badge.
- Conditions: N×directory reads must not fan out full availability queries — cache per tenant-day; all day-math on fixed Addis UTC+3 (`server/lib/timezone.ts:1`, EGE-ADV #8). Collision: NO. HIGH.

## 4 · Support/CRM
- Impact HIGH (consumer side). frequency: OBSERVED-workaround — computed-but-never-surfaced; consumers book tomorrow because they cannot see today; the walk-in uses the queue board instead (QueueStatus.tsx, EGE-ADVANTAGE).
- Binding kill condition: a wrong "space today" badge burns the directory's one asset (FSD-002:77-79) — "ship it cached or not at all". Day-1: **y**.

## 5 · Challenge round
**B → A:** A says "same diff as E-ds-06" (S-energy, NOW) and sequences it above E-ms-03 (Band 1 #2 vs #4); B prices it **M** with E-ms-03 as a hard dependency — without a closures writer the badge lies (A: public.ts:477-591 | B: dep list, "open today lies"; D's kill condition backs B: FSD-002:77-79).

## 6 · Chair log
- **Agreed:** surfacing is a payload+badge job on the existing generator; correctness first — cached/bounded or not at all; UTC+3 day-math.
- **Contested:**
  - Effort: A "same diff" (S-implied) vs B **M** — named class disagreement on the same code (public.ts:477-591).
  - Order: A ships before E-ms-03; B (and D's kill condition) require closures first.
- **Escalation:** None — the "8th cron/worker" note is scale-future, not now (B: "not a correctness blocker").
- **Closure:** CONTESTED-DEFER
