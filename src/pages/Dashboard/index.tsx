import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  Home, Calendar, Scissors, Users, Globe, Image, Settings, LogOut,
  Plus, CalendarPlus, ImagePlus, Store, Clock, CreditCard, Package, RefreshCw,
} from 'lucide-react';
import { UberBottomNav } from '../../components/UberBottomNav';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

import { Bookings } from './Bookings';

import { WebsiteBuilder } from './WebsiteBuilder';
import { CustomerHealth } from './CustomerHealth';
import { Automations } from './Automations';

import { Settings as SettingsComponent } from './Settings';

import { ServicesPage } from './ServicesPage';
import { StaffPage } from './StaffPage';
import { MediaLibraryPage } from './MediaLibraryPage';
import { Billing } from './Billing';
import { authFetch } from '../../lib/api';
import { useRole, isStaff } from '../../lib/auth';
import { StaffRedirect } from './StaffRedirect';
import { BuilderModeProvider, useBuilderMode } from './BuilderModeContext';
import { WalkInSheet } from './WalkInSheet';
import { WinBackWidget } from '../../components/dashboard/WinBackWidget';
import { MarketingDeck } from './MarketingDeck';
import { InventoryPage } from './InventoryPage';

const STAFF_NAV = [{ name: 'Bookings', path: '/dashboard/bookings', icon: Calendar }];

const ALL_NAV = [
  { name: 'Overview', path: '/dashboard', icon: Home },
  { name: 'Bookings', path: '/dashboard/bookings', icon: Calendar },
  { name: 'Services', path: '/dashboard/services', icon: Scissors },
  { name: 'Staff', path: '/dashboard/staff', icon: Users },
  { name: 'Customer Health', path: '/dashboard/customer-health', icon: Users },
  { name: 'Automations', path: '/dashboard/automations', icon: RefreshCw },
  { name: 'Website Builder', path: '/dashboard/website-builder', icon: Globe },
  { name: 'Media Library', path: '/dashboard/media', icon: Image },
  { name: 'Marketing', path: '/dashboard/marketing', icon: Globe },
  { name: 'Inventory', path: '/dashboard/inventory', icon: Package },
  { name: 'Billing', path: '/dashboard/billing', icon: CreditCard },
  { name: 'Settings', path: '/dashboard/settings', icon: Settings },
];

/** Shape of GET /api/tenant/dashboard — whitelisted owner Home payload. */
export interface DashboardAppointment {
  id: string;
  customerName: string;
  serviceName: string | null;
  status: 'confirmed' | 'pending' | string;
  time: string;
}
export interface DashboardData {
  today: DashboardAppointment[];
  todayAppointments: number;
  confirmedAppointments: number;
  pendingAppointments: number;
  completedAppointments: number;
  completedRevenueCents: number;
  completedRevenueEtb: number;
  walkInEnabled: boolean;
}

/**
 * Tailwind's `md:` breakpoint is 768px. The mobile bottom-nav shell condenses
 * the owner experience to three tabs on phone-sized viewports and lets the
 * desktop sidebar / Overview take over at 768px and up.
 */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

/**
 * Shares the live-polled dashboard payload down to the mobile Home route so
 * the schedule/revenue card and the new-booking banner read the same feed.
 */
const DashboardDataContext = React.createContext<DashboardData | null>(null);

