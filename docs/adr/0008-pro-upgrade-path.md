# ADR 0008 — Pro Upgrade Path / Dev Trial Endpoint

**Status:** proposed
**Date:** 2026-08-27
**Decision-maker:** Product owner (pending HITL confirmation)

## Context

`POST /api/tenant/subscription/upgrade` upgrades a tenant to Pro with a 14-day trial and no payment verification. It is gated only by `process.env.NODE_ENV !== 'production'`, and a prior audit shows it was accidentally exposed in production. The 2026-08-27 audit reclassifies this as CRITICAL.

## Options

### A. Remove the route entirely; use a CLI script for dev/CI
Keep `npm run grant-trial` as the only local way to issue a trial. In production the route is absent.

### B. Gate on an explicit feature flag
Replace `NODE_ENV` with `process.env.EGEBEYA_ALLOW_DEV_TRIAL === 'true'`. Still risky if the flag leaks.

### C. Require a server-side shared secret
Route stays but requires `x-egb-dev-secret` header matching a server secret. Only CI/local knows the secret.

## Proposal

**Adopt option A** for the strongest blast radius reduction. Specifically:

- Remove the HTTP route from the public router in production builds (delete or `if (dev) app.use(...)` so it is not even mounted when `isProd()` is true).
- Keep `scripts/grant-trial.ts` as the local/trial issuer. It runs server-side and is not exposed over HTTP.
- Trial semantics: a tenant may receive a trial only once (do not restart the 14-day window on repeat calls). If a trial is requested twice, return a clear error instead of resetting the clock.
- Regression test: spin up the server with `NODE_ENV=production` and assert `POST /api/tenant/subscription/upgrade` returns 404.

Questions for product owner:

1. Is the “trial only once” rule acceptable, or do you want a “reset trial” admin flow?
2. Should we keep the route behind a secret header (option C) as a secondary guard, even with the CLI?
