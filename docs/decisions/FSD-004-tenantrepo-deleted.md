# FSD-004 — `src/db/tenantRepo.ts`: DELETE (trap removal, not feature selection)

**Date:** 2026-09-12
**Season at decision:** 0 — ship and activate
**Weights in force:** n/a — this is a remediation ruling under issue #70, not a ranked candidate
**Supersedes / superseded by:** supersedes the unrecorded "T5.2 ruling" claimed in the file header (no T5.2 record exists in this folder — verified 2026-09-12)
**Overrides:** none. **Inline `eq(tenantId, …)` in every DB query remains the law** (AGENTS.md never-do list). This record removes a misleading artifact, not a rule.

## Board

| Candidate | Gate result | Score /33 | Door | Outcome |
|---|---|---|---|---|
| #70 option 1 — adopt `tenantRepo` across every router | n/a (remediation) | — | one-way | DEAD (zero importers; the repo-layer architecture nothing follows) |
| #70 option 2 — **delete the file** | n/a (remediation) | — | one-way | **PICKED** |
| #70 option 3 — rename to `tenantScope.ts`, adopt ≥1 call site | n/a (remediation) | — | one-way | PASSED (owner chose delete; re-entry condition below) |

## Picked

**What:** `git rm src/db/tenantRepo.ts` and make the docs tell the truth: tenant isolation is enforced by inline `eq(tenantId, …)` in every query plus auth/CSRF middleware, verified by `server/tests/cross-tenant-isolation.test.ts` — not by any repository layer.

**Why (owner's reasons, verbatim where available):** the file "looks like the isolation layer", so a new developer (or agent) assumes isolation is handled there and writes a query without the inline scope — one omission is a cross-tenant leak. The file is scaffolding for a repository-pattern refactor that never happened; a previous shrink to a 143-line "light set" under an "adopt deliberately" rule produced **zero** call sites in its lifetime. A dead file that documents an architecture nothing follows is a trap, not an asset.

**Design doc required (one-way doors only):** this record is the design doc — the change is a deletion plus documentation truthing, no behavioral surface.

**Ticket:** issue #70 on the tracker (one commit: this record's post-state, the deletion, and the doc fixes).

## Passed over — with re-entry conditions

**Option 3 — rename to `tenantScope.ts`, adopt ≥1 real call site.** Passed because adoption had already been tried ("adopt deliberately") and never happened; keeping the primitives warm kept the false "isolation layer" signal alive in a file path that reads as load-bearing.
Returns when: a measured need for shared tenant-scoped query shapes appears at ≥2 real call sites — introduced as `src/db/tenantScope.ts` with an honest "fragments, not a layer" header and at least one adopted caller **in the same commit**.

**Option 1 — full repository-layer adoption across every router.** Ruled out of scope for this remediation; if ever wanted it is its own feature-selection cycle with one ticket per router.
Returns when: the owner opens that cycle deliberately. Not before.

## Measurement commitment

**Question:** does removing the file eliminate the misleading-isolation signal without any regression in cross-tenant isolation?
**Instrument:** `server/tests/cross-tenant-isolation.test.ts` stays green untouched; grep confirms zero importers before deletion; `docs/REPO_MAP.md` register flips the row to DELETED.
**Answer by:** ship date + 4 weeks
**Verdict (fill in later):** —

## Post-implementation record (filled at commit)

- Deletion verified: `git rm src/db/tenantRepo.ts`, zero importers (grep-verified 2026-09-12 at HEAD `1f0feb7` and re-verified at commit).
- `ARCHITECTURE.md` two passages rewritten to the real enforcement chain (§Tenant resolution table + security table).
- `README.md` and `docs/REPO_MAP.md` rows updated to DELETED — see FSD-004.
- `cross-tenant-isolation.test.ts` green, untouched.
