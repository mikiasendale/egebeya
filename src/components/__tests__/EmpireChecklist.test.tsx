/**
 * @vitest-environment jsdom
 *
 * P2.5/P2.6 — "Finish your empire" checklist + public soft-landing page.
 *
 *   1. Checklist reflects provision-status flags: incomplete steps render as
 *      deep links; a fully-done empire renders NOTHING.
 *   2. Flag flips re-render on refetch (keyed by status payload).
 *   3. PreparingSite renders the Amharic-first soft-landing (never a raw 404).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const authFetchMock = vi.fn();
vi.mock('../../lib/api', () => ({
  authFetch: (...args: any[]) => authFetchMock(...args),
}));

import { EmpireChecklist } from '../dashboard/EmpireChecklist';
import { PreparingSite } from '../PreparingSite';

function statusPayload(overrides: Record<string, boolean> = {}) {
  const base = {
    page: true,
    services: true,
    staff: true,
    hours: true,
    hoursConfirmed: false,
    ...overrides,
  };
  return {
    ok: true,
    json: async () => ({
      generatedAt: Date.now(),
      confirmedHours: base.hoursConfirmed,
      sitePublic: base.hoursConfirmed,
      steps: Object.entries(base).map(([step, done]) => ({ step, done })),
    }),
  } as any;
}

function renderWithRouter(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

beforeEach(() => {
  authFetchMock.mockReset();
});

afterEach(cleanup);

describe('EmpireChecklist (P2.5)', () => {
  it('lists incomplete items with deep links and hides completed ones', async () => {
    authFetchMock.mockResolvedValue(statusPayload({ hoursConfirmed: false }));

    renderWithRouter(<EmpireChecklist />);
    await waitFor(() => expect(screen.getByTestId('empire-checklist')).toBeTruthy());

    // Hours confirmation is pending → present with its settings deep link.
    const hoursItem = screen.getByTestId('checklist-hoursConfirmed');
    expect(hoursItem.getAttribute('href')).toBe('/settings');
    expect(hoursItem.textContent).toContain('Confirm your hours');

    // Completed steps never render as nag items.
    expect(screen.queryByTestId('checklist-page')).toBeNull();

    // Photo item is the manual upgrade prompt.
    expect(screen.getByTestId('checklist-photo').getAttribute('href')).toBe('/dashboard/media');
  });

  it('flag flips shrink the list to the undetectable manual items only', async () => {
    // Every server-verifiable step done → only photo + first-booking remain
    // (they have no signal until P3.5 activation events land).
    authFetchMock.mockResolvedValue(
      statusPayload({ hoursConfirmed: true, page: true, services: true, staff: true, hours: true }),
    );

    renderWithRouter(<EmpireChecklist />);
    await waitFor(() => expect(screen.getByTestId('empire-checklist')).toBeTruthy());

    expect(screen.queryByTestId('checklist-page')).toBeNull();
    expect(screen.queryByTestId('checklist-hoursConfirmed')).toBeNull();
    expect(screen.getByTestId('checklist-photo')).toBeTruthy();
    expect(screen.getByTestId('checklist-firstBooking')).toBeTruthy();
  });

  it('renders nothing for tenants that were never provisioned', async () => {
    // generatedAt=null means the pre-P2.3 "never provisioned" case: the
    // checklist has nothing honest to show, so it renders null. (This also
    // covers the identical empty-steps payload — one variant, one behavior.)
    authFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ generatedAt: null, confirmedHours: false, steps: [] }),
    } as any);

    const { container } = renderWithRouter(<EmpireChecklist />);
    await waitFor(() => expect(authFetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector('[data-testid="empire-checklist"]')).toBeNull();
  });

  it('deep-links the generate item to the demoted wizard compat URL', async () => {
    // P2.5 reopen (C1): bare /setup redirects to the Home checklist; the
    // checklist's generate item must target /setup/classic instead.
    authFetchMock.mockResolvedValue(statusPayload({ page: false }));

    renderWithRouter(<EmpireChecklist />);
    await waitFor(() => expect(screen.getByTestId('checklist-page')).toBeTruthy());
    expect(screen.getByTestId('checklist-page').getAttribute('href')).toBe('/setup/classic');
  });
});

describe('PreparingSite (P2.6)', () => {
  it('renders the Amharic-first soft-landing with the business name', () => {
    renderWithRouter(<PreparingSite businessName="Selam Salon" />);
    const root = screen.getByTestId('preparing-site');
    expect(root.textContent).toContain('ጣቢያው እየተዘጋጀ ነው');
    expect(root.textContent).toContain('Selam Salon');
    expect(root.textContent).toContain('preparing its page');
  });
});
