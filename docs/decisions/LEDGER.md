# Ledger

Running index of every candidate that has entered `docs/feature-selection.md` Stage 1.
One row per candidate. The agent updates it on every gate result, score, pick, pass-over and
verdict. **A candidate with no row here has not entered the workflow.**

Status vocabulary: `CANDIDATE` · `DEAD(G1..G4)` · `PARKED(G3)` · `REMOVED(G4)` · `SHORTLIST` ·
`PICKED` · `PASSED` · `BUILDING` · `SHIPPED` · `KEEP` · `ITERATE` · `KILL` · `UNMEASURABLE` ·
`DUTY` *(pending owner confirmation of the rule proposed in FSD-001)*

| Candidate | Door | Last cycle | Gates | Score /24 | Door type | Status | Re-entry / next event | Record |
|---|---|---|---|---|---|---|---|---|
| `T7.13` directory price floor + same-day signal | matrix | FSD-002 | all pass | 23 | two-way | SHORTLIST | owner pick | FSD-002 |
| `T7.8` render existing tenant analytics | matrix | FSD-002 | all pass | 23 | two-way | SHORTLIST | owner pick | FSD-002 |
| `T7.17` close the dead merchant surfaces | matrix | FSD-002 | all pass | 22 | two-way | SHORTLIST | owner pick | FSD-002 |
| `T7.2` merchant-set reminder lead time | matrix | FSD-002 | all pass | 22 | two-way | SHORTLIST | owner pick | FSD-002 |
| `T7.4` lifecycle messages ×4 | matrix | FSD-002 | all pass | 22 | two-way | SHORTLIST | owner pick | FSD-002 |
| `T7.6` closure / blocked-time write path | matrix | FSD-002 | all pass | 22 | two-way | WAITING | below the top 5; needs only a new cycle | FSD-002 |
| `T7.12` consumer consent centre + STOP handling | matrix | FSD-002 | all pass | 22 | one-way | **DUTY?** | PDPL withdrawal is arguably not rankable — see FSD-001 proposed rule | FSD-002 |
| `T7.9` refund honesty (fix promise, record act) | matrix | FSD-002 | all pass | 22 | one-way | **DUTY?** | a public claim the code contradicts is not a feature choice | FSD-002 |
| `T7.5` tax / service charge + offline cash ledger | matrix | FSD-002 | all pass | 22 | one-way | WAITING | needs a design doc (money) | FSD-002 |
| `T7.1` first-visit welcome offer | matrix | FSD-002 | all pass | 21 | two-way | WAITING | after the message catalog exists (T7.4) | FSD-002 |
| `T7.3` reminder to rebook | matrix | FSD-002 | all pass | 21 | two-way | WAITING | needs T7.1/T7.4 plumbing | FSD-002 |
| `T7.11` authored client record (notes/reason/files) | matrix | FSD-002 | all pass | 21 | one-way | WAITING | schema + PDPL erasure surface | FSD-002 |
| `T7.14` deals + stop the widgets lying | matrix | FSD-002 | all pass | 21 | one-way | SPLIT | the lying-widget half is a two-way bug fix, promoted into T7.17 | FSD-002 |
| `T7.16` booking-source attribution | matrix | FSD-002 | all pass | 21 | two-way | WAITING | worth more with paid acquisition, which Season 0 forbids | FSD-002 |
| `T7.15` service buffers / extra time | matrix | FSD-002 | all pass | 20 | one-way | BLOCKED | depends on T6.4 `expandSeries()` extraction (`EXECUTION_PLAN.md:607`) | FSD-002 |
| `T7.7` waitlist on reclaimed slots | matrix | FSD-002 | all pass | 19 | one-way | WAITING | demand unobserved locally; returns with a tenant request | FSD-002 |
| `T7.10` tips | matrix | FSD-002 | all pass | 17 | one-way | WAITING | needs a staff-attribution decision first (Fresha `F-sa-203/204` territory, never ticketed) | FSD-002 |
| `T7.18` client-to-client referral | matrix | FSD-002 | all pass | 17 | one-way | WAITING | after loyalty gate opens (`docs/loyalty-opening.md`) | FSD-002 |
| `T7.19` queue-advance push (was T6.6) | matrix (un-parked from G3) | FSD-003 | all pass | 21 | one-way | CANDIDATE | below the shortlist band; re-enters ranking next cycle | FSD-003 |

