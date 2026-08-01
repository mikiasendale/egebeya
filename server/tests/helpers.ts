/**
 * Shared test helpers for the cookie-based session model.
 *
 * Login/register now set httpOnly cookies instead of returning tokens in the
 * response body. These helpers extract the token values from the Set-Cookie
 * headers so tests can keep authenticating via the Authorization header
 * (requireAuth supports both cookie and Bearer).
 */
export function cookieValue(res: any, name: string): string | null {
  const sc: string[] = res.headers['set-cookie'] || [];
  const row = sc.find((c) => c.startsWith(`${name}=`));
  if (!row) return null;
  return row.slice(name.length + 1).split(';')[0];
}

export function cookieJar(res: any): string[] {
  return res.headers['set-cookie'] || [];
}
