# F12 — Accessibility audit + remediation

- **Type:** `wayfinder:task` (after research on tool choice)
- **Map:** Audit Remediation — 2026-08-27
- **Status:** open / unclaimed
- **Severity:** LOW (audit) — escalates to launch-blocker if axe run surfaces serious/critical violations
- **Location:** all routes; `src/`, `server.ts`, `index.html`

## Question

What is the accessibility baseline, and what remediation is needed to make the platform WCAG 2.1 AA-conformant (or whatever pass criterion is set)?

## Context

The 2026-08-01 audit notes: "buttons have labels, `aria-hidden` used on decorative stamps, `lang` set on `<html>` on language change. Not deeply audited (no axe run) — recommend axe pass before launch." The 2026-08-27 audit marks this as a LOW finding and adds a readiness-score of 3/5 for accessibility.

The audit surfaces partial conformance. A real pass needs automated scanning (axe-core) plus a manual review of dynamic flows (Puck editor, booking form, Sandpack iframe).

## Constraints / known considerations

- Sandpack and Puck are third-party components; their a11y is what it is. The audit scope is what *we* can fix.
- Ethiopian context: low-bandwidth, screen-readers are less common but not absent; mobile-first usage.
- The existing i18n (`<html lang>` switch on language change) is a positive signal.
- Pass criterion is in fog — needs a `/grilling` session to set.

## Open sub-questions

1. **Pass criterion.** axe-core "zero serious/critical", WCAG 2.1 AA, WCAG 2.1 AAA? The map's `Not yet specified` lists this as fog.
2. **Tooling.** axe-core via Playwright (CI-friendly), Pa11y (CI-friendly, simpler), Lighthouse (one-off), manual review only?
3. **Scope.** All pages or only customer-facing (booking, public site, settings)?

## Suggested approach (when claiming)

1. Resolve the pass-criterion fog first (a small `/grilling` session — this is a launch-readiness call).
2. Add `axe-core` (or chosen tool) to the existing Playwright suite.
3. Run a baseline; capture the violations in this ticket's resolution.
4. Fix serious/critical violations (color contrast, missing labels, focus management).
5. Commit incrementally to `security/audit-remediation`.

## Blocked by

*(none — on the frontier)*

## Blocks

- *(none)*

## Resolution

*(filled in on close)*
