# F7 — UUID-only media filenames

- **Type:** `wayfinder:task`
- **Map:** Audit Remediation — 2026-08-27
- **Status:** open / unclaimed
- **Severity:** MEDIUM
- **Location:** upload middleware (Sharp re-encode path), `storage/` directory

## Question

How is the media-storage filename normalized so that the on-disk filename does not leak the user-supplied original filename, and so URL guessing is impractical?

## Context

The 2026-08-27 audit reports that uploaded media filenames are predictable: an attacker who knows a tenant's likely filenames (e.g. `logo.jpg`, `cover.jpg`) can probe the media URL. The Sharp re-encode to `.jpg` already produces *some* randomization but the audit found the original filename is part of the URL in some paths.

The fix is mechanical: store the file as `<uuid>.jpg` and serve from a UUID-keyed URL. Backward-compat with existing media is the only decision.

## Constraints / known considerations

- Existing media URLs are likely already in user-facing dashboards, settings pages, and possibly Puck-built sites.
- Sharp re-encode already gives a UUID-style filename on disk; the leak is in the *route* that returns the URL to the client, not the file itself.
- The change should not break existing media URLs (graceful path).
- Cross-tenant isolation depends on the URL not being predictable; this is a defense-in-depth measure.

## Suggested approach (when claiming)

1. Audit the upload path: where is the URL constructed? Where is the filename set?
2. Normalize: every stored filename is `crypto.randomUUID()` (already used elsewhere per the audit).
3. For existing media: leave URLs intact (no migration needed), but new uploads use UUID-only.
4. Add a test that asserts no media URL contains a non-UUID filename after upload.
5. Commit to `security/audit-remediation`.

## Blocked by

*(none — smallest ticket on the frontier)*

## Blocks

- *(none)*

## Resolution

*(filled in on close)*
