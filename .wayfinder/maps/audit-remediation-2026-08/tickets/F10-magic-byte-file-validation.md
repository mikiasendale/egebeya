# F10 — Magic-byte file content validation

- **Type:** `wayfinder:research` (becomes `wayfinder:task` once library chosen)
- **Map:** Audit Remediation — 2026-08-27
- **Status:** open / unclaimed
- **Severity:** MEDIUM
- **Location:** upload middleware (multer + Sharp)

## Question

Which library (or library-free approach) is used to validate the *content* of uploaded files against their declared MIME type, and where does the check sit in the upload pipeline?

## Context

The upload pipeline currently checks `file.mimetype` (which the attacker controls in the multipart envelope). A file named `malicious.php.jpg` with a PHP payload inside can pass the MIME check if the attacker lies in the multipart header. Sharp's re-encode is a partial mitigation (it re-encodes images and throws on non-image data), but it's the *last* line of defense, not the first.

Magic-byte validation reads the first few bytes of the file and asserts they match an expected signature for the declared MIME type. This blocks the renamed-malware class before any further processing.

## Constraints / known considerations

- Existing pipeline: multer → fileFilter (MIME check) → Sharp re-encode → store. Add magic-byte check between fileFilter and Sharp.
- The library options:
  - `file-type` (npm, ~1MB, detects 100+ types from magic bytes)
  - `mmmagic` (libmagic binding, more accurate but heavier)
  - A custom Sharp-based check (read the first chunk via Sharp's `metadata()` — Sharp already verifies the file is a valid image and throws otherwise)
- Sharp's `metadata()` already does some content validation. The question is whether to add a layer *before* Sharp, or rely on Sharp's metadata check plus a MIME-mismatch reject.
- The audit notes that `.php` renamed to `.jpg` already fails on Sharp re-encode (returns 500). Magic-byte check would convert that 500 into a clean 400.

## Open sub-questions

1. **Library choice.** `file-type` is the lightest and most common choice. Is there a reason to prefer another (e.g. avoid the dep, use Sharp's metadata)?
2. **Allowed types.** Images only (current), or do we need to support other types (PDF, video)?
3. **Failure shape.** Reject with 400 + clear message, or 415 (Unsupported Media Type)?
4. **Logging.** Log a `security_event` for magic-byte mismatches.

## Suggested approach (when claiming)

1. Fire a `/research` subagent to compare `file-type`, `mmmagic`, and Sharp-metadata-only approaches for this codebase (the blocker).
2. Run `/grilling` on the chosen approach once research lands. Small decision; user may not need to weigh in unless there are trade-offs.
3. Implement: add the check to the upload middleware.
4. Test: upload a `malicious.php.jpg` (PHP payload with .jpg name and image/jpeg MIME) and assert a clean 400.
5. Commit to `security/audit-remediation`.

## Blocked by

- Research subagent (library comparison). Re-evaluates to the frontier when research lands.

## Blocks

- *(none)*

## Resolution

*(filled in on close)*
