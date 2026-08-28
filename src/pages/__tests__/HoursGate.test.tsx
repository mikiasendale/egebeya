/**
 * @vitest-environment jsdom
 *
 * P2.6 reopen (B2) — the DARK-hours banner acceptance test that never
 * existed: the banner must render above ALL dashboard child routes while
 * hours are unconfirmed, and disappear once confirmed.
 *
 * Child pages are stubbed — the unit under test is the SHELL's gate logic
 * (status probe + live flip on 'egebeya:hours-confirmed'), not the children.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
// vi.mock calls are hoisted above imports, so the static import below is
// already wired to the stubs.
import { Dashboard } from '../Dashboard';

// Stub every child page + heavy widget so route iteration exercises only
// the shell (banner logic), not each page's own data plumbing.
vi.mock('@measured/puck', () => ({ Puck: () => null, Render: () => null }));
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
(window as any).ResizeObserver = (window as any).ResizeObserver ?? ResizeObserverStub;
vi.mock('../Bookings', () => ({ Bookings: () => <div data-testid="stub-page" /> }));
vi.mock('../WebsiteBuilder', () => ({ WebsiteBuilder: () => <div data-testid="stub-page" /> }));
vi.mock('../CustomerHealth', () => ({ CustomerHealth: () => <div data-testid="stub-page" /> }));
vi.mock('../Automations', () => ({ Automations: () => <div data-testid="stub-page" /> }));
vi.mock('../../components/dashboard/MarketPulseWidget', () => ({ MarketPulseWidget: () => null }));
vi.mock('../../components/dashboard/WinBackWidget', () => ({ WinBackWidget: () => null }));
vi.mock('../Settings', () => ({ Settings: () => <div data-testid="stub-page" /> }));
vi.mock('../ServicesPage', () => ({ ServicesPage: () => <div data-testid="stub-page" /> }));
vi.mock('../StaffPage', () => ({ StaffPage: () => <div data-testid="stub-page" /> }));
vi.mock('../MediaLibraryPage', () => ({ MediaLibraryPage: () => <div data-testid="stub-page" /> }));
vi.mock('../Billing', () => ({ Billing: () => <div data-testid="stub-page" /> }));
vi.mock('../MarketingDeck', () => ({ MarketingDeck: () => <div data-testid="stub-page" /> }));
vi.mock('../InventoryPage', () => ({ InventoryPage: () => <div data-testid="stub-page" /> }));
vi.mock('../WalkInSheet', () => ({ WalkInSheet: () => null }));
vi.mock('../StaffRedirect', () => ({ StaffRedirect: ({ children }: any) => children }));
vi.mock('../../components/UberBottomNav', () => ({ UberBottomNav: () => null }));
vi.mock('../../components/dashboard/EmpireChecklist', () => ({ EmpireChecklist: () => null }));

const authFetchMock = vi.fn();
vi.mock('../../lib/api', () => ({
  authFetch: (...args: any[]) => authFetchMock(...args),
}));

let confirmedHours = false;

function installFetchMock(): void {
  authFetchMock.mockImplementation(async (url: string) => {
    if (url.includes('/api/tenant/provision/status')) {
      return {
        ok: true,
        json: async () => ({
          generatedAt: Date.now(),
          confirmedHours,
          generationComplete: true,
          steps: [
            { step: 'page', done: true },
            { step: 'services', done: true },
            { step: 'staff', done: true },
            { step: 'hours', done: true },
            { step: 'hoursConfirmed', done: confirmedHours },
          ],
        }),
      } as any;
    }
    if (url.includes('/api/tenant/settings')) {
      return { ok: true, json: async () => ({ onboarding_completed: true }) } as any;
    }
    // Generic payload for every other dashboard fetch (polls, widgets…).
    return { ok: true, json: async () => ({}) } as any;
  });
}

const DASHBOARD_ROUTES = [
  '/',
  '/bookings',
  '/services',
  '/staff',
  '/website-builder',
  '/media',
  '/marketing',
  '/inventory',
  '/customer-health',
  '/automations',
  '/billing',
  '/settings',
];

function renderDashboard(route: string) {
  localStorage.setItem('role', 'owner');
  return render(
    <MemoryRouter initialEntries={[`/dashboard${route}`]}>
      <Dashboard />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authFetchMock.mockReset();
  confirmedHours = false;
  installFetchMock();
  // jsdom has no matchMedia (useIsMobile / hover queries).
  if (!(window as any).matchMedia) {
    (window as any).matchMedia = (query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      onchange: null,
      dispatchEvent: () => false,
    });
  }
});

afterEach(cleanup);

describe('P2.6 hours-confirmation banner (B2)', () => {
  it(`renders on every dashboard child route while hours are unconfirmed (${DASHBOARD_ROUTES.length} routes)`, async () => {
    for (const route of DASHBOARD_ROUTES) {
      renderDashboard(route);
      await waitFor(() => expect(screen.getByTestId('setup-banner')).toBeTruthy(),
        { timeout: 3000 });
      // The DARK stamp is part of the unconfirmed state.
      await waitFor(() => expect(screen.getByTestId('dark-stamp')).toBeTruthy());
      const action = screen.getByTestId('setup-banner-action');
      expect(action.getAttribute('href')).toBe('/settings');
      expect(action.textContent).toContain('አረጋግጥ');
      cleanup();
    }
  });

  it('is absent everywhere once hours are confirmed', async () => {
    confirmedHours = true;
    for (const route of ['/', '/bookings', '/settings']) {
      renderDashboard(route);
      // Route '/' renders the internal overview (not a stubbed child) —
      // wait for the shell's status fetch instead of a specific child.
      await waitFor(() => expect(authFetchMock).toHaveBeenCalled());
      await new Promise((r) => setTimeout(r, 50));
      expect(screen.queryByTestId('setup-banner')).toBeNull();
      cleanup();
    }
  });

  it('drops LIVE without a reload when Settings saves hours (event → re-probe)', async () => {
    renderDashboard('/');
    await waitFor(() => expect(screen.getByTestId('setup-banner')).toBeTruthy());

    // Settings.tsx dispatches this after confirm-hours succeeds.
    act(() => {
      window.dispatchEvent(new CustomEvent('egebeya:hours-confirmed'));
    });

    await waitFor(() => expect(screen.queryByTestId('setup-banner')).toBeNull());
    // The shell re-probed status rather than trusting the event blindly.
    const statusCalls = authFetchMock.mock.calls.filter((c: any[]) =>
      String(c[0]).includes('/api/tenant/provision/status'));
    expect(statusCalls.length).toBeGreaterThanOrEqual(2);
  });
});
