ID: E-ms-05 (+ Fresha pair F-sa-95; sibling F-sa-94 same row)
Name: Processing & finishing times / buffers & extra time
Surface: merchant SaaS (A/C/D declared; B's paper-wide gap noted — no clash)
Category: merchant-scheduling
Class: GAP (COMPARE-01:106-107, :311)
Fresha behaviour: Buffer/processing time and per-appointment extra time make the calendar reflect real chair time. (OBSERVED — fb-scheduling; hc/101630; /pricing feature row.)
Egebeya current state: One `durationMinutes` per service (src/db/schema.ts:71), fixed 30-minute slot grid (public.ts:571), end-time computed in three places (public.ts:800, bookings.ts:345 walk-in, v1.ts:158); recurring expansion exists twice (cron/expandRecurring.ts:39 vs tenant.ts:1803 — T6.4).
Blockers: infra-adjacent engineering prerequisite — T6.4 dual expansion-logic consolidation (verified in repo-map; T7.15 itself says land T6.4 first).
Debate summary: A, C, and the Chair all gate the row behind T6.4: the ledger's BLOCKED status is an engineering prerequisite, not product sequencing (A). The effort dispute — COMPARE-04's S vs B's M — was resolved FOR B by the Chair: "columns S; correctness is not," given three end-time writers, the padded availability grid, and the duplicated expansion logic (audit row 16). C added the HOW constraint above the T6.4 gate: buffers must not touch queue derivation — queue.ts stays read-only (AGENTS.md:21-22), the ETA maths (queue.ts:100-114) is booking-correctness territory with a regression-suite-first rule. D rated it LOW-MED: the queue's ETA engine already tolerates slip by design; buffers matter for prepay-booked med-spa sequences, not a barber's day.
Council ruling: DEFER behind T6.4 (Chair; re-entry automatic when T6.4 lands).
Closure method (if BUILD): N/A — DEFER; the re-entry spec is T7.15: additive guarded `buffer_minutes` on services + `extra_minutes` on appointments (idempotent ADD COLUMN per AGENTS.md), end time = start + duration + buffer + extra in all three writers, availability pads the interval, recurring expansion inherits padded duration after dedup.
Substitute method (if any): none invented — D's honest observation is that the walk-in queue's learned-duration ETA (queue.ts:100-114) already absorbs real chair-time slip where it hurts most; the fixed grid under-sells sequences, which is a pricing-efficiency loss, not a booking lie.
Owner: Engineering Lead (T6.4 first, then this)
Effort: M (Chair resolved S-vs-M dispute FOR B — deviation from COMPARE-04's S)
Money path: NO (no amount change; duration padding touches availability and ETA reads, not effectiveAmount)
Protected decision referenced (if any): none.
EGE-ADVANTAGE collision (if any): YES-if-it-touches-queue-derivation (C) — queue.ts is read-only per AGENTS.md:21; buffers must land without refactoring queue derivation.
Merchant evidence: frequency UNDOCUMENTED; day-1 n (D); local truth OBSERVED — clients arrive/leave late, chair time fluid in walk-in-dominant shops.
Confidence: HIGH
CEO ruling (final): Not escalated — council ruling stands.
