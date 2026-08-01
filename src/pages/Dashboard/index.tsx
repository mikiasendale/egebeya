import React, { useEffect, useMemo, useState } from 'react';
import { Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  Home, Calendar, Scissors, Users, Globe, Image, Settings, LogOut,
  Plus, CalendarPlus, ImagePlus,
} from 'lucide-react';
import { format } from 'date-fns';
import { Bookings } from './Bookings';

import { WebsiteBuilder } from './WebsiteBuilder';

import { Settings as SettingsComponent } from './Settings';

import { ServicesPage } from './ServicesPage';
import { StaffPage } from './StaffPage';
import { MediaLibraryPage } from './MediaLibraryPage';
import { authFetch } from '../../lib/api';
import { getRole, useRole, isStaff } from '../../lib/auth';
import { StaffRedirect } from './StaffRedirect';
import { BuilderModeProvider, useBuilderMode } from './BuilderModeContext';

const STAFF_NAV = [{ name: 'Bookings', path: '/dashboard/bookings', icon: Calendar }];

const ALL_NAV = [
  { name: 'Overview', path: '/dashboard', icon: Home },
  { name: 'Bookings', path: '/dashboard/bookings', icon: Calendar },
  { name: 'Services', path: '/dashboard/services', icon: Scissors },
  { name: 'Staff', path: '/dashboard/staff', icon: Users },
  { name: 'Website Builder', path: '/dashboard/website-builder', icon: Globe },
  { name: 'Media Library', path: '/dashboard/media', icon: Image },
  { name: 'Settings', path: '/dashboard/settings', icon: Settings },
];

export function Dashboard() {
  return (
    <BuilderModeProvider>
      <DashboardInner />
    </BuilderModeProvider>
  );
}

function DashboardInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = useRole();
  const { mode: builderMode } = useBuilderMode();
  const [sidebarHovered, setSidebarHovered] = useState(false);

  // In Code Mode the sidebar auto-minimizes to icon-only (60px) and expands on
  // hover, overlaying the content, so the code editor gets maximum space.
  const isCodeMode = builderMode === 'code';
  const sidebarExpanded = isCodeMode ? sidebarHovered : true;

  // Stub logout
  const handleLogout = async () => {
    // Clear the server-side session (bumps token_version + clears cookies).
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // best-effort — still clear local UI state below
    }
    ['role', 'tenantId', 'tenantSlug', 'isSuperadmin'].forEach((k) => localStorage.removeItem(k));
    navigate('/login');
  };

  const navItems = role === 'staff' ? STAFF_NAV : ALL_NAV;

  return (
    <div className="min-h-screen bg-paper flex" style={{ fontFamily: 'var(--font-body)' }}>
      {/* Sidebar — collapsible (60px) in Code Mode, expanded on hover */}
      <aside
        onMouseEnter={() => isCodeMode && setSidebarHovered(true)}
        onMouseLeave={() => isCodeMode && setSidebarHovered(false)}
        className={`bg-paper-bleached border-r border-ink-rule flex-col hidden md:flex transition-[width] duration-200 ease-in-out overflow-hidden ${
          isCodeMode ? 'fixed left-0 top-0 bottom-0 z-40' : 'w-64'
        }`}
        style={isCodeMode ? { width: sidebarExpanded ? 250 : 60 } : undefined}
      >
        <div className={`h-16 flex items-center border-b border-ink-rule ${sidebarExpanded ? 'px-6' : 'justify-center'}`}>
          <svg className="h-8 w-auto text-ink" viewBox="0 0 100 50" fill="currentColor">
            <text x="50" y="20" fontSize="20" fontWeight="bold" textAnchor="middle" fill="currentColor" fontFamily="'Noto Serif Ethiopic', serif">ኢ-ገበያ</text>
            <text x="50" y="40" fontSize="16" fontWeight="bold" textAnchor="middle" fill="currentColor" fontFamily="'Bricolage Grotesque', system-ui, sans-serif">Egebeya</text>
          </svg>
        </div>

        <nav className={`flex-1 py-6 space-y-1 overflow-y-auto ${sidebarExpanded ? 'px-4' : 'px-2'}`}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (location.pathname === '/dashboard/' && item.path === '/dashboard');
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                title={!sidebarExpanded ? item.name : undefined}
                className={`flex items-center rounded-md transition-colors ${
                  sidebarExpanded ? 'px-3 py-2.5 text-sm font-medium' : 'justify-center py-2.5'
                } ${
                  isActive
                    ? 'bg-ink/10 text-ink'
                    : 'text-ink hover:bg-paper-raised'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-ink' : 'text-ink-stamp'} ${sidebarExpanded ? 'mr-3' : ''}`} />
                {sidebarExpanded && item.name}
              </Link>
            );
          })}
        </nav>

        <div className={`border-t border-ink-rule ${sidebarExpanded ? 'p-4' : 'p-2'}`}>
          <button
            onClick={handleLogout}
            title={!sidebarExpanded ? 'Sign Out' : undefined}
            className={`flex items-center rounded-md hover:bg-paper-raised transition-colors ${
              sidebarExpanded ? 'w-full px-3 py-2 text-sm font-medium text-ink' : 'w-full justify-center py-2 text-ink'
            }`}
          >
            <LogOut className="h-5 w-5 text-ink-stamp" />
            {sidebarExpanded && <span className="ml-3">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 flex flex-col min-h-screen overflow-hidden ${isCodeMode ? 'md:ml-[60px]' : ''}`}>
        <header className="h-16 bg-paper-bleached border-b border-ink-rule flex items-center px-6 md:px-8">
          <h1 className="text-xl font-bold text-ink">Dashboard</h1>
        </header>

        <div className="flex-1 p-6 md:p-8 overflow-y-auto">
          <Routes>
            <Route path="/" element={<OverviewOrRedirect />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/website-builder" element={<WebsiteBuilder />} />
            {/* Legacy editor routes redirect to the unified builder */}
            <Route path="/website" element={<Navigate to="/dashboard/website-builder" replace />} />
            <Route path="/code" element={<Navigate to="/dashboard/website-builder" replace />} />
            <Route path="/media" element={<MediaLibraryPage />} />
            <Route path="/settings" element={<SettingsComponent />} />
            <Route path="*" element={<Navigate to="/dashboard/bookings" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

/**
 * `/dashboard` defaults to the Overview tab for owners and admins. Staff
 * accounts have no Overview tab — bounce them to their only allowed tab,
 * Bookings, instantly so they never see the admin setup guide.
 */
function OverviewOrRedirect() {
  if (isStaff()) {
    return <Navigate to="/dashboard/bookings" replace />;
  }
  return <Overview />;
}

function Overview() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [counts, setCounts] = useState<{ bookings: number; services: number; staff: number }>(
    { bookings: 0, services: 0, staff: 0 },
  );
  const [recent, setRecent] = useState<any[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  useEffect(() => {
    authFetch('/api/tenant/settings')
      .then(r => r.json())
      .then((s: any) => setOnboardingComplete(!!s?.onboarding_completed))
      .catch(() => setOnboardingComplete(false));

    // Today's confirmed+pending bookings count via the bookings endpoint
    authFetch('/api/bookings')
      .then(r => (r.ok ? r.json() : []))
      .then((rows: any[]) =>
        setCounts(c => ({ ...c, bookings: Array.isArray(rows) ? rows.length : 0 })))
      .catch(() => {});

    authFetch('/api/tenant/services')
      .then(r => (r.ok ? r.json() : []))
      .then((rows: any[]) =>
        setCounts(c => ({ ...c, services: Array.isArray(rows) ? rows.length : 0 })))
      .catch(() => {});

    authFetch('/api/tenant/staff')
      .then(r => (r.ok ? r.json() : []))
      .then((rows: any[]) =>
        setCounts(c => ({ ...c, staff: Array.isArray(rows) ? rows.length : 0 })))
      .catch(() => {});

    // Recent confirmed appointments feed — server may not implement
    // status filtering, so we slice client-side after sorting by startTime desc.
    setLoadingRecent(true);
    authFetch('/api/bookings?status=confirmed')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: any[]) => {
        if (!Array.isArray(rows)) {
          setRecent([]);
          return;
        }
        const confirmed = rows.filter((b) => b && b.status === 'confirmed');
        confirmed.sort((a, b) => (b.startTime ?? 0) - (a.startTime ?? 0));
        setRecent(confirmed.slice(0, 5));
      })
      .catch(() => setRecent([]))
      .finally(() => setLoadingRecent(false));
  }, []);

  return (
    <StaffRedirect>
      <div className="space-y-6">
        {!onboardingComplete && (
          <div className="bg-paper-bleached p-6 rounded-xl border border-ink-rule">
            <h2 className="text-lg font-bold text-ink mb-4">Setup Guide</h2>
            <div className="space-y-4">
              <SetupStep completed={true} title="Create account & business profile" />
              <SetupStep completed={counts.services > 0} title="Add your first service" />
              <SetupStep completed={counts.staff > 0} title="Add staff & availability" />
              <SetupStep completed={onboardingComplete === true} title="Customize your website" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-paper-bleached p-6 rounded-xl border border-ink-rule">
            <div className="text-sm font-medium text-ink-soft mb-1">Bookings</div>
            <div className="text-3xl font-bold text-ink">{counts.bookings}</div>
          </div>
          <div className="bg-paper-bleached p-6 rounded-xl border border-ink-rule">
            <div className="text-sm font-medium text-ink-soft mb-1">Active Services</div>
            <div className="text-3xl font-bold text-ink">{counts.services}</div>
          </div>
          <div className="bg-paper-bleached p-6 rounded-xl border border-ink-rule">
            <div className="text-sm font-medium text-ink-soft mb-1">Staff Members</div>
            <div className="text-3xl font-bold text-ink">{counts.staff}</div>
          </div>
        </div>

        <QuickActions />

        <RecentActivity items={recent} loading={loadingRecent} />
     </div>
   </StaffRedirect>
  );
}

function QuickActions() {
  const actions: { name: string; to: string; icon: any; accent: string }[] = [
    { name: 'Add Service', to: '/dashboard/services', icon: Plus, accent: 'bg-ink/10 text-ink' },
    { name: 'Add Staff', to: '/dashboard/staff', icon: CalendarPlus, accent: 'bg-telebirr/10 text-telebirr-deep' },
    { name: 'View Media', to: '/dashboard/media', icon: ImagePlus, accent: 'bg-amber-50 text-amber-700' },
  ];
  return (
    <section>
      <h2 className="text-lg font-bold text-ink mb-3">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {actions.map((a) => (
          <Link
            key={a.name}
            to={a.to}
            className="flex items-center gap-3 bg-paper-bleached border border-ink-rule rounded-lg px-4 py-4 hover:opacity-90 transition"
          >
            <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${a.accent}`}>
              <a.icon className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-semibold text-ink">{a.name}</div>
              <div className="text-xs text-ink-soft">Open the page →</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function RecentActivity({ items, loading }: { items: any[]; loading: boolean }) {
  return (
    <section className="bg-paper-bleached rounded-xl border border-ink-rule">
      <header className="px-6 py-4 border-b border-ink-rule">
        <h2 className="text-lg font-bold text-ink">Recent Activity</h2>
      </header>

      {loading ? (
        <div className="p-6 text-sm text-ink-soft">Loading recent bookings…</div>
      ) : items.length === 0 ? (
        <div className="p-6 text-sm text-ink-soft">
          No recent activity.
        </div>
      ) : (
        <ul role="list" className="divide-y divide-ink-rule">
          {items.map((b) => {
            const time = b.startTime ? format(new Date(b.startTime), 'HH:mm') : '--:--';
            const minutesAgo = b.startTime
              ? Math.max(0, Math.round((Date.now() - b.startTime) / 60000))
              : null;
            const ago = minutesAgo == null
              ? ''
              : minutesAgo < 1
                ? 'just now'
                : minutesAgo < 60
                  ? `Booked ${minutesAgo}m ago`
                  : `Booked ${Math.round(minutesAgo / 60)}h ago`;
            return (
              <li key={b.id} className="flex items-center gap-4 px-6 py-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink/10 text-ink font-semibold text-sm">
                  {(b.customerName && b.customerName.charAt(0)) || '?'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink truncate">
                    {b.customerName || 'Customer'}
                    <span className="text-ink-stamp"> · {b.serviceName || 'Service'}</span>
                  </div>
                  <div className="text-xs text-ink-soft">
                    {ago}
                  </div>
                </div>
                <div className="text-sm font-medium text-ink">{time}</div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function SetupStep({ completed, title }: { completed: boolean; title: string }) {
  return (
    <div className="flex items-center space-x-3">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${completed ? 'bg-telebirr/10 text-telebirr-deep' : 'bg-paper-raised text-ink-stamp'}`}>
        {completed ? '✓' : '•'}
      </div>
      <span className={`font-medium ${completed ? 'text-ink line-through opacity-50' : 'text-ink'}`}>{title}</span>
    </div>
  );
}
