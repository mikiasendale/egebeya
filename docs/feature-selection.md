# Feature Selection — the law of the one door

> **The agent does the paperwork. The owner makes the calls. `AGENTS.md` constrains both.
> Every call gets written down.**
>
> This file is the workflow. `docs/decisions/` is the memory. `EXECUTION_PLAN.md` is the only
> backlog. Nothing here is advisory: an agent that picks instead of prepares, or ships without a
> record, has failed the task even if the code is green.

---

## 0. State (edit here, nowhere else)

| Field | Value |
|---|---|
| **Season** | `0 — ship and activate` |
| **Weights** | funnel **×3** · market-fit **×2** · effort **×2** · revenue **×1** · evidence **×2** |
| **Weights set by** | Owner, 2026-09-12, recorded in `docs/decisions/FSD-001-feature-selection-adopted.md` |
| **Season changes** | Owner only. A season change is a decision record, not a mood. |
| **Intake door** | `EXECUTION_PLAN.md` §T6/T7 tickets + `/media/mikias/27E5BCBF704A2696/Workstation/subware/fresha-clone/_compare/COMPARE-04-BACKLOG-PROPOSAL.md` + owner's own ideas |
| **Open shortlist** | see `docs/decisions/FSD-002-season0-first-run.md` |

> ⚠️ **Repo state note, 2026-09-12.** `EXECUTION_PLAN.md` and `ROADMAP.md` are currently **staged
> for deletion** (`git diff --cached --diff-filter=D`) and absent from the working tree, while
> `AGENTS.md:47` still names `EXECUTION_PLAN.md` as required reading and this file cites both by
> line number. The citations are valid against `HEAD` (`git show HEAD:EXECUTION_PLAN.md`); they are
> dangling on disk. Until this is resolved one way or the other, Stage 1 door 1 has no target and
> the tickets in `FSD-002` cannot be appended to a file that does not exist. Do not "fix" this by
> inventing a replacement backlog — it is an owner decision about the repo, not a feature choice.

**Season presets** (the starting point if the owner re-sets weights):

| Season | What it means | Preset (funnel/market/effort/revenue/evidence) |
|---|---|---|
| **0 — ship and activate** | Prod is not live; the operator block (Render/Chapa keys, `ALLOW_UNVERIFIED_PAYMENTS=true` in `render.yaml`, unprovisioned Telegram) is open. Measurement is largely impossible. | **3 / 2 / 2 / 1 / 2** ← current |
| **1 — funnel only** | Real traffic exists; only work that moves a measured funnel step is eligible. | 4 / 2 / 1 / 2 / 2 |
| **2 — parity and delight** | Gate 2 in reach; Fresha-parity basics and differentiators compete on equal footing. | 2 / 3 / 2 / 3 / 1 |

Changing the season changes what "obvious" means. That is the point of writing it down.

---

## 1. Stage 1 — Intake *(agent)*

Exactly two doors:

1. **The gap matrix** — a record in `COMPARE-01` classified `GAP`/`PARTIAL`, written up as a ticket
   in `COMPARE-04`.
2. **The owner's own idea** — said out loud, then written into a ticket before it is scored.

There is no third door. An agent may not promote a discovery, a parked finding
(`EXECUTION_PLAN.md:507`), a REPO_MAP dead-code row, or a chat remark into the funnel without an
owner asking for it. Unrequested work is the failure mode this file exists to stop.

Candidate state lives in the ledger: `docs/decisions/LEDGER.md`. One row per candidate, one line
per change. A candidate with no ledger row does not exist.

## 2. Stage 2 — Kill gates *(agent, binary, free)*

Applied in this order. A candidate dies at the **first** failure, and the death records the gate
that killed it. No gate is ever "waved through to see what it scores".

