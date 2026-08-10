# Q3 — SEO audit on Puck pages

- **Type:** `wayfinder:task`
- **Map:** Audit Remediation — 2026-08-27
- **Status:** open / unclaimed
- **Severity:** n/a (quality dimension)
- **Location:** `src/` (Puck-built sites render at public tenant URLs)

## Question

Are Puck-built pages properly indexed by search engines, and what SEO gaps exist?

## Context

Each tenant has a Puck-built public website. The 2026-08-27 audit marks SEO 3/5 with "Puck-generated pages need SEO audit". Puck is a visual editor that produces a JSON data structure; the renderer must convert it to proper HTML with semantic tags, meta tags, structured data, and OpenGraph tags.

## Constraints / known considerations

- Puck's renderer (in `src/`) is what produces the HTML for public tenant sites.
- SEO basics to check: `<title>`, `<meta name="description">`, `<meta property="og:*">`, `<link rel="canonical">`, structured data (JSON-LD), `alt` on images, `lang` attribute, sitemap, robots.txt.
- Render mode matters: SPA means SEO depends on either pre-rendering or careful meta-tag injection on hydration.
- Tenant-slug URLs are the public surface (`<slug>.egebeya.et` per the audit).

## Suggested approach (when claiming)

1. Load the `/impeccable` skill for the audit method.
2. Crawl a representative Puck-built site (e.g. the audit's `aud41450` tenant) with a tool of choice (Lighthouse SEO audit, manual, `seo-analyzer`).
3. Catalog gaps: missing meta tags, missing structured data, missing sitemap, etc.
4. Fix gaps in the Puck renderer.
5. Commit to `security/audit-remediation`.

## Blocked by

*(none — on the frontier)*

## Blocks

- *(none)*

## Resolution

*(filled in on close)*
