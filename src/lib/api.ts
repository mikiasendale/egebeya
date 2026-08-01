// Authenticated fetch for the cookie-based session model.
//
// Access + refresh tokens live in httpOnly cookies set by the server — they
// are never stored in localStorage and never sent as an Authorization header
// by this client. On a 401 this wrapper calls /api/auth/refresh (the refresh
// cookie rotates the access cookie) and retries once. State-changing requests
// also echo the non-httpOnly `csrf_token` cookie in the X-CSRF-Token header.

const CSRF_COOKIE = 'csrf_token';
const REFRESH_ENDPOINT = '/api/auth/refresh';

let refreshPromise: Promise<boolean> | null = null;

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// URLs that never require a session and should not trigger the refresh loop
// on a 401 (e.g. the public booking flow).
function isPublicPath(input: RequestInfo | URL): boolean {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : (input as Request).url;
  return /\.egebeya\.et/.test(url) || url.includes('/api/public/');
}

function buildHeaders(options: AuthFetchOptions, method?: string): HeadersInit {
  const h = new Headers(options.headers);
  const m = (method || 'GET').toUpperCase();
  if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') {
    const csrf = getCsrfToken();
    if (csrf) h.set('X-CSRF-Token', csrf);
  }
  return h;
}

// Non-secret UI hints only — the real session lives in cookies.
function clearSessionState(): void {
  if (typeof window === 'undefined') return;
  ['role', 'tenantId', 'tenantSlug', 'isSuperadmin'].forEach((k) => localStorage.removeItem(k));
}

export function redirectToLogin(): void {
  clearSessionState();
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

// Rotate the access cookie via the httpOnly refresh cookie. Returns true when
// a fresh session is available. Shared across concurrent callers.
function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(REFRESH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
      });
      return res.ok;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export interface AuthFetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function authFetch(
  input: RequestInfo | URL,
  options: AuthFetchOptions = {},
): Promise<Response> {
  const { skipAuth = false, headers, ...rest } = options;
  const publicPath = isPublicPath(input);

  let res = await fetch(input, {
    ...rest,
    credentials: 'same-origin',
    headers: buildHeaders({ headers }, rest.method),
  });

  if (res.status !== 401 || skipAuth || publicPath) {
    return res;
  }

  // 401 — attempt a single silent refresh, then retry once.
  try {
    const ok = await refreshAccessToken();
    if (!ok) throw new Error('Session expired');
    res = await fetch(input, {
      ...rest,
      credentials: 'same-origin',
      headers: buildHeaders({ headers }, rest.method),
    });
    if (res.status === 401) {
      redirectToLogin();
    }
    return res;
  } catch {
    redirectToLogin();
    throw new Error('Session expired');
  }
}

export const apiFetch = authFetch;
