/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import { Toaster } from './components/ui/toaster';

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

// Renders a tenant's public site from a path slug (/{slug}) on the main
// domain — the destination after the onboarding wizard publishes. Reuses the
// subdomain renderer by synthesising the hostname it expects; its
// `hostname.split('.')[0]` heuristic resolves to the slug.
function TenantSlugRoute() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <NotFound />;
  return <PublicTenantSite hostname={`${slug}.egebeya.et`} />;
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
    // We are on a tenant subdomain
    return (
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Toaster />
          <PublicTenantSite hostname={hostname} />
        </Suspense>
      </BrowserRouter>
    );
  }

  // We are on the main platform
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Toaster />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/embed/booking" element={<EmbedBooking />} />
          <Route path="/:slug/book" element={<PublicBookingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/setup" element={<SetupWizard />} />
          <Route path="/:slug/book" element={<PublicBookingPage />} />
          <Route path="/:slug" element={<TenantSlugRoute />} />
          <Route path="/admin" element={<AdminGuard />} />
          <Route path="/dashboard/*" element={<Dashboard />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
