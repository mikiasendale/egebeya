/**
 * @vitest-environment jsdom
 *
 * P1.3 — Billing page price ladder + checkout button state machine.
 * Three rendered states per acceptance:
 *   1. Founding member (active): "founding rate locked" chip + renewal date,
 *      never a naked price delta — plain Renew.
 *   2. New tenant (free): list-price upgrade CTA, value frame above price,
 *      cycle selector wired into the checkout POST body.
 *   3. Grace period (lapsed Pro): amber banner + Renew handoff.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const STRINGS: Record<string, string> = {
  'dashboard.billing.title': 'ክፍያ እና እቅድ',
  'dashboard.billing.foundingLocked': 'የመስራች ዋጋ ተይዟል',
  'dashboard.billing.foundingLockedHint': 'Founding rate locked until {{date}}',
  'dashboard.billing.valueFrame': '{{count}} bookings this month — Pro already pays for itself',
  'dashboard.billing.valueFrameOne': '1 booking this month',
  'dashboard.billing.paymentPending': 'Payment pending',
  'dashboard.billing.upgrade': 'Upgrade to Pro — {{price}} ETB/month',
  'dashboard.billing.renew': 'Renew Pro — {{price}} ETB',
  'dashboard.billing.cycleMonthly': 'Monthly',
  'dashboard.billing.cycleQuarterly': 'Quarterly (5% off)',
  'dashboard.billing.cycleAnnual': 'Annual · 10-for-12',
  'dashboard.billing.cycleNote': 'Secure Chapa checkout.',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      let s = STRINGS[key] ?? key;
      for (const [k, v] of Object.entries(opts ?? {})) {
        s = s.replaceAll(`{{${k}}}`, String(v));
      }
      return s;
    },
  }),
}));

vi.mock('../../components/ui/toast-helper', () => ({
  showToast: vi.fn(),
}));

const assignMock = vi.fn();

// authFetch route stub — set `respond` per-test.
const authFetchMock = vi.fn();
vi.mock('../../lib/api', () => ({
  authFetch: (...args: any[]) => authFetchMock(...args),
}));

import { Billing } from '../Dashboard/Billing';

function subPayload(overrides: Record<string, any> = {}) {
  const now = Date.now();
  return {
    subscription: { id: 's1', tenantId: 't1', planId: 'p2', status: 'active', startsAt: now - 86400_000, endsAt: now + 20 * 86400_000, trialEndsAt: null },
    plan: { id: 'p2', name: overrides.planName ?? 'pro', price: 100000, maxStaff: 10, customDomainAllowed: true },
    staffUsage: 3,
    billing: {
      planName: overrides.planName ?? 'pro',
      priceEtbPerMonth: '1000',
      state: overrides.state ?? 'active',
      graceEndsAt: now + 25 * 86400_000,
      renewRequired: false,
      isFoundingRate: overrides.isFoundingRate ?? false,
      foundingRateLockedUntil: overrides.foundingRateLockedUntil ?? null,
      monthlyBookings: overrides.monthlyBookings ?? 0,
      pendingCheckout: overrides.pendingCheckout ?? false,
      ...(overrides.billingExtra ?? {}),
    },
  };
}

function renderBilling() {
  return render(
    <MemoryRouter>
      <Billing />
    </MemoryRouter>,
  );
}

beforeAll(() => {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, assign: assignMock },
    writable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Billing page price ladder (P1.3)', () => {
  it('founding member sees the locked-rate chip + renewal date, plain Renew (no naked delta)', async () => {
    authFetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/api/tenant/subscription') && !(url as string).includes('checkout')) {
        return {
          ok: true,
          json: async () => subPayload({ isFoundingRate: true, foundingRateLockedUntil: Date.now() + 200 * 86400_000 }),
        } as any;
      }
      throw new Error('unexpected call ' + url);
    });

    renderBilling();
    await waitFor(() => expect(screen.getByTestId('founding-hint')).toBeTruthy());

    expect(screen.getByText('የመስራች ዋጋ ተይዟል')).toBeTruthy();
    expect(screen.getByTestId('founding-hint').textContent).toMatch(/Founding rate locked until/);

    // Existing tenants get a quiet Renew — the upgrade CTA must NOT render.
    const renew = screen.getByTestId('renew-btn');
    expect(renew.textContent).toContain('Renew Pro');
    expect(screen.queryByTestId('upgrade-btn')).toBeNull();
    expect(screen.queryByTestId('value-frame')).toBeNull();
  });

  it('new tenant sees list-price upgrade, value frame above price, cycle selector wired to POST body', async () => {
    authFetchMock.mockImplementation(async (url: string) => {
      if ((url as string).includes('/api/tenant/subscription/checkout')) {
        return {
          ok: true,
          json: async () => ({ success: true, checkoutUrl: 'https://checkout.chapa.co/sandbox/pay/X' }),
        } as any;
      }
      if (url.includes('/api/tenant/subscription')) {
        return {
          ok: true,
          json: async () => subPayload({ planName: 'free', state: 'active', monthlyBookings: 4 }),
        } as any;
      }
      throw new Error('unexpected call ' + url);
    });

    renderBilling();
    const frame = await waitFor(() => screen.getByTestId('value-frame'));
    // Value frame sits ABOVE the price CTA (CPO ruling).
    const upgradeBtn = screen.getByTestId('upgrade-btn');
    expect(frame.compareDocumentPosition(upgradeBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(frame.textContent).toContain('4 bookings this month');
    expect(upgradeBtn.textContent).toContain('1000 ETB/month');

    // Cycle selector → quarterly → receipt strip prints the discount stamp
    // and the POST body carries cycle: 90 → redirect.
    fireEvent.click(screen.getByRole('radio', { name: /Quarterly \(5% off\)/ }));
    const stamp = await waitFor(() => screen.getByTestId('cycle-discount-stamp'));
    expect(stamp.textContent).toBe('5% OFF');
    fireEvent.click(upgradeBtn);

    await waitFor(() => expect(assignMock).toHaveBeenCalledWith('https://checkout.chapa.co/sandbox/pay/X'));
    const postCall = authFetchMock.mock.calls.find((c: any[]) => String(c[0]).includes('checkout'));
    expect(JSON.parse(postCall![1].body)).toEqual({ cycle: 90 });
  });

  it('grace-period lapsed Pro shows the amber renew banner', async () => {
    authFetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/api/tenant/subscription') && !(url as string).includes('checkout')) {
        return {
          ok: true,
          json: async () => subPayload({ state: 'grace' }),
        } as any;
      }
      throw new Error('unexpected call ' + url);
    });

    renderBilling();
    const bannerBtn = await waitFor(() => screen.getByTestId('renew-banner-btn'));
    expect(bannerBtn.textContent).toContain('Renew');
    // Badge + plan copy both mention grace — assert at least one exact badge.
    expect(screen.getAllByText('Grace period').length).toBeGreaterThan(0);
    // No upgrade CTA for an existing Pro tenant mid-grace.
    expect(screen.queryByTestId('upgrade-btn')).toBeNull();
  });
});
