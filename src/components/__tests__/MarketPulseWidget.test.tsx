// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
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

    const { container } = render(<MarketPulseWidget businessName="Test Salon" />);
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

    render(<MarketPulseWidget businessName="Test Salon" />);
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

  it('#50: Broadcast Flash Sale mints a real expiring 15% promo BEFORE opening Telegram', async () => {
    const seq: string[] = [];
    mockAuthFetch.mockImplementation((url: string) => {
      if (url === '/api/tenant/subscription') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(PRO_SUBMISSION) });
      }
      if (url === '/api/tenant/alerts') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_ALERTS) });
      }
      if (url === '/api/tenant/promo-codes') {
        seq.push('promo-post');
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'promo-1' }) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {
      seq.push('open');
      return null;
    });

    render(<MarketPulseWidget businessName="Test Salon" />);
    await waitFor(() => {
      expect(screen.getAllByText(/Broadcast Flash Sale/).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByText(/Broadcast Flash Sale/));
    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1));

    // No share opens unless a real promo row exists first.
    expect(seq).toEqual(['promo-post', 'open']);

    const post = mockAuthFetch.mock.calls.find((c) => c[0] === '/api/tenant/promo-codes');
    expect(post).toBeTruthy();
    const body = JSON.parse(post[1].body);
    expect(body.code).toMatch(/^FLASH-[A-Z0-9]{4}$/);
    expect(body.discountType).toBe('percent');
    expect(body.discountValue).toBe(15);
    expect(body.maxUses).toBe(500);
    expect(body.validUntil).toBeGreaterThan(Date.now());

    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toContain(encodeURIComponent(`code ${body.code}`));
    expect(url).toContain(encodeURIComponent('valid until'));
    // The old bare promise — "Limited-time 15% off all services." with no
    // code, no expiry, no row — must be gone.
    expect(url).not.toContain(encodeURIComponent('Limited-time 15% off all services.'));

    openSpy.mockRestore();
  });

  it('#50: a failed promo mint opens no share', async () => {
    mockAuthFetch.mockImplementation((url: string) => {
      if (url === '/api/tenant/subscription') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(PRO_SUBMISSION) });
      }
      if (url === '/api/tenant/alerts') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_ALERTS) });
      }
      if (url === '/api/tenant/promo-codes') {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'nope' }) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<MarketPulseWidget businessName="Test Salon" />);
    await waitFor(() => {
      expect(screen.getAllByText(/Broadcast Flash Sale/).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByText(/Broadcast Flash Sale/));
    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith(
        '/api/tenant/promo-codes',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(openSpy).not.toHaveBeenCalled();

    // Button is live again, not stuck in a minting state.
    await waitFor(() => {
      expect(screen.getAllByText(/Broadcast Flash Sale/).length).toBeGreaterThan(0);
    });
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

    render(<MarketPulseWidget businessName="Test Salon" />);
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

    render(<MarketPulseWidget businessName="Test Salon" />);
    await waitFor(() => {
      // Falls back to the calm empty state, not an error blast.
      expect(screen.getAllByText(/No hot demand right now/).length).toBeGreaterThan(0);
    });
  });
});
