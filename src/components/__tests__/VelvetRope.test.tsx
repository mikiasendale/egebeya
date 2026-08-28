/**
 * @vitest-environment jsdom
 *
 * P5.4 — velvet rope: locked-but-labeled, value-anchored sheet, am+en copy.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import React from 'react';

import '../../i18n';
import i18n from 'i18next';

const authFetchMock = vi.fn();
vi.mock('../../lib/api', () => ({ authFetch: (...args: any[]) => authFetchMock(...args) }));

import { LockChip, ValuePricingSheet } from '../dashboard/VelvetRope';
import { VelvetRopeMore } from '../../pages/Dashboard/VelvetRopeMore';

beforeEach(() => {
  authFetchMock.mockReset();
});

afterEach(cleanup);

describe('VelvetRope (P5.4)', () => {
  it('lock chip renders with the Pro label and never hides its host', () => {
    render(
      <button type="button">
        AI Assistant <LockChip />
      </button>,
    );
    const chip = screen.getByTestId('velvet-lock-chip');
    expect(chip.textContent).toContain('Pro');
    // The host button still exists and is enabled — labels only.
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('value scene leads the sheet when booking data exists', async () => {
    await i18n.changeLanguage('en');
    render(<ValuePricingSheet open onClose={() => {}} info={{ planName: 'free', isPro: false, monthlyBookings: 42 }} />);
    expect(screen.getByTestId('value-scene').textContent).toBe('You took 42 bookings this month');
    // The scene sits ABOVE the price in DOM order.
    const scene = screen.getByTestId('value-scene');
    const price = screen.getByTestId('velvet-price');
    expect(scene.compareDocumentPosition(price) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('velvet-upgrade-cta').getAttribute('href')).toBe('/dashboard/billing');
  });

  it('no fabricated scene when there is no data — price stands alone', () => {
    render(<ValuePricingSheet open onClose={() => {}} info={{ planName: 'free', isPro: false, monthlyBookings: 0 }} />);
    expect(screen.queryByTestId('value-scene')).toBeNull();
    expect(screen.getByTestId('velvet-price')).toBeTruthy();
  });

  it('COPY TEST: every velvet-rope string exists in BOTH am and en (free tenant can enumerate)', async () => {
    const am = i18n.getResourceBundle('am', 'translation') as any;
    const en = i18n.getResourceBundle('en', 'translation') as any;
    for (const key of ['sheetTitle', 'perkCustomDomain', 'perkCodeMode', 'perkStaff', 'priceLabel', 'priceValue', 'upgradeCta']) {
      expect(am.velvet?.[key], `am.velvet.${key} missing`).toBeTruthy();
      expect(en.velvet?.[key], `en.velvet.${key} missing`).toBeTruthy();
    }
    // Amharic-first value props are genuinely Amharic.
    expect(/[\u1200-\u137F]/.test(am.velvet.perkCodeMode)).toBe(true);
  });
});

// P5.4 G5 — the enumeration surface (locked-but-labeled, never hidden).
describe('VelvetRopeMore (P5.4 G5)', () => {
  function renderMore(planName: string, monthlyBookings: number | null = null) {
    authFetchMock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        plan: { name: planName, maxStaff: 10, customDomainAllowed: planName === 'pro' },
        billing: { monthlyBookings },
      }),
    }));
    return render(
      <MemoryRouter initialEntries={['/dashboard/more']}>
        <Routes>
          <Route path="/dashboard/more" element={<VelvetRopeMore />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('(a) free tenant enumerates every gated capability with a lock chip + value prop (am+en)', async () => {
    await i18n.changeLanguage('am');
    renderMore('free');
    for (const key of ['aiAssistant', 'codeMode', 'automations', 'customerHealth', 'customDomain']) {
      await waitFor(() => expect(screen.getByTestId(`gated-${key}`)).toBeTruthy());
      const item = screen.getByTestId(`gated-${key}`);
      expect(item.querySelector('[data-testid="velvet-lock-chip"]')).toBeTruthy();
      // Amharic value prop is genuinely Amharic.
      expect(/[\u1200-\u137F]/.test(item.textContent ?? '')).toBe(true);
    }
    // en parity exists for every enumerated name/value.
    const en = i18n.getResourceBundle('en', 'translation') as any;
    for (const key of ['aiAssistant', 'codeMode', 'automations', 'customerHealth', 'customDomain']) {
      expect(en.velvetMore?.[key]?.name).toBeTruthy();
      expect(en.velvetMore?.[key]?.value).toBeTruthy();
    }
  });

  it('(b) tapping a locked item opens the value-anchored pricing sheet', async () => {
    await i18n.changeLanguage('en');
    const user = (await import('@testing-library/user-event')).default.setup();
    renderMore('free', 42);

    await waitFor(() => expect(screen.getByTestId('gated-aiAssistant')).toBeTruthy());
    await user.click(screen.getByTestId('gated-aiAssistant').querySelector('[data-testid="velvet-lock-chip"]')!);

    await waitFor(() => expect(screen.getByTestId('value-pricing-sheet')).toBeTruthy());
    // Value scene (the merchant's own bookings) leads above the price.
    expect(screen.getByTestId('value-scene').textContent).toBe('You took 42 bookings this month');
  });

  it('(c) paying tenant sees NO lock chips — every item shows Included', async () => {
    await i18n.changeLanguage('en');
    renderMore('pro', null);
    await waitFor(() => expect(screen.getByTestId('gated-aiAssistant')).toBeTruthy());
    expect(screen.queryAllByTestId('velvet-lock-chip')).toHaveLength(0);
    expect(screen.getAllByText(/Included/).length).toBe(5);
  });
});
