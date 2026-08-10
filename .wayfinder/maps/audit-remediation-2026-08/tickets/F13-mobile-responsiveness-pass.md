# F13 — Mobile responsiveness pass

- **Type:** `wayfinder:task`
- **Map:** Audit Remediation — 2026-08-27
- **Status:** open / unclaimed
- **Severity:** LOW
- **Location:** all routes; Puck and Sandpack editors specifically

## Question

How is mobile responsiveness verified and what fixes are needed at the 320px and 768px breakpoints?

## Context

The 2026-08-27 audit notes Puck and Sandpack editors may have inconsistent styling on small screens and that a dedicated mobile pass is needed. Mobile-first is the dominant access pattern in the Ethiopian market — the README and DESIGN.md position the platform as mobile-first.

## Constraints / known considerations

- Puck and Sandpack are third-party; their mobile behavior is what it is. Adapt the surrounding chrome (toolbars, drawers, sidebars) but not the editor internals.
- Existing tests (per `ux_audit.spec.js`) cover some flows but not Puck/Sandpack on small screens.
- The audit mentions a 2-column grid layout was added to the Register page — that's the kind of fix pattern this ticket repeats.

## Open sub-questions

1. **Breakpoints.** 320px (small phones), 768px (tablets), 1024px (small laptops)? Standard set.
2. **Scope.** Customer-facing only (booking, public site, settings), or also dashboard (Puck, Sandpack)?
3. **Verification.** Playwright with viewport emulation? Real-device testing? Lighthouse mobile audit?

## Suggested approach (when claiming)

1. Run the existing `ux_audit.spec.js` under small viewports; capture violations.
2. Manual scan of Puck and Sandpack at 320px and 768px; capture screenshots.
3. Fix chrome issues (toolbar overflow, sidebars → drawers, font scaling).
4. Add Playwright viewport assertions for the customer-facing flows.
5. Commit to `security/audit-remediation`.

## Blocked by

*(none — on the frontier)*

## Blocks

- *(none)*

## Resolution

*(filled in on close)*
