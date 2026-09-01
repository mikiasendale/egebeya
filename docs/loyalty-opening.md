# Loyalty gate — opening runbook (T5.3)

The loyalty program ships behind a council gate enforced **in code**
(`server/lib/loyalty.ts`): the engine only accrues punches or redeems rewards
when ALL of the following hold, re-read live on every loyalty touch:

1. `LOYALTY_ENABLED=true` in the environment.
2. Marketing opt-in rate ≥ **0.5** across `customer_stats`.
3. North-star ≥ **0.7** (confirmed/completed bookings in the trailing week per
   billing-active tenant — same definition as `/admin/funnel`).

Flipping the env flag alone is not enough — the DB refuses while the
thresholds sit unmet (pinned by `loyalty.test.ts` GATE-REFUSAL).

## Current status

- **Local dev:** `LOYALTY_ENABLED=true` (owner decision, Sept 2026). The gate
  reads OPEN locally because the dev database's seed data clears both
  thresholds. Caveat: those numbers are inflated by seed/demo rows —
  `gateStatus()` counts all `customer_stats` and appointments; it is NOT
  demo-excluded. Fine for exercising the feature locally; meaningless as a
  production signal.
- **Production:** flag stays unset until the real gates pass. That is business
  work (below), not a code change.

## The legitimate opening path (production)

1. **T2.1 must be done** — Telegram identity/confirmation flow real.
2. Drive real opt-ins: booking-time consent + Telegram confirmations move
   `customer_stats.marketing_opt_in`. Watch the rate on `/admin/funnel` and
   `/admin/notification-stats`.
3. Drive the north-star: real confirmed bookings per billing-active tenant.
4. When both thresholds hold for real, flip `LOYALTY_ENABLED=true` on the host
   and restart.

## Do NOT

- Do not edit `marketing_opt_in` for customers who never consented — that is
  fabricated consent (PDPL 1321/2024 exposure) and it poisons the exact signal
  the gate exists to protect.
- Do not lower `OPT_IN_THRESHOLD` / `NSM_THRESHOLD` in code to force the gate.
- Do not flip the flag on the host before the numbers are real.

## Paste-ready prompt (run anytime to check the gate)

```text
Measure the loyalty gate in this repo and report the honest gap:

1. Run the equivalent of gateStatus() against the configured database
   (enabledFlag, optInRate, northStar, reasons). Print each number and the
   threshold it is compared against (0.5 / 0.7).
2. If the gate is open, say so and STOP — no further work.
3. If it is closed, break the gap into the two business levers only:
   - opt-ins: how many additional marketing_opt_in=true customers are needed
     at the current denominator, and which REAL channels move that number
     (booking-time consent, Telegram confirmations — P3.3);
   - north-star: how many additional confirmed/completed bookings this week
     are needed, and where they come from.
4. Do NOT insert, update, or seed customer_stats.marketing_opt_in, do NOT
   create synthetic appointments, and do NOT touch
   server/lib/loyalty.ts thresholds. The gate opens with business work only.
5. When the numbers are genuinely met, the only change is
   LOYALTY_ENABLED=true on the host (then restart). Report the final gate
   read as proof.
```
