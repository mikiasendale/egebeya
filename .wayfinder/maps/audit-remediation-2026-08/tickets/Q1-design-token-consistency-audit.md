# Q1 — Design-token consistency audit

- **Type:** `wayfinder:task`
- **Map:** Audit Remediation — 2026-08-27
- **Status:** open / unclaimed
- **Severity:** n/a (quality dimension)
- **Location:** `src/`, `DESIGN.md`

## Question

Are the design tokens defined in `DESIGN.md` consistently applied across all UI surfaces, and what drift exists?

## Context

The 2026-08-27 audit verifies the design tokens are documented:
- `--color-primary: #0FA958` (Telebirr green)
- `--color-surface: #F6F1E8` (Paper)
- `--color-ink: #1A1411`
- `--color-accent: #D33426` (Signal)
- `--color-canvas: #3B2820` (Dark surfaces)
- Fonts: Bricolage Grotesque (display/headline), Inter (body)

The audit identifies three concerns:
1. CSP `unsafe-inline` / `unsafe-eval` on dashboard (separate ticket F5)
2. Need verification that all UI components use semantic tokens from the design system
3. Sandpack editor UI may have inconsistent styling compared to dashboard

## Constraints / known considerations

- `DESIGN.md` is the source of truth.
- The token names (semantic vs raw) — audit says "semantic tokens from the design system", but the values listed are raw. The semantic layer is the question.
- Tailwind V4 — tokens should map to Tailwind theme keys (`bg-primary`, `text-ink`, etc.) and not to arbitrary hex values inline.
- The audit uses `/impeccable` for this kind of work per the map's `Notes`.

## Suggested approach (when claiming)

1. Load `/impeccable` for the audit method.
2. Grep for raw hex values in `src/`; flag any that bypass the token system.
3. Grep for hardcoded Tailwind class colors; flag any that bypass the theme.
4. Verify the Sandpack toolbar/chrome can be themed to match dashboard tokens (or is correctly isolated).
5. Report findings; remediate drift by replacing raw values with tokens.
6. Commit to `security/audit-remediation`.

## Blocked by

*(none — on the frontier)*

## Blocks

- *(none)*

## Resolution

*(filled in on close)*
