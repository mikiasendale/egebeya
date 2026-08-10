# ADR 0010 — Tenant Password Policy

**Status:** proposed
**Date:** 2026-08-27
**Decision-maker:** Product owner (pending HITL confirmation)

## Context

No password policy is enforced. Once F2 closes, weak passwords become a more attractive attack vector.

Ethiopian user context: mobile-first signups, Amharic keyboard, low bandwidth. A strict Western password rule set will block legitimate users.

## Options

### A. NIST-style: min 8, block top-1000
Allow any length, require ≥ 8 chars, compare against a local top-1000 common-password list on the server.

### B. zxcvbn score ≥ 3
Estimate guessability with zxcvbn (server-only import). Reject below score 3.

### C. Length-only: min 12
Simplest to implement and hardest to brute-force.

## Proposal

**Propose option A** as the best friction/security balance for the current user base.

- Server-side check only; no client bundle cost.
- Reject signups with passwords in the top-1000 list or shorter than 8 chars.
- Grandfather existing users; on next password change, enforce the new policy.
- Log rejections as `security_event` at info level (not sensitive).

Questions for product owner:

1. Is 8 chars acceptable, or should the minimum be 10?
2. Should we add a client-side strength meter as a separate UX decision?
