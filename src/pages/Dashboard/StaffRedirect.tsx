import React from 'react';
import { Navigate } from 'react-router-dom';
import { isStaff } from '../../lib/auth';

/**
 * Inline guard: when the active user is a non-owner (staff) account, render
 * `<Navigate to=/dashboard/bookings />` immediately. Owner and admin users
 * see `children` unchanged. Used to wrap individual restricted dashboard
 * pages so staff accounts can't access Services, Staff, Media, Website
 * Editor, Settings, or Overview.
 */
export function StaffRedirect({ children }: { children: React.ReactNode }) {
  if (typeof window === 'undefined') return <>{children}</>;
  if (isStaff()) {
    return <Navigate to="/dashboard/bookings" replace />;
  }
  return <>{children}</>;
}
