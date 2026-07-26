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
import { Toaster } from './components/ui/toaster';

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
        <Route path="/dashboard/*" element={<Dashboard />} />
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
  );
}