| Gate | Question | Source of the rule | On failure |
|---|---|---|---|
| **G1 Law** | Does this touch anything on the never-do list, or correspond to a `DIVERGENT-BY-DESIGN` record in `COMPARE-03`? | `AGENTS.md:19-31`, `EXECUTION_PLAN.md:679-684`, `ROADMAP.md:12-28` | **DEAD.** Re-entry only via a recorded owner decision that changes the ruling itself (the `docs/loyalty-opening.md` pattern) — never via a ticket. |
| **G2 Rails** | Does it assume a rail this market does not have (stored card, email-first consumer, POS hardware, external credit)? | `COMPARE-00` market-fit axis; `server/lib/chapa.ts:81-136` | **DEAD** or **REDESIGN REQUIRED** — the latter returns to Stage 1 exactly once, with the redesign named. |
| **G3 Infra** | Can it ride one process + libSQL/Turso + in-process cron, with no message queue and no worker? | `ARCHITECTURE.md:27`, `server.ts:241-320`, `src/db/health.ts` | **PARKED** on the deferred scaling track (`§9`), tagged with what unblocks it. |
| **G4 Parity** | Does it already exist? | `COMPARE-01` class `SAME`/`EGE-ADVANTAGE`, or a live route/component | **REMOVED** — rebuilding an existing thing is a failed task (`EXECUTION_PLAN.md:17-18`). |

Gates are *classification*, not opinion. Every gate outcome carries a citation. An agent that
cannot cite the file that kills a candidate has not killed it — it has guessed.

## 3. Stage 3 — Scorecard *(agent scores, owner owns the weights)*

Each survivor is scored 0–3 on five dimensions, then multiplied by the §0 weights.

| Dimension | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| **Funnel leverage** — which step does it move (register → provision → confirm-hours → shared → first booking → first invoice) | touches none | off-funnel | moves a step | moves a step that has **measured** drop-off in `/api/admin/funnel` |
| **Market fit** | assumes foreign rails/behaviour | weakly local | rides telebirr / phone / Telegram / Amharic | only makes sense here |
| **Effort against rails** *(inverted)* | L — new machinery | — | M — new fields, reuses adapter/queue/Chapa/blocks | S — rides an existing seam untouched |
| **Revenue proximity** | none | indirect | touches Pro conversion / velvet rope | touches the Chapa rail itself |
| **Evidence confidence** | INFERRED need, unverified | thin | documented need | both sides cited; the code path is proven to exist |

Effort points are `S=3, M=2, L=0` — the inversion is deliberate: *what it rides* beats apparent
size. "What it rides" is a citation to the existing seam, not an adjective.

**Max score = 3×3 + 2×3 + 2×3 + 1×3 + 2×3 = 30.** With the Season 0 funnel cap the practical
ceiling is **24** — read the board against 24, not 30, and expect compression at the top.

Two honesty rules:
- In Season 0 the funnel axis is **capped at 1** unless the leak is measured in production. A
  local dev DB with seed rows is not a leak (`docs/loyalty-opening.md:31-39` says exactly why).
- A score with no evidence line behind the dimension is a vibes score. Fill it in or drop it.

## 4. Stage 4 — Shortlist briefs *(agent prepares, owner picks)*

The agent presents the **top 3–5 by score**, one page each — never a spreadsheet, never more than
five, never a ranking presented without the case against. Each brief:

```
BRIEF — <candidate id>            score N/33 (funnel a · market b · effort c · revenue d · evidence e)
What it is                        one paragraph, no adjectives
Evidence                          Fresha side + Egebeya side, file:line
Rides                             the existing seams it reuses, cited
Door                              one-way / two-way (§6) + what specifically is irreversible
Kill conditions                   what would make this the wrong build
Case AGAINST                      the strongest honest argument to skip it
If passed                         what new evidence would bring it back
```

**The owner picks ONE. Maybe two. Never more.** The agent records the pick and every pass-over;
it does not begin implementation on the strength of its own ranking.

## 5. Stage 5 — Decision record *(owner + agent, ten minutes)*

Every cycle produces at least one file in `docs/decisions/`, named
`FSD-NNN-<slug>.md`, from `_TEMPLATE.md`. It records:

- date, season, weights in force at the time
- **what was picked**, and why, in the owner's words if given
- **what was passed over**, with the re-entry condition
- **what died at a gate**, with the gate
- the falsifiable measurement question for Stage 6

**Re-entry rule:** a passed-over candidate returns only with **new evidence, not a new mood**
(a new tenant request, a measured leak, a changed law, a shipped dependency). Skipping is allowed;
skipping without a written reason is what makes the same five items come back every fortnight.

## 6. Stage 6 — Build, then measure *(existing ritual, plus the door overlay)*

**Two-way door** — reversible: UI, copy, a new field, a template, a settings key, an additive
column behind a flag. Build it now under the normal ritual (`AGENTS.md:8-17`). Low ceremony is
the point; do not spend review attention on things you can undo in one commit.