## Permanently outside the funnel (G1 Law — never scored)

| Candidate | Killed by | Citation | Returns only if |
|---|---|---|---|
| Card-on-file / stored-instrument no-show fees | G1 | `AGENTS.md:27` | the never-do list itself is amended by a recorded decision |
| Client wallets, cashback | G1 | `ROADMAP.md:16` ("DEAD, permanently") | a direct Ethio Telecom issuer agreement — a meeting, not a ticket |
| Consumer memberships / any auto-renew | G1 | `AGENTS.md:27`, `EXECUTION_PLAN.md:679` | as above |
| Dynamic up-pricing | G1 | `ROADMAP.md:22` | evidence that street undercutting is not the local failure mode |
| Loyalty tiers / expiry / referral depth | G1 | `AGENTS.md:24-25`, `docs/loyalty-opening.md:48-54` | the gate opens on real numbers |
| 37-locale parity, Puck↔HTML transpiler | G1 | `AGENTS.md:20,28`, `:36` | — |

## PARKED (G3 Infra — deferred scaling track)

| Candidate | Needs | Citation |
|---|---|---|
| Two-way external calendar sync | durable inbound subscription + retry | `ARCHITECTURE.md:27` |
| Continuous BI / data connector | worker + queue + object sink | `ARCHITECTURE.md:27` |
| Bulk campaign sends beyond ~10k | worker + queue | the 1/sec in-process throttle is the ceiling (`server/cron/runWinbackAutomations.ts:37-39`) |

**Correction, 2026-09-12 (FSD-003):** "real-time queue-advance push" was parked here in error.
T6.6 already ruled it slots in without new infrastructure (`EXECUTION_PLAN.md:627-633`) — one
`notify()` call per advance tap. It is now `T7.19` below as a live candidate. The other three rows
are genuinely parked.
| Bulk campaigns beyond ~10k sends | the 1/sec in-process throttle is the ceiling | `server/cron/runWinbackAutomations.ts:37-39` |

## G2 Rails (dead, or dead until redesigned)

| Candidate | Reason |
|---|---|
| Card terminals, tap-to-pay, POS hardware | no card-present rail; `server/lib/chapa.ts:81-136` is the only rail |
| BNPL (Klarna/Afterpay) | no consumer credit rail in market |
| Google Reserve / FB-IG native booking | integrations do not exist for this market |
| Map/proximity discovery | no coordinates are collected anywhere; a *redesign* (sub-city text zones, OSM gazetteer) is parked at `EXECUTION_PLAN.md:442` |

## G4 Removed (already built — do not rebuild)

| Candidate | Where it already lives |
|---|---|
| Recurring appointments | `src/api/tenant.ts:1697-1790`, `server/cron/expandRecurring.ts:39` |
| Full prepay at booking | `src/api/public.ts:807-814`, `:1006-1024` |
| Promo/discount engine | `src/db/schema.ts:302-318`, `src/api/crm.ts:98-180` |
| Winback automation | `server/cron/runWinbackAutomations.ts:103-208` |
| Booking embed widget | `src/pages/EmbedBooking.tsx:17-42` |
| Auto-synced website | `src/lib/puck.config.tsx:131-155` (live-fetched services + hours) |

## Remediation rulings (not rankable candidates)

| Record | What was ruled | Outcome |
|---|---|---|
| FSD-004 | `src/db/tenantRepo.ts` — dead scaffolding that reads as the isolation layer | **DELETED** (owner pick, 2026-09-12); inline `eq(tenantId, …)` stays the law; re-entry conditions in the record |
