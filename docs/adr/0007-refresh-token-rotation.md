# ADR 0007 — Refresh Token Rotation Strategy

**Status:** proposed
**Date:** 2026-08-27
**Decision-maker:** Product owner (pending HITL confirmation)

## Context

Egebeya currently stores a `refreshTokenId` (opaque jti) on the user record, but the refresh endpoint does not validate it. An intercepted refresh token can therefore be replayed indefinitely within its 7-day window. RFC 6819 §5.2.2.3 recommends rotation + reuse detection.

Multi-device usage must be preserved: a phone refresh should not log out a laptop.

The stack is Express 5 + SQLite/libsql + Drizzle; there is no Redis. Rotation state must therefore live in the database or in short-lived JWT claims.

## Options

### A. Family-based rotation (recommended)
Add a `refresh_token_families` table. Each user has many open families (one per device/login). On refresh a new child jti is issued and linked to the family. Server validates incoming jti against the latest child for that family. On reuse detection, the entire family is revoked (compromise response). Logout apples to a single family by default.

Pros: multi-device safe; matches OAuth 2.0 BCP recommendations; survives server restarts (DB-backed); soft logout per device possible.  
Cons: new table + a few queries per refresh; slightly more complex.

### B. Single-jti rotation
Keep `users.refreshTokenId` as a single current jti. Every refresh rotates it. Reuse detection revokes the whole user account/token version.

Pros: simplest code change.  
Cons: logging in on a new device logs out the previous one (multi-device broken).

### C. Short-lived refresh tokens
Reduce RT lifetime to ~15 minutes and require silent refreshes on each API call. Replay window is small.

Pros: minimizes replay impact.  
Cons: frequent DB writes; mobile/low-bandwidth users see more churn; still benefits from rotation + detection.

## Proposal

**Adopt option A** with the following details:

- New table `refresh_token_families(id, userId, parentJti, currentJti, createdAt, lastUsedAt, revokedAt)`.
- New table `refresh_token_children(id, familyId, jti, createdAt, usedAt, revokedAt)` — child history is not strictly required but helps forensic logging; start with just `currentJti` on the family if simpler.
- `/api/auth/refresh` reads the incoming cookie jti, resolves its family, verifies it matches `family.currentJti`. On match: issue new access token + new RT, create new child jti, update `family.currentJti` and `lastUsedAt`.
- On mismatch (reuse): mark family `revokedAt = now`, bump `users.tokenVersion` (kills existing access tokens), issue a fresh RT for the legitimate caller only after forcing re-auth — or deny entirely per RFC 6819 (revoke family, require password re-login everywhere).
- `logout` revokes only the calling family (or all families if user selects “log out all devices”).
- All family lookups are keyed by `userId`; unique indexes keep lookups fast.

Questions for product owner:

1. Should reuse revoke **all** devices, or just the replayed family?
2. Should users see a “logged out on other devices” notice, or silent revocation?
3. Do we need a “log out everywhere” endpoint now, or is it acceptable to ship without it?
