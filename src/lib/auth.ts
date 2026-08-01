/**
 * Lightweight role helper for UI hints.
 *
 * The role is written to `localStorage.role` by Login/Register from the login
 * response (it is NOT a credential — the real authorization is enforced
 * server-side from the session token). Used only to decide which nav links to
 * render.
 */
import * as React from 'react';

export type UserRole = 'owner' | 'admin' | 'staff' | null;

export function getRole(): UserRole {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('role');
  if (raw === 'owner' || raw === 'admin' || raw === 'staff') return raw;
  return null;
}

export function isStaff(): boolean {
  return getRole() === 'staff';
}

export function isOwner(): boolean {
  const r = getRole();
  return r === 'owner' || r === 'admin';
}

/**
 * Re-renders when the role changes in another tab (storage event).
 */
export function useRole(): UserRole {
  const [role, setRole] = React.useState<UserRole>(getRole);
  React.useEffect(() => {
    function onStorage(ev: StorageEvent) {
      if (ev.key === 'role') {
        setRole(getRole());
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return role;
}
