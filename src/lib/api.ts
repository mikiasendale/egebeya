// Authenticated fetch with automatic access-token refresh.
//
// On a 401 from any protected endpoint, this wrapper transparently:
//   1. Calls /api/auth/refresh with the stored refreshToken.
//   2. If it succeeds, persists the returned access token and retries the
//      original request once.
//   3. If it fails (or no refresh token is present), clears credentials and
//      redirects to /login.
//
// A single in-flight refresh promise is shared across concurrent requests so
// that a burst of 401s only triggers one refresh round-trip.

const ACCESS_TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refreshToken';
const REFRESH_ENDPOINT = '/api/auth/refresh';

let refreshPromise: Promise<string> | null = null;

function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setTokens(accessToken: string, refreshToken?: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  // Backend /api/auth/refresh currently returns only a new `token` (the same
  // refresh token remains valid for its 7-day lifetime), but we honor a new
  // one if the server ever starts returning it.
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function redirectToLogin(): void {
  clearTokens();
  // Avoid redirect loops if we are already on the login page.
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

function decodeExp(token: string): number | null {
  try {
    const payloadB64 = token.split('.')[1];
    if (!payloadB64) return null;
    const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const { exp } = JSON.parse(payloadJson) as { exp?: number };
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

// Refresh the access token once, sharing the promise across concurrent calls.
function refreshAccessToken(): Promise<string> {
  const existing = refreshPromise;
  if (existing) return existing;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const res = await fetch(REFRESH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      throw new Error('Refresh failed');
    }

    const data = (await res.json()) as { token?: string; refreshToken?: string };
    if (!data.token) {
      throw new Error('No token returned');
    }
    setTokens(data.token, data.refreshToken);
    return data.token;
  })()
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export interface AuthFetchOptions extends RequestInit {
  // Set skipAuth to true for endpoints that are public and never need a token
  // (e.g. /api/public/*). Bare `fetch` is fine for those, this just keeps
  // callers explicit if they prefer a uniform import.
  skipAuth?: boolean;
}

// URLs that never require a Bearer token. Even when a token is present in
// localStorage, we deliberately omit the Authorization header so a stale
// token cannot trigger a noisy refresh on a code path that does not need
// one (e.g. the public booking flow).
function isPublicPath(input: RequestInfo | URL): boolean {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : (input as Request).url;
  return /\.egebeya\.et/.test(url) || url.includes('/api/public/');
}

// Drop-in replacement for `fetch` for any request that targets a protected
// (Bearer-token) endpoint. It injects the Authorization header and handles
// the refresh/retry/redirect flow described above.
export async function authFetch(
  input: RequestInfo | URL,
  options: AuthFetchOptions = {},
): Promise<Response> {
  const { skipAuth = false, headers, ...rest } = options;
  const publicPath = isPublicPath(input);

  const buildHeaders = (): HeadersInit => {
    const token = getAccessToken();
    const h = new Headers(headers);
    if (!skipAuth && !publicPath && token && !h.has('Authorization')) {
      h.set('Authorization', `Bearer ${token}`);
    }
    return h;
  };

  let res = await fetch(input, { ...rest, headers: buildHeaders() });

  if (res.status !== 401 || skipAuth || publicPath) {
    return res;
  }

  // 401 — attempt a single silent refresh, then retry once.
  try {
    const newToken = await refreshAccessToken();
    const retryHeaders = new Headers(headers);
    retryHeaders.set('Authorization', `Bearer ${newToken}`);
    res = await fetch(input, { ...rest, headers: retryHeaders });
    if (res.status === 401) {
      redirectToLogin();
    }
    return res;
  } catch {
    redirectToLogin();
    // Re-throw a minimal error so callers' try/catch see a failure rather than
    // the original (now-stale) response. Swallowing the redirect here would let
    // callers proceed on the expired response.
    throw new Error('Session expired');
  }
}

// `apiFetch` is the canonical name preferred by callers that expect a single
// fetch-like API. Internally it's the same function as `authFetch`.
export const apiFetch = authFetch;

// Optional convenience: returns the epoch-ms expiry of the current access
// token, or null if unknown. Callers may use it to proactively refresh before
// a request, but authFetch already handles 401 reactively.
export function getAccessTokenExp(): number | null {
  const token = getAccessToken();
  if (!token) return null;
  return decodeExp(token);
}

export { getAccessToken, getRefreshToken, setTokens, clearTokens };
