/**
 * Lightweight role helper backed by the JWT in localStorage.
 *
 * The project does not currently ship a React AuthContext wrapper, so we read
 * the role directly from `localStorage.role` (set by `Login.tsx` and
 * `Register.tsx` from the login response). `decodeRoleFromToken` is a stronger
 * fallback because it uses the actual JWT rather than a parallel localStorage
 * key, but it is only honoured when the helper says the explicit key is
 * absent — existing call-sites already trust the localStorage value.
 */
import * as React from 'react';

export type UserRole = 'owner' | 'admin' | 'staff' | null;

function readRoleFromToken(): UserRole {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payloadB64 = token.split('.')[1];
    if (!payloadB64) return null;
    const payload = JSON.parse(
      atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')),
    ) as { role?: string };
    const r = payload.role;
    if (r === 'owner' || r === 'admin' || r === 'staff') return r;
    return null;
  } catch {
    return null;
  }
}

export function getRole(): UserRole {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('role');
  if (raw === 'owner' || raw === 'admin' || raw === 'staff') return raw;
  return readRoleFromToken();
}

export function isStaff(): boolean {
  return getRole() === 'staff';
}

export function isOwner(): boolean {
  const r = getRole();
  return r === 'owner' || r === 'admin';
}

/**
 * Re-renders when the role changes in another tab (storage event). Within
 * the same tab the role is stable for the duration of a session, so a single
 * useState read is enough.
 */
export function useRole(): UserRole {
  const [role, setRole] = React.useState<UserRole>(getRole);
  React.useEffect(() => {
    function onStorage(ev: StorageEvent) {
      if (ev.key === 'role' || ev.key === 'token') {
        setRole(getRole());
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return role;
}
