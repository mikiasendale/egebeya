# F1 — Lock the unauthenticated Pro upgrade path

- **Type:** `wayfinder:grilling`
- **Map:** Audit Remediation — 2026-08-27
- **Status:** open / unclaimed
- **Severity:** CRITICAL
- **Location:** `src/api/pro-site.ts:68` (per 2026-08-01 audit), `src/api/pro-site.ts:85-150` (per 2026-08-27 audit)

## Question

What is the right architecture for the Pro upgrade path so that no tenant can self-upgrade without a completed payment, and what should the dev/trial upgrade endpoint become?

## Context

Reproduced end-to-end in 2026-08-01 audit. Any tenant can `POST /api/tenant/subscription/upgrade` and be moved to Pro with a fresh 14-day trial — no payment, no charge ID, no webhook. The endpoint is gated only by `if (process.env.NODE_ENV !== 'production')` and the inline comment admits it's a "DEV/TEST-ONLY trial path".

The 2026-08-27 audit reclassifies this as CRITICAL because the env gate is the only thing standing between the codebase and a free-forever exploit, and there is no payment-verification link in the upgrade path itself.

The existing Chapa integration has a real, webhook-driven path. The Pro trial already exists as a concept (`trial` status, 14 days). The question is: *what does the upgrade endpoint become* — and does the dev path stay reachable at all?

## Constraints / known considerations

- Production CI/CD sets `NODE_ENV=production` per `render.yaml`. Verify the env actually reaches the running server (one prior audit finding noted env-handling bugs).
- The 14-day Pro trial concept should be preserved — it's a real product feature, not a backdoor.
- A genuine payment path exists: Chapa initiate → customer pays → webhook → confirm. The upgrade should be a state transition *driven by* a webhook or a server-side verify, never a direct user request.
- The dev/trial path is useful for local testing and CI. It must not be reachable from a production build.
- There may be legitimate seed/script use of the dev path (load tests, demo data).

## Open sub-questions (decide first or as you go)

1. **What does `/api/tenant/subscription/upgrade` do in production?** Options: (a) return 404, (b) require a `verify_payment_reference` body that the server validates against Chapa before flipping the plan, (c) become a webhook-only state transition (the route is removed; Chapa webhook is the only writer of `plan='pro'`).
2. **How does a dev/CI path stay reachable?** Options: (a) gate on `process.env.EGEBEYA_ALLOW_DEV_TRIAL === 'true'` (more explicit than `NODE_ENV`), (b) require a server-side shared secret in the request, (c) only available via a CLI script (`scripts/grant-trial.ts`) and the route is removed.
3. **Trial semantics:** does the trial restart every time the upgrade endpoint is called, or only on first upgrade? (Current behavior restarts — likely a separate bug worth addressing in the same fix.)

## Suggested approach (when claiming)

1. Run `/grilling` on the three open sub-questions with the user. The user wants to be in the loop on architecture choices per the map's `Notes`.
2. Sketch the new state-machine: which paths write `plan='pro'`? Document on the ticket or in `docs/adr/`.
3. Implement: route change, server-side gate, removal of trial-restart-every-call if decided.
4. Add a regression test that proves the dev path is unreachable in a production build (e.g. spawn server with `NODE_ENV=production` and assert 404 or 403 on the dev path).
5. Commit to `security/audit-remediation`. Reference this ticket in the commit message.

## Blocked by

*(none — this is on the frontier)*

## Blocks

- V1 (Reproduce-and-close the 4 reproduced findings)
- V2 (Security regression suite)
- V4 (Red-team rerun)

## Resolution

*(filled in on close — see "Work through the map" in the wayfinder skill)*