**One-way door** — irreversible in practice: schema shape that other code will come to depend on,
anything touching money (payments, refunds, deposits, tips, pricing — the `chain-payments-billing.test.ts`
domain), brand promises made publicly, notification policy towards consumers, anything that
changes a gate or a threshold. These get **a one-page design doc, approved by the owner, before
code**. The doc is the same file shape as the brief plus a "consequences if wrong" section.

Money path is always one-way, always `CAUTION`, regardless of how small the diff looks.

Then **2–4 weeks after shipping**, the owner answers the Stage-5 question with numbers:
`KEEP` / `ITERATE` / `KILL`, recorded in the same decision file. This is the half that turns a
queue into a loop. If the question cannot be answered with the data available, that is itself
recorded — "unmeasurable" is a legitimate verdict, and it is the verdict most likely to be true
in Season 0.

## 7. The override

The owner can overrule any gate, any score, any season rule, at any time. The override is not
forbidden; **an unrecorded override is.** It is written as a decision record with the gate it
overrides named, and it becomes the precedent until superseded — exactly how
`docs/loyalty-opening.md:19-29` retired the opt-in condition instead of quietly editing code.

## 8. Hard rules for agents

1. **Prepare, never pick.** Ranking is paperwork; selection is the owner's. Presenting
   "recommended: build T7.3" is allowed; starting it is not.
2. **No matrix → code.** Matrix → ticket → brief → *owner pick* → decision record → then the
   `AGENTS.md` ritual. Skipping the middle is the failure.
3. **One at a time.** Three features "since we're in here" is how sessions drift. Batches need a
   checkpoint branch first (`AGENTS.md:15-16`).
4. **Every skip and every death is written down** in the ledger, with its gate or reason.
5. **Never do unrequested work.** Not cleanup, not refactors, not "while I was there". Discoveries
   become a parked note on the next task ID (`EXECUTION_PLAN.md:28-29`).
6. **Cite or delete.** A claim with no `file:line` (Egebeya) or no KB evidence (Fresha) does not
   enter a gate, a score, or a brief.
7. **Committed = exists.** `AGENTS.md:4-5`. A decision recorded only in chat is not a decision.

## 9. Deferred scaling track *(G3 parking lot)*

Not a backlog — a list of things this architecture cannot carry cheaply: two-way calendar sync
(needs durable inbound subscription + retry), continuous BI export, real-time consumer push, bulk
messaging beyond the in-process throttle (`server/cron/runWinbackAutomations.ts:37-39`). Each
reopens when a worker + queue + a second process exist. Full reasoning:
`COMPARE-04` §Deferred scaling path.

## 10. Known holes in this workflow

- **Season 0 cannot measure.** Stage 6 is mostly "unmeasurable" until prod exists. The workflow's
  honest first output is a short list of things that make the *existing* promises true, not new
  features. That is expected, not a failure.
- **Funnel-leverage scores are structurally deflated** by the §3 cap. Expect compression at the
  top of the ranking; break ties by door reversibility, not by arguing about the numbers.
- **One decision-maker, one reviewer.** The owner is also the person who writes the code. The
  separation of powers here is between *the owner* and *the agent*, and it only holds if the agent
  behaves. Rules §8 are the enforcement.
- **Evidence inflates dead candidates under the cap.** With funnel pinned at 1, evidence ×2 is the
  largest available term (6 of 24), and it rewards *Fresha documented it* rather than *we want it
  here*. FSD-003 therefore publishes a second column, **value = total − evidence term**, and the
  two must be read together. Consider dropping the evidence weight to ×1 in Season 1 when the funnel
  axis can carry real signal.
- **G4 Parity has no meaningful score.** A parity row measures "how good would it be to rebuild
  what we already ship". Report parity exclusions as **residuals** (the sub-feature genuinely
  missing, e.g. embed widget exists / QR does not), never as scores — see FSD-003 §G4.
- **Gates can be misapplied, and that is cheaper to fix than to notice.** FSD-003 caught one:
  queue-advance push was parked at G3 ("needs a worker") when `EXECUTION_PLAN.md:627-633` already
  ruled it slots in through the existing adapter. The shadow board is what surfaced it. Run it
  whenever a gate's park list grows.
- **Weights are strategy, not math.** 3/2/2/1/2 encodes "rides rails, near the funnel, cheap to
  undo". If that stops being what you believe, change the numbers in §0 — do not argue with a
  ranking that used the old ones.
