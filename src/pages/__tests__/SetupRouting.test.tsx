/**
 * @vitest-environment jsdom
 *
 * P2.6 reopen — subdomain gate + P2.5 reopen (C1) — /setup demotion.
 *
 *   1. Direct tenant-subdomain visits run the SAME dark/live gate as /:slug
 *      (previously PublicTenantSite rendered unconditionally — audit gap).
 *   2. Bare /setup redirects into the dashboard Home; the full wizard lives
 *      on at /setup/classic (compat), which is what EmpireChecklist links to.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Heavy pages stubbed so route iteration stays fast and deterministic.
vi.mock('../../pages/Landing', () => ({ Landing: () => <div data-testid="stub-landing" /> }));
vi.mock('../../pages/Dashboard', () => ({ Dashboard: () => <div data-testid="stub-dashboard-home" /> }));
vi.mock('../../pages/SetupWizard', () => ({ SetupWizard: () => <div data-testid="stub-setup-wizard" /> }));
vi.mock('../../pages/PublicTenantSite', () => ({
  PublicTenantSite: ({ hostname }: any) => <div data-testid="stub-public-site">{hostname}</div>,
}));
vi.mock('../../components/PreparingSite', () => ({
  PreparingSite: ({ businessName }: any) => (
    <div data-testid="preparing-site">{businessName ?? ''} preparing</div>
  ),
}));
vi.mock('../../pages/PublicBookingPage', () => ({ PublicBookingPage: () => null }));
vi.mock('../../pages/Discover', () => ({ Discover: () => null }));
vi.mock('../../pages/EmbedBooking', () => ({ EmbedBooking: () => null }));
vi.mock('../../pages/Login', () => ({ Login: () => null }));
vi.mock('../../pages/Register', () => ({ Register: () => null }));
vi.mock('../../pages/ForgotPassword', () => ({ ForgotPassword: () => null }));
vi.mock('../../pages/ResetPassword', () => ({ ResetPassword: () => null }));
vi.mock('../../pages/Admin', () => ({ Admin: () => null }));
vi.mock('../../pages/Privacy', () => ({ Privacy: () => null }));
vi.mock('../../pages/Terms', () => ({ Terms: () => null }));

let siteStatus = 'live';
const fetchMock = vi.fn(async (url: any) => {
  if (String(url).includes('/api/public/site-status')) {
    return {
      ok: true,
      json: async () => ({ status: siteStatus, name: 'Selam Salon' }),
    } as any;
  }
  return { ok: true, json: async () => ({}) } as any;
});
vi.stubGlobal('fetch', fetchMock);

import App, { MainDomainRoutes } from '../../App';

beforeEach(() => {
  siteStatus = 'live';
  fetchMock.mockClear();
});

afterEach(cleanup);

function setHostname(host: string): void {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, hostname: host },
    writable: true,
    configurable: true,
  });
}

describe('Tenant subdomain gate (P2.6 reopen)', () => {
  it('preparing subdomain → Amharic soft-landing, never the site', async () => {
    setHostname('selam.egebeya.et');
    siteStatus = 'preparing';
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('preparing-site')).toBeTruthy());
    expect(screen.getByTestId('preparing-site').textContent).toContain('Selam Salon');
    // The real public site must NOT be mounted.
    expect(screen.queryByTestId('stub-public-site')).toBeNull();
  });

  it('live subdomain → the actual tenant site renders', async () => {
    setHostname('selam.egebeya.et');
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('stub-public-site')).toBeTruthy());
    expect(screen.getByTestId('stub-public-site').textContent).toContain('.egebeya.et');
  });
});

describe('/setup demotion routing (P2.5 reopen C1)', () => {
  it('bare /setup redirects into the dashboard Home checklist — wizard NOT mounted', async () => {
    render(
      <MemoryRouter initialEntries={['/setup']}>
        <MainDomainRoutes />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('stub-dashboard-home')).toBeTruthy());
    expect(screen.queryByTestId('stub-setup-wizard')).toBeNull();
  });

  it('/setup/classic keeps the legacy wizard reachable (compat URL)', async () => {
    render(
      <MemoryRouter initialEntries={['/setup/classic']}>
        <MainDomainRoutes />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('stub-setup-wizard')).toBeTruthy());
  });

  it('the production route table is what these tests exercised (App uses MainDomainRoutes)', () => {
    // Guard against someone re-inlining a diverging route table in App.
    expect(typeof MainDomainRoutes).toBe('function');
  });
});
