# Decision records

The memory of this repo's product work. Nothing in a chat session counts.

## What goes here

One file per **feature-selection cycle** (Stage 5 of `docs/feature-selection.md`): what was
scored, what died at a gate, what was picked, what was passed over, and what would bring each
of those back. Plus any file that changes a ruling — a gate, a threshold, a law.

## Naming

`FSD-NNN-<kebab-slug>.md` — monotonically increasing, never reused, never renumbered.
`LEDGER.md` is the running index of candidates and their states; it is updated by the agent on
every gate result and every pick, so a new session can see the whole board in one read.

## Precedence

- A decision record **outranks** a chat instruction, a README claim, or an agent's recollection.
- A decision record **never outranks** `AGENTS.md`. If a record appears to conflict with the
  never-do list, the record is wrong or the record changed the ruling *explicitly* — check its
  "Overrides" line.
- Superseding does not mean deleting. Add a `Superseded by FSD-NNN` line to the old file; the
  history is the value.

## The existing precedent

`docs/loyalty-opening.md` is a decision record that predates this folder: a dated owner decision
(`:19-29`) that changed a gate condition, with the rationale and an explicit DO NOT. Every record
here should read the same way — *what changed, why, and what is still forbidden*.
