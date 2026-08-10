# ADR 0009 — CSP for Sandpack / Dashboard

**Status:** proposed
**Date:** 2026-08-27
**Decision-maker:** Product owner (pending HITL confirmation)

## Context

The public pages ship a strict CSP. Dashboard/editor use a relaxed CSP to allow Sandpack’s `unsafe-eval` and `unsafe-inline`. Research ticket F5 is still open (Sandpack nonce support).

## Options

### A. Per-page nonces (preferred path)
Generate a nonce per response; only that nonce may execute. Disallow `unsafe-inline` / `unsafe-eval` for the page shell. Sandpack runs in an iframe with its own CSP and can receive a computed nonce via prop.

### B. Hash-based allowlist for page scripts `'sha256-…'`
Good for static bundles, but Vite HMR and dynamic chunks move hashes per deploy; maintainability declines fast.

### C. Dual policy — strict shell, lax iframe
Keep `unsafe-eval` / `unsafe-inline` **only** on the Sandpack iframe origin using a separate `Content-Security-Policy` header embedded as the iframe document. The parent page keeps a strict policy.

## Proposal

**Default to option C** as the minimum viable reduction of risk until F5 research confirms Sandpack nonce support.

Implementation notes:

- Server sends `strict-csp` on dashboard shell.
- Sandpack container is rendered within a route-scoped CSP that preserves the `unsafe-eval` / `unsafe-inline` requirements for the iframe document only.
- Remove any duplicate CSP header middleware that overrides helmet’s default to avoid header collisions.

Questions for product owner:

1. Do we accept the engineering cost of per-request nonce generation now, or should we ship option C first and iterate to A after F5 research?
2. Are we okay with dropping `unsafe-inline` for the parent page if it breaks a third-party dashboard widget?
