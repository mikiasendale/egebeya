# FSD-003 — Shadow board: what the kill gates cost (non-binding)

**Date:** 2026-09-12
**Season at decision:** 0 — ship and activate
**Weights in force:** funnel ×3 · market-fit ×2 · effort ×2 · revenue ×1 · evidence ×2
**Supersedes / superseded by:** —
**Overrides:** **none in force.** The owner asked what the gates cost, not for the gates to open.
Every row below was killed by `docs/feature-selection.md` §2 and stays killed. This record scores
them anyway, as a *price list*, so that "the law constrains both" is auditable rather than
magical. **These rows are not candidates and do not appear in `LEDGER.md` as rankable work** —
with one exception, below, which is a gate *misapplication*, not a gate override.

**Method:** identical weights, identical Season 0 funnel cap (all rows carry funnel = 1).
Two columns are shown because they answer different questions:
- **total** — what the scorecard says, with everything on.
- **value** — total minus the evidence term. Under the funnel cap, evidence ×2 is worth 6 of 24
  points and rewards *"Fresha documented it"*, not *"we want it here"*. Without this column the
  dead set looks artificially alive.

## G1 Law — mean total 12.4, mean value 6.9

| Row | Killed capability | total | value | Citation for the kill |
|---|---|---|---|---|
| S-06 | Loyalty tiers / expiry / referral depth | 17 | 13 | `AGENTS.md:24-25`, `docs/loyalty-opening.md:48-54` |
| S-05 | Dynamic up-pricing (F-sa-132) | 16 | 10 | `ROADMAP.md:22` |
| S-04 | Consumer memberships, recurring capture (F-bh-50) | 14 | 8 | `AGENTS.md:27` |
| S-01 | Card-on-file at booking (F-bh-41) | 12 | 6 | `AGENTS.md:27` |
| S-02 | No-show / late-cancel fee capture (F-bh-43) | 12 | 6 | `AGENTS.md:27` |
| S-03 | Client wallets / cashback (F-bh-54) | 10 | 4 | `ROADMAP.md:16` (−2 to −17 ETB/txn) |
| S-07 | 37-locale parity (F-bh-300) | 9 | 3 | `AGENTS.md:36` |
| S-08 | Puck↔HTML transpiler | 9 | 5 | `AGENTS.md:28`, `ROADMAP.md:21` |

**Reading.** The law gate is cheap on the things it exists to stop. S-01/S-02 score 12 only because
they are well documented and monetarily attractive (revenue 3); stripped of evidence they are worth
6, and their market-fit is a hard 0 — they assume an instrument this market does not hand to a
salon. The genuinely expensive-looking row is **S-06 (17/13)**, and it is not a law death: it is
*gate-deferred*. The numbers say the loyalty-depth residual becomes worth ~17/24 the moment the
north-star clears 0.7 on real traffic — useful for planning, not actionable now.

## G2 Rails — mean total 11.8, mean value 6.2

| Row | Killed capability | total | value | Citation |
|---|---|---|---|---|
| S-11 | Google Reserve / FB-IG native booking | 15 | 9 | channels do not serve Ethiopian venues |
| S-09 | Card terminals / tap-to-pay / POS hardware | 11 | 5 | `server/lib/chapa.ts:81-136` is the only rail |
| S-10 | BNPL (Klarna, Afterpay) | 11 | 5 | no consumer credit rail in market |
| S-12 | Map / proximity discovery | 10 | 6 | `src/api/public.ts:106-111`; OSM redesign parked at `EXECUTION_PLAN.md:442` |

**Reading.** S-11 tops this gate on evidence alone (3 points from Fresha's `/pricing` listing
channels as Free). At value 9 it is a distribution wish, not a feature. Nothing here is being
sacrificed that would survive contact with the market.

## G3 Infra — mean total 14.8, mean value 11.2 ← the most expensive gate, and wrongly

