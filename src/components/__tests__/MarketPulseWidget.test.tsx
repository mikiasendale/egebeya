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

import { MarketPulseWidget } from '../../components/dashboard/MarketPulseWidget';

const PRO_SUBMISSION = {
  subscription: { id: 's1', tenantId: 't1', planId: 'p1', status: 'active', endsAt: null },
  plan: { id: 'p1', name: 'pro', maxStaff: 10, customDomainAllowed: true },
};

const FREE_SUBMISSION = {
  subscription: { id: 's1', tenantId: 't1', planId: 'p0', status: 'active', endsAt: null },
  plan: { id: 'p0', name: 'free', maxStaff: 2, customDomainAllowed: false },
};

const MOCK_ALERTS = [
  {
    id: 'a1',
    category: 'salon',
    city: 'Bole',
    actionCount: 7,
    message: '📈 7 customers in Bole are looking for a salon right now!',
    createdAt: Date.now(),
  },
];

describe('MarketPulseWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('tenantSlug', 'test-salon');
    localStorage.setItem('tenantName', 'Test Salon');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing for a Free-plan tenant', async () => {
    mockAuthFetch.mockImplementation((url: string) => {
      if (url === '/api/tenant/subscription') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(FREE_SUBMISSION) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    const { container } = render(<MarketPulseWidget />);
    await waitFor(() => {
      // After the Pro gate resolves, the widget renders null for Free users.
      expect(container.childElementCount).toBe(0);
    });
    expect(screen.queryByText(/High Demand/)).not.toBeInTheDocument();
  });

  it('renders a pulsing demand card with alert details for a Pro tenant', async () => {
    mockAuthFetch.mockImplementation((url: string) => {
      if (url === '/api/tenant/subscription') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(PRO_SUBMISSION) });
      }
      if (url === '/api/tenant/alerts') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_ALERTS) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<MarketPulseWidget />);
    await waitFor(() => {
      expect(screen.getAllByText(/High Demand/).length).toBeGreaterThan(0);
    });

    // Pulsing border animation is present.
    const pulseEl = document.querySelector('.animate-pulse');
    expect(pulseEl).not.toBeNull();

    // Demand copy reflects the alert.
    expect(screen.getAllByText(/7/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bole/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/salon/).length).toBeGreaterThan(0);
  });

  it('renders a Broadcast Flash Sale button that opens Telegram', async () => {
    mockAuthFetch.mockImplementation((url: string) => {
      if (url === '/api/tenant/subscription') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(PRO_SUBMISSION) });
      }
      if (url === '/api/tenant/alerts') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_ALERTS) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<MarketPulseWidget />);
    await waitFor(() => {
      expect(screen.getAllByText(/Broadcast Flash Sale/).length).toBeGreaterThan(0);
    });

    const btn = screen.getByText(/Broadcast Flash Sale/);
    btn.click();

    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('https://t.me/share/url'), '_blank');
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('Test Salon')), '_blank');
    openSpy.mockRestore();
  });

  it('shows a calm state when there are no alerts', async () => {
    mockAuthFetch.mockImplementation((url: string) => {
      if (url === '/api/tenant/subscription') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(PRO_SUBMISSION) });
      }
      if (url === '/api/tenant/alerts') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<MarketPulseWidget />);
    await waitFor(() => {
      expect(screen.getAllByText(/No hot demand right now/).length).toBeGreaterThan(0);
    });

    // No pulsing card when there's no demand.
    expect(document.querySelector('.animate-pulse')).toBeNull();
  });

  it('renders nothing when alerts fetch fails for a Pro tenant', async () => {
    mockAuthFetch.mockImplementation((url: string) => {
      if (url === '/api/tenant/subscription') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(PRO_SUBMISSION) });
      }
      // Alerts endpoint fails.
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<MarketPulseWidget />);
    await waitFor(() => {
      // Falls back to the calm empty state, not an error blast.
      expect(screen.getAllByText(/No hot demand right now/).length).toBeGreaterThan(0);
    });
  });
});
