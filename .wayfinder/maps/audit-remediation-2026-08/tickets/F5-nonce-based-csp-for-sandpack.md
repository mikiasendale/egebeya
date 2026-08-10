# F5 — Nonce-based CSP that still serves Sandpack

- **Type:** `wayfinder:research` (becomes `wayfinder:grilling` once research lands)
- **Map:** Audit Remediation — 2026-08-27
- **Status:** open / unclaimed
- **Severity:** MEDIUM
- **Location:** `server/middleware/csp.ts`, `server.ts`, Sandpack integration

## Question

Can the dashboard/SPA CSP be tightened from `unsafe-inline`/`unsafe-eval` to a nonce-based policy while still serving the Puck + Sandpack website builder, and what is the minimum-cost architecture to do so?

## Context

The 2026-08-27 audit notes that the CSP on the dashboard allows `unsafe-inline` and `unsafe-eval` to make Sandpack work, which is an XSS risk if code injection ever lands in the page. The public-surface CSP is already strict; the dashboard's is loose for the editor.

Sandpack is a CodeSandbox-in-the-browser product. It loads remote bundles, evaluates user-authored code in an isolated iframe, and depends on dynamic script injection for the bundler runtime. Whether it supports per-request nonces is a fact, not a decision.

## Constraints / known considerations

- Sandpack is the editor for the website builder; replacing it is out of scope.
- Puck is the visual editor; less CSP-sensitive than Sandpack but uses iframes.
- Helmet's CSP middleware conflicts with the project's custom `strictCsp` middleware (noted in the audit). The nonce strategy needs to pick one or layer them.
- `'strict-dynamic'` with a per-request nonce is the modern mitigation; it allows scripts loaded by a trusted script to load further scripts without `unsafe-inline`.
- The CSP must survive an HMR / Vite dev-server workflow where inline scripts change every request.

## Open sub-questions

1. **Sandpack nonce support:** does the current Sandpack version support `nonce` attributes on its injected scripts? (Research ticket — this is the blocker.)
2. **Puck nonce support:** does Puck inject any inline scripts that would break under nonce CSP?
3. **CSP architecture:** is the answer (a) per-request nonce for the dashboard, (b) isolated iframe with strict CSP for the Sandpack mount and relaxed CSP for the rest, (c) hash-based allowlist for known inline scripts, (d) keep `unsafe-inline` for the dashboard and accept the residual risk?
4. **Helmet vs custom CSP:** which wins? Helmet is the standard; the project's custom middleware is doing one specific thing (public-surface strict CSP). Reorganize.

## Suggested approach (when claiming)

1. Fire a `/research` subagent to answer open sub-questions 1 and 2 against the *current* versions of Sandpack and Puck (not the audit's snapshot — versions may have advanced).
2. Run `/grilling` on the architecture choice once research lands. **The user wants to weigh in per the map's `Notes`.**
3. Prototype the chosen architecture (likely a small change to `server/middleware/csp.ts` and Sandpack's `options` prop) and verify in the browser dev tools that CSP doesn't break the editor.
4. Commit to `security/audit-remediation`.

## Blocked by

- Research subagent (Sandpack nonce support + Puck nonce support). Re-evaluates to the frontier when research lands.

## Blocks

- V4 (Red-team rerun) — CSP is part of the red-team's expected posture.

## Resolution

*(filled in on close)*