function useDashboardContext(): DashboardData | null {
  return React.useContext(DashboardDataContext);
}

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
  const { t } = useTranslation();
  const { mode: builderMode } = useBuilderMode();
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const isMobile = useIsMobile();

  // Stub logout
  const handleLogout = async () => {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // best-effort — still clear local UI state below
    }
    ['role', 'tenantId', 'tenantSlug', 'isSuperadmin'].forEach((k) => localStorage.removeItem(k));
    navigate('/login');
  };

  // In Code Mode the sidebar auto-minimizes to icon-only (60px) and expands on
  // hover, overlaying the content, so the code editor gets maximum space.
  const isCodeMode = builderMode === 'code';
  const sidebarExpanded = isCodeMode ? sidebarHovered : true;

  // ── WP2.4: live Home feed — poll the dashboard every 30s, vibrate + banner
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [banner, setBanner] = useState<DashboardAppointment | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [inventoryLowStock, setInventoryLowStock] = useState(false);
  const lastIdsRef = useRef<Set<string>>(new Set());
  const firstPollRef = useRef(true);

  // Self-serve onboarding: surface a dismissible "Finish setup" banner until
  // the owner completes the /setup wizard (settings.onboarding_completed).
  const [setupBannerDismissed, setSetupBannerDismissed] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('setup-banner-dismissed') === '1',
  );
  const [onboardingIncomplete, setOnboardingIncomplete] = useState(false);

  useEffect(() => {
    if (role === 'staff') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/tenant/settings');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setOnboardingIncomplete(data.onboarding_completed !== true);
      } catch {
        // settings is a nice-to-have for the banner — fail silently
      }
    })();
    return () => { cancelled = true; };
  }, [role]);

  const dismissSetupBanner = () => {
    setSetupBannerDismissed(true);
    if (typeof window !== 'undefined') localStorage.setItem('setup-banner-dismissed', '1');
  };

  const pollDashboard = useCallback(async () => {
    try {
      const res = await authFetch('/api/tenant/dashboard');
      if (!res.ok) return;
      const data: DashboardData = await res.json();
      const confirmed = Array.isArray(data.today)
        ? data.today.filter((b) => b.status === 'confirmed')
        : [];
      const nowIds = new Set(confirmed.map((b) => b.id));
      const prevIds = lastIdsRef.current;
      lastIdsRef.current = nowIds;

      setDashboard(data);

      // Only alert on bookings that appeared between this poll and the last —
      // never on the initial load. Consumer browsers leak a small vibration
      // through the optional chaining guard; reduced-motion users still get
      // the banner, just without the slide (see the CSS animation guard).
      if (!firstPollRef.current) {
        const fresh = confirmed.filter((b) => !prevIds.has(b.id));
        if (fresh.length > 0) {
          navigator.vibrate?.(120);
          setBanner(fresh[fresh.length - 1]);
        }
      }
      firstPollRef.current = false;
    } catch {
      // transient network / auth-refresh — the next poll retries
    }
  }, []);

  useEffect(() => {
    if (!isMobile || role === 'staff') return;
    pollDashboard();
    const id = setInterval(pollDashboard, 30_000);
    return () => clearInterval(id);
  }, [isMobile, role, pollDashboard]);

  // Auto-dismiss the new-booking banner after a few seconds.
  useEffect(() => {
    if (!banner) return;
    const id = setTimeout(() => setBanner(null), 6000);
    return () => clearTimeout(id);
  }, [banner]);

  const navItems = role === 'staff' ? STAFF_NAV : ALL_NAV;

  const mobileTitle = useMemo(() => {
    if (location.pathname === '/dashboard' || location.pathname === '/dashboard/') return t('dashboard.home');
    if (location.pathname.startsWith('/dashboard/shop')) return t('dashboard.shop');
    if (location.pathname.startsWith('/dashboard/website-builder')) return t('dashboard.site');
    if (location.pathname.startsWith('/dashboard/bookings')) return t('nav.dashboard');
    return 'Egebeya';
  }, [location.pathname, t]);

  return (
    <div className="min-h-screen bg-paper flex" style={{ fontFamily: 'var(--font-body)' }}>
      {/* Sidebar — desktop only (hidden on mobile); collapsible in Code Mode */}
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
        <header className="h-14 md:h-16 bg-paper-bleached border-b border-ink-rule flex items-center justify-between px-4 md:px-8">
          <h1 className="text-lg md:text-xl font-bold text-ink">
            {isMobile ? mobileTitle : 'Dashboard'}
          </h1>
          {isMobile && (
            <button
              onClick={handleLogout}
              aria-label="Sign out"
              className="flex items-center gap-1 rounded-md px-3 min-h-[44px] text-sm font-medium text-ink-soft hover:text-ink hover:bg-paper-raised transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </header>

        {onboardingIncomplete && !setupBannerDismissed && (
          <div className="flex items-center justify-between gap-4 px-4 md:px-8 py-3 bg-telebirr/10 border-b border-telebirr/30" role="status">
            <div className="flex items-center gap-3 min-w-0">
              <Clock className="h-5 w-5 text-telebirr-deep shrink-0" aria-hidden />
              <p className="text-sm font-medium text-ink truncate">
                Finish setting up your business — publish your site to start taking bookings.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/setup"
                className="bg-ink text-paper px-4 py-1.5 rounded-md text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                Finish setup
              </Link>
              <button
                onClick={dismissSetupBanner}
                aria-label="Dismiss setup banner"
                className="p-1.5 rounded-md text-ink-soft hover:text-ink hover:bg-paper-raised transition-colors"
              >
                <span aria-hidden>✕</span>
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 p-4 md:p-8 overflow-y-auto pb-28 md:pb-8">
          <DashboardDataContext.Provider value={dashboard}>
            <Routes>
              <Route path="/" element={<OverviewOrRedirect isMobile={isMobile} />} />
              <Route path="/bookings" element={<Bookings />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/staff" element={<StaffPage />} />
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/website-builder" element={<WebsiteBuilder />} />
              {/* Legacy editor routes redirect to the unified builder */}
              <Route path="/website" element={<Navigate to="/dashboard/website-builder" replace />} />
              <Route path="/code" element={<Navigate to="/dashboard/website-builder" replace />} />
              <Route path="/media" element={<MediaLibraryPage />} />
              <Route path="/marketing" element={<MarketingDeck />} />
              <Route path="/inventory" element={<InventoryPage onLowStock={setInventoryLowStock} />} />
              <Route path="/customer-health" element={<CustomerHealth />} />
              <Route path="/automations" element={<Automations />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/settings" element={<SettingsComponent />} />
              <Route path="*" element={<Navigate to="/dashboard/bookings" replace />} />
            </Routes>
          </DashboardDataContext.Provider>
        </div>
      </main>

      {/* WP2.4: slide-down new-booking banner (mobile only) */}
      {isMobile && banner && (
        <NewBookingBanner item={banner} onDismiss={() => setBanner(null)} />
      )}

      {/* WP2.3: Uber-style PWA bottom navigation on phone-sized viewports */}
      {isMobile && (
        <UberBottomNav
          role={role}
          walkInEnabled={dashboard?.walkInEnabled === true}
          onWalkIn={() => setWalkInOpen(true)}
          inventoryLowStock={inventoryLowStock}
        />
      )}

      <WalkInSheet open={walkInOpen} onClose={() => setWalkInOpen(false)} onCreated={pollDashboard} />
    </div>
  );
}

/** Mobile-only Shop tab — a segmented switch between Services and Staff. */
function ShopPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'services' | 'staff'>('services');
  return (
    <StaffRedirect>
      <div className="space-y-4">
        <div className="flex rounded-xl border border-ink-rule bg-paper-bleached p-1 max-w-md">
          <button
            onClick={() => setTab('services')}
            className={`flex-1 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
              tab === 'services' ? 'bg-primary text-white' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {t('dashboard.shopServices')}
          </button>
          <button
            onClick={() => setTab('staff')}
            className={`flex-1 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
              tab === 'staff' ? 'bg-primary text-white' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {t('dashboard.shopStaff')}
          </button>
        </div>
        {tab === 'services' ? <ServicesPage /> : <StaffPage />}
      </div>
    </StaffRedirect>
  );
}

/** Mobile-only Home — today's schedule + today's revenue + live booking feed. */
function MobileHome({ dashboard }: { dashboard: DashboardData | null }) {
  const { t } = useTranslation();
  const revenueEtb = typeof dashboard?.completedRevenueEtb === 'number' ? dashboard.completedRevenueEtb : null;

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="bg-paper-bleached rounded-xl border border-ink-rule p-5">
        <div className="text-sm font-medium text-ink-soft mb-1">{t('dashboard.todayRevenue')}</div>
        <div className="text-3xl font-bold text-ink">
          {revenueEtb == null ? 'ETB --' : `ETB ${revenueEtb.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
        </div>
      </div>

      <WinBackWidget />

      <section className="bg-paper-bleached rounded-xl border border-ink-rule">
        <header className="px-5 py-4 border-b border-ink-rule">
          <h2 className="text-lg font-bold text-ink">{t('dashboard.todaySchedule')}</h2>
        </header>
        {!dashboard || dashboard.today.length === 0 ? (
          <div className="p-6 text-sm text-ink-soft flex items-center gap-2">
            <Calendar className="h-4 w-4 text-ink-stamp" />
            {t('dashboard.noBookingsToday')}
          </div>
        ) : (
          <ul role="list" className="divide-y divide-ink-rule">
            {dashboard.today.map((b) => (
              <li key={b.id} className="flex items-center gap-4 px-5 py-4">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/10 text-ink font-semibold text-sm">
                  {(b.customerName && b.customerName.charAt(0)) || '?'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink truncate">
                    {b.customerName || 'Customer'}
                    {b.serviceName && <span className="text-ink-stamp"> · {b.serviceName}</span>}
                  </div>
                  <span
                    className={`inline-block text-xs font-medium ${
                      b.status === 'pending' ? 'text-accent-secondary-deep' : 'text-success-deep'
                    }`}
                  >
                    {b.status}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-sm font-semibold text-ink">
                  <Clock className="h-4 w-4 text-ink-stamp" />
                  {b.time}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** WP2.4 slide-down banner for a newly-confirmed booking. */
function NewBookingBanner({ item, onDismiss }: { item: DashboardAppointment; onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="fixed top-0 inset-x-0 z-50 flex justify-center px-4">
      <button
        onClick={onDismiss}
        aria-live="polite"
        className="animate-banner-slide-down mt-3 w-full max-w-md rounded-xl bg-primary text-white px-5 py-4 text-left shadow-lg shadow-black/20 hover:opacity-95 transition flex items-center gap-3"
      >
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Calendar className="h-5 w-5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold">{t('dashboard.newBookingBanner')}</span>
          <span className="block text-sm text-white/90 truncate">
            {item.customerName} {t('dashboard.newBookingBannerAt')} {item.time}
          </span>
        </span>
      </button>
    </div>
  );
}

/**
 * `/dashboard` defaults to the Overview tab for owners and admins (desktop) or
 * the Home mobile shell. Staff accounts have no Overview tab — bounce them to
 * their only allowed tab, Bookings.
 */
function OverviewOrRedirect({ isMobile }: { isMobile: boolean }) {
  const dashboard = useDashboardContext();
  if (isStaff()) {
    return <Navigate to="/dashboard/bookings" replace />;
  }
  if (isMobile) {
    return <MobileHome dashboard={dashboard} />;
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
  const [weeklyRevenue, setWeeklyRevenue] = useState<number | null>(null);
  const [weeklyDaily, setWeeklyDaily] = useState<{date:string;revenue:number;bookings:number}[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

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

    setLoadingAnalytics(true);
    authFetch('/api/tenant/analytics')
    .then((r) => (r.ok ? r.json() : null))
    .then((data: any) => {
      if (!data) return;
      setWeeklyRevenue(typeof data.totalRevenue === 'number' ? data.totalRevenue : null);
      setWeeklyDaily(Array.isArray(data.daily) ? data.daily : []);
    })
    .catch(() => {})
    .finally(() => setLoadingAnalytics(false));
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

        <MarketingDeck />

        <WinBackWidget />

        <RecentActivity items={recent} loading={loadingRecent} />
     </div>
   </StaffRedirect>
  );
}

function QuickActions() {
  const actions: { name: string; to: string; icon: any; accent: string }[] = [
    { name: 'Add Service', to: '/dashboard/services', icon: Plus, accent: 'bg-ink/10 text-ink' },
    { name: 'Add Staff', to: '/dashboard/staff', icon: CalendarPlus, accent: 'bg-telebirr/10 text-telebirr-deep' },
    { name: 'View Media', to: '/dashboard/media', icon: ImagePlus, accent: 'bg-accent-secondary/10 text-accent-secondary-deep' },
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