| Row | Killed capability | total | value | Citation |
|---|---|---|---|---|
| **S-16** | **Queue-advance push to consumers** | **21** | **17** | `EXECUTION_PLAN.md:627-633` (T6.6), `server/lib/notifications.ts:186` |
| S-14 | Continuous BI / data connector | 14 | 10 | `ARCHITECTURE.md:27` |
| S-15 | Bulk campaigns beyond ~10k sends | 13 | 9 | `server/cron/runWinbackAutomations.ts:37-39` |
| S-13 | Two-way external calendar sync | 11 | 9 | `ARCHITECTURE.md:27` (evidence INFERRED for this market) |

### S-16 is a gate error, not a gate override

I parked queue-advance push at G3 on a general principle ("push fan-out needs a worker"). The repo
already ruled on this specific item: **T6.6 — "Queue-advance push notification — optional"**
records *"push on queue-advance through the NotificationAdapter seam (Telegram deep link). Slots in
without new infrastructure."* (`EXECUTION_PLAN.md:627-633`). A single `notify()` call
(`server/lib/notifications.ts:186`) fired on `advanceEntry`
(`src/api/queue.ts:79-101`, `server/lib/queue.ts:219-283`) is one Telegram send per tap — no fan-out,
no queue, no second process. It rides the rails; I invented a constraint the owner had already
considered and dismissed.

**Correction applied:** S-16 moved out of the shadow board and into `LEDGER.md` as `CANDIDATE`
(`T7.19`). This is gate maintenance, so it is not the agent picking work — at 21/24 it sits
**below** the live shortlist band (22–23) and, as a one-way door (notification policy towards
consumers, `docs/feature-selection.md` §6), it loses the §10 tie-break to the two-way items anyway.
The correction changes the ledger's honesty, not the season's order.

**The remaining three G3 rows are genuinely parked.** Excluding the error, G3's mean is 12.7/9.3 —
in line with the other gates, and the gate is left holding what it should.

## G4 Parity — mean total 11.0, mean value 5.0

| Row | Capability | total | value | Where it already lives |
|---|---|---|---|---|
| S-19 | Promo / discount engine | 13 | 7 | `src/api/crm.ts:98-180` |
| S-20 | Winback automation | 13 | 7 | `server/cron/runWinbackAutomations.ts:103-208` |
| S-21 | Booking embed widget | 13 | 7 | `src/pages/EmbedBooking.tsx:17-42` |
| S-17 | Recurring appointments | 9 | 3 | `src/api/tenant.ts:1697` |
| S-18 | Full prepay at booking | 9 | 3 | `src/api/public.ts:807-814` |
| S-22 | Auto-synced website | 9 | 3 | `src/lib/puck.config.tsx:131-155` |

**Reading — these scores are meaningless on purpose, and that is the finding.** A G4 row scores
"how good would it be to rebuild the thing we already ship", which has no answer. The only useful
output is the **residual** hiding behind each parity claim: S-19's is deals/flash pricing (already
`T7.14`), S-20's is welcome + rebook messages (`T7.1`/`T7.3`), S-21's is QR codes and any merchant
surface to retrieve the snippet (an unscored PARTIAL behind `F-sa-242`). G4 should be reported as
residuals, never as scores; this row set exists only to prove it.

## What the price list is for

The live shortlist band is 22–23 of a 24 ceiling. Across 22 shadow rows, exactly **one** reaches
that neighbourhood, and it reached it because I had mis-gated it. Everything the law kills is worth
3–13 on the value scale; everything the rails kill is worth 5–9. The gates are not protecting the
product from good ideas — they are protecting it from ideas that cost money to build and cannot be
paid back here. That is the answer the owner asked for, and it is why §7 (override) is cheap to
use deliberately and expensive to use casually: there is nothing tempting on the other side of the
gates except the one thing that was never behind them.

## Measurement commitment

**Question:** does publishing gate prices reduce attempts to re-litigate dead candidates?
**Instrument:** count of `LEDGER.md` status changes that move a `DEAD(G1/G2)` row to `CANDIDATE`
without a superseding decision record.
**Answer by:** after three cycles.
**Verdict:** —
