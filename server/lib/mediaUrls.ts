/**
 * Media URL resolution with optional CDN rewriting.
 *
 * The database always stores the *relative* public path (e.g.
 * `/uploads/<tenantId>/<filename>`). At READ time the API rewrites that path
 * to an absolute CDN URL when `UPLOADS_CDN_BASE_URL` is configured:
 *
 *   `${UPLOADS_CDN_BASE_URL}/<tenantId>/<filename>`
 *
 * When the env var is unset, the relative path is returned as-is and assets
 * are served locally (see server.ts `app.use('/uploads', express.static(...))`).
 */

const CDN_BASE = (process.env.UPLOADS_CDN_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');

/**
 * Rewrite a single media path for the CDN. Passthrough when the CDN is not
 * configured or the value is not a relative `/uploads/...` path.
 */
export function resolveMediaUrl(pathValue?: string | null): string | null | undefined {
  if (pathValue == null) return pathValue;
  if (!CDN_BASE || typeof pathValue !== 'string' || !pathValue.startsWith('/uploads/')) {
    return pathValue;
  }
  return `${CDN_BASE}${pathValue.replace(/^\/uploads/, '')}`;
}

/**
 * Deep-rewrite any `/uploads/...` string inside a Puck document (or any JSON
 * value) to its absolute CDN URL, copying the structure. Used by the public
 * rendering endpoint so image `src`/`srcset` props point at the CDN.
 */
export function rewriteUploadUrls<T>(value: T): T {
  if (typeof value === 'string') {
    return resolveMediaUrl(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => rewriteUploadUrls(v)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      out[key] = rewriteUploadUrls((value as Record<string, unknown>)[key]);
    }
    return out as unknown as T;
  }
  return value;
}