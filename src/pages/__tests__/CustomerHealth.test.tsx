// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

import { CustomerHealth } from '../Dashboard/CustomerHealth';

const PRO_SUBMISSION = {
  subscription: { id: 's1', tenantId: 't1', planId: 'p1', status: 'active', endsAt: null },
  plan: { id: 'p1', name: 'pro', maxStaff: 10, customDomainAllowed: true },
};

const FREE_SUBMISSION = {
  subscription: { id: 's1', tenantId: 't1', planId: 'p0', status: 'active', endsAt: null },
  plan: { id: 'p0', name: 'free', maxStaff: 2, customDomainAllowed: false },
};

const CUSTOMERS = [
  {
    phone: '+251900000001', name: 'Loyal Lucy', visitCount: 8, noShowCount: 0,
    totalSpend: 500000, lastVisit: Date.now() - 3 * 86400000, marketingOptIn: true,
    lastCancelledAt: null, healthTag: 'vip_loyal',
  },
  {
    phone: '+251900000002', name: 'Gone Guy', visitCount: 3, noShowCount: 0,
    totalSpend: 120000, lastVisit: Date.now() - 80 * 86400000, marketingOptIn: false,
    lastCancelledAt: null, healthTag: 'at_risk_churn',
  },
  {
    phone: '+251900000003', name: 'Flaky Fred', visitCount: 9, noShowCount: 3,
    totalSpend: 300000, lastVisit: Date.now() - 5 * 86400000, marketingOptIn: false,
    lastCancelledAt: null, healthTag: 'high_no_show_risk',
  },
];

function mockProOwner() {
  mockAuthFetch.mockImplementation((url: string, opts: any) => {
    if (url === '/api/tenant/subscription') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(PRO_SUBMISSION) });
    }
    if (url === '/api/tenant/customers') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(CUSTOMERS) });
    }
    if (url === '/api/tenant/settings/upfront-phones') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ require_upfront_phones: [] }) });
    }
    if (url === '/api/tenant/promo-codes' && opts?.method === 'POST') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ code: 'HOLIDAYAB12' }) });
    }
    if (url.toString().includes('/require-upfront')) {
      const body = opts?.body ? JSON.parse(opts.body) : {};
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ require_upfront: body.require }) });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });
}

describe('CustomerHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('tenantSlug', 'mysalon');
    localStorage.setItem('tenantName', 'My Salon');
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the upgrade gate for a non-Pro tenant', async () => {
    mockAuthFetch.mockImplementation((url: string) => {
      if (url === '/api/tenant/subscription') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(FREE_SUBMISSION) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });

    render(<CustomerHealth />);
    await waitFor(() => {
      expect(screen.getByText('Pro feature')).toBeInTheDocument();
    });
    expect(screen.getByText(/Customer Health & Risk Scoring is available on the Pro plan/i)).toBeInTheDocument();
  });

  it('renders customers grouped by health tag for a Pro owner', async () => {
    mockProOwner();

    render(<CustomerHealth />);
    await waitFor(() => {
      expect(screen.getByText('Loyal Lucy')).toBeInTheDocument();
    });

    expect(screen.getByText('Gone Guy')).toBeInTheDocument();
    expect(screen.getByText('Flaky Fred')).toBeInTheDocument();

    // Group headings.
    expect(screen.getByText('VIP Loyal')).toBeInTheDocument();
    expect(screen.getByText('At Risk of Churn')).toBeInTheDocument();
    expect(screen.getByText('High No-Show Risk')).toBeInTheDocument();
  });

  it('renders a 15% holiday voucher button for vip_loyal customers', async () => {
    mockProOwner();

    render(<CustomerHealth />);
    await waitFor(() => {
      expect(screen.getByText('Loyal Lucy')).toBeInTheDocument();
    });

    const voucherBtns = screen.getAllByText(/Send Holiday Gift Voucher · 15%/);
    expect(voucherBtns.length).toBe(1);
  });

  it('renders a 10% comeback discount button for at_risk_churn customers', async () => {
    mockProOwner();

    render(<CustomerHealth />);
    await waitFor(() => {
      expect(screen.getByText('Gone Guy')).toBeInTheDocument();
    });

    const comebackBtns = screen.getAllByText(/Send Comeback Discount · 10%/);
    expect(comebackBtns.length).toBe(1);
  });

  it('renders a "Require Upfront Telebirr" toggle for high_no_show_risk customers', async () => {
    mockProOwner();

    render(<CustomerHealth />);
    await waitFor(() => {
      expect(screen.getByText('Flaky Fred')).toBeInTheDocument();
    });

    const upfrontBtns = screen.getAllByText(/Require Upfront Telebirr$/);
    expect(upfrontBtns.length).toBe(1);
  });

  it('toggles the upfront requirement for a no-show-risk customer', async () => {
    const user = userEvent.setup();
    mockProOwner();

    render(<CustomerHealth />);
    await waitFor(() => {
      expect(screen.getByText('Flaky Fred')).toBeInTheDocument();
    });

    const upfrontBtn = screen.getByText(/Require Upfront Telebirr$/);
    await user.click(upfrontBtn);

    await waitFor(() => {
      // After toggle ON, the button reflects the active state.
      expect(screen.getByText(/Require Upfront Telebirr · ON/)).toBeInTheDocument();
    });

    // The POST carried require: true for this phone (the '+' is URL-encoded).
    const calls = mockAuthFetch.mock.calls.filter(
      (c) => c[0].toString().includes('/require-upfront'),
    );
    expect(calls.length).toBe(1);
    expect(JSON.parse(calls[0][1].body)).toEqual({ require: true });
  });

  it('opens Telegram share when sending a voucher', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    mockProOwner();

    render(<CustomerHealth />);
    await waitFor(() => {
      expect(screen.getByText('Loyal Lucy')).toBeInTheDocument();
    });

    const voucherBtn = screen.getByText(/Send Holiday Gift Voucher · 15%/);
    await user.click(voucherBtn);

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('https://t.me/share/url'), '_blank');
    });
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('My Salon')), '_blank');
    openSpy.mockRestore();
  });
});
