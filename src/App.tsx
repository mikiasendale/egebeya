/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useParams, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/toaster';
import { PreparingSite } from './components/PreparingSite';

// Route-level code splitting: heavy pages (Sandpack/Puck dashboard, landing,
// discover) load in their own chunks instead of bloating the initial bundle.
const Landing = lazy(() => import('./pages/Landing').then(m => ({ default: m.Landing })));
const Discover = lazy(() => import('./pages/Discover').then(m => ({ default: m.Discover })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const PublicTenantSite = lazy(() => import('./pages/PublicTenantSite').then(m => ({ default: m.PublicTenantSite })));
const PublicBookingPage = lazy(() => import('./pages/PublicBookingPage').then(m => ({ default: m.PublicBookingPage })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Register').then(m => ({ default: m.Register })));
const SetupWizard = lazy(() => import('./pages/SetupWizard').then(m => ({ default: m.SetupWizard })));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const NotFound = lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));
const Admin = lazy(() => import('./pages/Admin').then(m => ({ default: m.Admin })));
const Privacy = lazy(() => import('./pages/Privacy').then(m => ({ default: m.Privacy })));
const Terms = lazy(() => import('./pages/Terms').then(m => ({ default: m.Terms })));
const EmbedBooking = lazy(() => import('./pages/EmbedBooking').then(m => ({ default: m.EmbedBooking })));
const QueueStatus = lazy(() => import('./pages/QueueStatus').then(m => ({ default: m.QueueStatus })));
const ConsumerBookings = lazy(() => import('./pages/ConsumerBookings').then(m => ({ default: m.ConsumerBookings })));

/**
 * P2.6 reopen: the DARK/LIVE gate shared by BOTH public entry paths —
 * `/:slug` on the main domain AND direct tenant-subdomain visits. The
 * subdomain branch previously rendered PublicTenantSite unconditionally,
 * bypassing the site-status probe and exposing unconfirmed (dark) sites.
 */
function TenantSiteGate({ slug }: { slug: string }) {
  const [status, setStatus] = useState<'loading' | 'preparing' | 'live'>('loading');
  const [businessName, setBusinessName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    // P2.6: probe first — preparing sites get the soft-landing, not a raw 404.
    // (GET /site-status also resolves from the Host header, so subdomain
    // probes work without a query param.)
    fetch(`/api/public/site-status?slug=${encodeURIComponent(slug)}`)
      .then(async (r) => {
        if (!r.ok) return 'missing';
        const body = await r.json();
        if (!cancelled) setBusinessName(body.name);
        return body.status as 'preparing' | 'live';
      })
      .then((result) => {
        if (cancelled) return;
        setStatus(result === 'preparing' ? 'preparing' : 'live');
      })
      .catch(() => { if (!cancelled) setStatus('live'); });
    return () => { cancelled = true; };
  }, [slug]);

  if (!slug) return <NotFound />;
  if (status === 'loading') return <RouteFallback />;
  if (status === 'preparing') return <PreparingSite businessName={businessName} />;
  return <PublicTenantSite hostname={`${slug}.egebeya.et`} />;
}

/** Tenant site from a path slug (/{slug}) on the main domain. */
function TenantSlugRoute() {
  const { slug } = useParams<{ slug: string }>();
  return <TenantSiteGate slug={slug ?? ''} />;
}

/**
 * Tenant site reached via a real subdomain (selam.egebeya.et). Same gate as
 * the path form — a preparing tenant gets the Amharic soft-landing, never
 * the site, never a raw "Business not found".
 */
function SubdomainTenantRoute() {
  const slug = window.location.hostname.split('.')[0];
  return <TenantSiteGate slug={slug} />;
}

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-paper)' }}>
      <span className="stamp">Egebeya · loading…</span>
    </div>
  );
}

function AdminGuard() {
  const isSuperadmin = typeof window !== 'undefined' && localStorage.getItem('isSuperadmin') === 'true';
  if (!isSuperadmin) {
    return (
      <div className="min-h-screen bg-surface-raised flex items-center justify-center">
        <div className="mx-auto max-w-xl text-center px-6">
          <h1 className="text-2xl font-bold text-ink">Access Denied</h1>
          <p className="mt-3 text-sm text-ink-soft">
            You don't have superadmin access to this page. Sign in with an account that has superadmin privileges.
          </p>
          <a href="/login?next=/admin" className="mt-6 inline-block rounded-md bg-primary-deep px-4 py-2 text-sm font-medium text-paper hover:bg-ink">
            Sign in
          </a>
        </div>
      </div>
    );
  }
  return <Admin />;
}

/**
 * Main-domain route table. Exported so the routing tests exercise the EXACT
 * production configuration (C1: /setup demotion, /setup/classic compat).
 *
 * P2.5 reopen (C1): the full SetupWizard is DEMOTED to /setup/classic —
 * bare /setup now redirects into the dashboard Home where EmpireChecklist
 * lives. The old wizard stays reachable for compatibility from the
 * checklist's "Generate your site" item.
 */
export function MainDomainRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/discover" element={<Discover />} />
      <Route path="/embed/booking" element={<EmbedBooking />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Demoted wizard: bare /setup funnels into the Home checklist. */}
      <Route path="/setup" element={<Navigate to="/dashboard" replace />} />
      <Route path="/setup/classic" element={<SetupWizard />} />
      <Route path="/:slug/book" element={<PublicBookingPage />} />
      {/* P4.3 consumer queue board — public, opaque-token URL, no login. */}
      <Route path="/q/:token" element={<QueueStatus />} />
      {/* P5.2 consumer punch-card page — consumer JWT, phone-keyed. */}
      <Route path="/my-bookings" element={<ConsumerBookings />} />
      <Route path="/:slug" element={<TenantSlugRoute />} />
      <Route path="/admin" element={<AdminGuard />} />
      <Route path="/dashboard/*" element={<Dashboard />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  const hostname = window.location.hostname;

  // Define main domain (adjust for dev/prod environment)
  const isMainDomain =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.includes('run.app') ||
    hostname.endsWith('.onrender.com') || // Render preview/deploy host
    hostname === 'egebeya.et' ||
    hostname === 'www.egebeya.et' ||
    hostname === 'app.egebeya.et';

  if (!isMainDomain) {
    // We are on a tenant subdomain — gated exactly like the /:slug path form.
    return (
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Toaster />
          <SubdomainTenantRoute />
        </Suspense>
      </BrowserRouter>
    );
  }

  // We are on the main platform
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Toaster />
        <MainDomainRoutes />
      </Suspense>
    </BrowserRouter>
  );
}
