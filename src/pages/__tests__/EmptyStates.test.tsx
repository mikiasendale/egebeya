// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockAuthFetch = vi.fn();
vi.mock('../../lib/api', () => ({
  authFetch: (...args: any[]) => mockAuthFetch(...args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('../../components/ui/toast-helper', () => ({
  showToast: vi.fn(),
}));

import { Bookings } from '../Dashboard/Bookings';
import { ServicesPage } from '../Dashboard/ServicesPage';
import { CustomerHealth } from '../Dashboard/CustomerHealth';

const PRO_SUBMISSION = {
  subscription: { id: 's1', tenantId: 't1', planId: 'p1', status: 'active', endsAt: null },
  plan: { id: 'p1', name: 'pro', maxStaff: 10, customDomainAllowed: true },
};

describe('Empty States', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('tenantSlug', 'test-salon');
    localStorage.setItem('tenantName', 'Test Salon');
  });

  afterEach(() => {
    cleanup();
  });

  it('Bookings: renders the empty-calendar state with share CTA', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<Bookings />);
    await waitFor(() => {
      expect(screen.getAllByText('Your calendar is empty.').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/Tap 'Share Site' to send your link to your first customer on Telegram/).length).toBeGreaterThan(0);
  });

  it('Services: renders the empty-services state with Add Your First Service', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<ServicesPage />);
    await waitFor(() => {
      expect(screen.getAllByText('No services added yet.').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Add Your First Service').length).toBeGreaterThan(0);
  });

  it('Customer Health: renders the empty-CRM state for a Pro tenant', async () => {
    mockAuthFetch.mockImplementation((url: string) => {
      if (url === '/api/tenant/subscription') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(PRO_SUBMISSION) });
      }
      if (url === '/api/tenant/customers') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url === '/api/tenant/settings/upfront-phones') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ require_upfront_phones: [] }) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<CustomerHealth />);
    await waitFor(() => {
      expect(screen.getAllByText('No customers yet.').length).toBeGreaterThan(0);
    });
    expect(
      screen.getAllByText(/Once you get your first booking, your CRM will populate here automatically./).length,
    ).toBeGreaterThan(0);
  });
});
