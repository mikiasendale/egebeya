# ADR 0011 — Dashboard Read Rate Limit

**Status:** proposed
**Date:** 2026-08-27
**Decision-maker:** Product owner (pending HITL confirmation)

## Context

Authenticated dashboard reads are unprotected. The existing limiter pattern is `IP+tenant` in-memory.

Puck/Sandpack pages issue parallel GETs on load; the limit must tolerate legitimate bursts.

## Options

### A. 1 min / 300 req per IP+tenant
Generous; matches normal dashboard loaders without shaping traffic much.

### B. 1 min / 120 req per IP+tenant
Matches the existing Discover limiter; slightly tighter.

### C. Per-endpoint tuning
Listing pages 60/min, settings 30/min; heavier endpoints lower.

## Proposal

**Propose option A** (`1 min / 300 req per IP+tenant`) covering `/api/tenant/*` GETs, excluding endpoints that already have their own limits. If V3 load testing shows we are nowhere near that ceiling, we can tighten in a follow-up.

- Reuse the existing `rateLimiter.ts` middleware.
- On limit: 429 with `Retry-After` header aligned to existing convention.
- Scope: all dashboard read routes, not write routes (writes are already limited).

Questions for product owner:

1. Do you want a higher ceiling initially and tighten after Q2 load tests?
2. Should staff/admin roles get a higher ceiling than owner?
