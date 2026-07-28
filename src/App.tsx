/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Discover } from './pages/Discover';
import { Dashboard } from './pages/Dashboard';
import { PublicTenantSite } from './pages/PublicTenantSite';
import { PublicBookingPage } from './pages/PublicBookingPage';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { SetupWizard } from './pages/SetupWizard';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { NotFound } from './pages/NotFound';
import { Admin } from './pages/Admin';
import { Privacy } from './pages/Privacy';
import { Terms } from './pages/Terms';
import { Toaster } from './components/ui/toaster';

function AdminGuard() {
  const isSuperadmin = typeof window !== 'undefined' && localStorage.getItem('isSuperadmin') === 'true';
  if (!isSuperadmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="mx-auto max-w-xl text-center px-6">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="mt-3 text-sm text-gray-600">
            You don't have superadmin access to this page. Sign in with an account that has superadmin privileges.
          </p>
          <a href="/login?next=/admin" className="mt-6 inline-block rounded-md bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
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
  // In dev it might be localhost, in prod it's egebeya.et or the cloud run url
  const isMainDomain =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.includes('run.app') ||
    hostname === 'egebeya.et' ||
    hostname === 'www.egebeya.et' ||
    hostname === 'app.egebeya.et';

  // Toast viewport is rendered at the top level so any page (dashboard,
  // public site, public booking flow) can call showToast(...) and have a
  // notification appear bottom-right.
  if (!isMainDomain) {
    // We are on a tenant subdomain
    return (
      <BrowserRouter>
        <Toaster />
        <PublicTenantSite hostname={hostname} />
     </BrowserRouter>
    );
  }

  // We are on the main platform
  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/:slug/book" element={<PublicBookingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/setup" element={<SetupWizard />} />
        <Route path="/admin" element={<AdminGuard />} />
        <Route path="/dashboard/*" element={<Dashboard />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
  );
}
