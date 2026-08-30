/**
 * @vitest-environment jsdom
 *
 * P2.6 reopen (B1) — the Settings page completes the DARK-banner loop:
 * saving business hours fires POST /api/tenant/provision/confirm-hours
 * (idempotent), toasts the am+en "site is live" message, and announces the
 * flip via the 'egebeya:hours-confirmed' event the dashboard shell listens
 * for. The banner's old CTA was a dead end — this closes it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const authFetchMock = vi.fn();
vi.mock('../../lib/api', () => ({
  authFetch: (...args: any[]) => authFetchMock(...args),
}));

const toastSpy = vi.fn();
vi.mock('../../components/ui/toast-helper', () => ({
  showToast: (...args: any[]) => toastSpy(...args),
}));

// The settings page renders subscription/billing sections too; stub anything
// heavy and keep fetch responses generic.
vi.mock('date-fns', () => ({ format: () => '00:00' }));

// Initialize the REAL i18n instance so the toast assertion covers actual
// am/en strings (not bare keys) — this doubles as the parity check for the
// new settings.* strings.
import '../../i18n';
import i18n from 'i18next';

import { Settings } from '../Dashboard/Settings';

function installFetchMock(opts: { confirmOk?: boolean } = {}) {
  authFetchMock.mockImplementation(async (url: string, init?: any) => {
    if (/\/api\/tenant\/business-hours$/.test(url) && init?.method === 'PUT') {
      return { ok: true, json: async () => ({ success: true }) } as any;
    }
    if (/\/api\/tenant\/business-hours$/.test(url)) {
      return {
        ok: true,
        json: async () => [
          { dayOfWeek: 0, openTime: null, closeTime: null, isClosed: true },
          ...[1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openTime: '09:00', closeTime: '18:00', isClosed: false })),
        ],
      } as any;
    }
    if (url.includes('/provision/confirm-hours')) {
      if (opts.confirmOk === false) return { ok: false, json: async () => ({}) } as any;
      return { ok: true, json: async () => ({ success: true }) } as any;
    }
    if (url.includes('/api/tenant/quiet-hours') && init?.method === 'PUT') {
      return { ok: true, json: async () => ({ success: true }) } as any;
    }
    if (url.includes('/api/tenant/subscription')) {
      return {
        ok: true,
        json: async () => ({
          subscription: { status: 'trial', trialEndsAt: Date.now() + 86_400_000 },
          plan: { name: 'pro', maxStaff: 10, customDomainAllowed: true },
          staffUsage: 1,
        }),
      } as any;
    }
    // settings payload — carries an existing quiet-hours config to pre-populate.
    return {
      ok: true,
      json: async () => ({
        name: 'Selam Salon',
        slug: 'selam-salon',
        quiet_hours_discount: { enabled: true, start_minute: 780, end_minute: 900, percent: 20 },
      }),
    } as any;
  });
}

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authFetchMock.mockReset();
  toastSpy.mockClear();
  installFetchMock();
});

afterEach(cleanup);

describe('Settings hours-save → confirm-hours loop (P2.6 B1)', () => {
  it('calls confirm-hours after a successful save and toasts "site is live" in both languages', async () => {
    // Assert both locale bundles carry the live-toast strings (am/en parity
    // for the new keys)…
    expect(i18n.getResourceBundle('am', 'translation')?.settings?.siteLiveTitle)
      .toBe('ጣቢያዎ አሁን በይዘት ክፍት ነው');
    expect(i18n.getResourceBundle('en', 'translation')?.settings?.siteLiveTitle)
      .toBe('Your site is now live');

    const user = userEvent.setup();
    renderSettings();

    const saveBtn = await waitFor(() => screen.getByRole('button', { name: /Save Business Hours/ }));
    await user.click(saveBtn);

    await waitFor(() => {
      const confirmCalls = authFetchMock.mock.calls.filter((c: any[]) =>
        String(c[0]).includes('/provision/confirm-hours'));
      expect(confirmCalls.length).toBe(1);
      expect(confirmCalls[0][1]?.method).toBe('POST');
    });

    // …and that the toast actually fired with i18n-resolved copy (en default).
    await waitFor(() => expect(toastSpy).toHaveBeenCalled());
    const toastArgs = JSON.stringify(toastSpy.mock.calls);
    expect(toastArgs).toContain('Your site is now live');
    expect(toastArgs).toContain('Hours confirmed — customers can start booking.');
  });

  it('stays idempotent-safe: repeat saves call confirm-hours again without error', async () => {
    const user = userEvent.setup();
    renderSettings();

    const saveBtn = await waitFor(() => screen.getByRole('button', { name: /Save Business Hours/ }));
    await user.click(saveBtn);
    await waitFor(() => expect(confirmHoursCalls()).toBe(1));
    await user.click(saveBtn);
    await waitFor(() => expect(confirmHoursCalls()).toBe(2));
  });

  it('skips the confirmation call when the hours PUT itself failed', async () => {
    authFetchMock.mockImplementation(async (url: string, init?: any) => {
      if (/\/api\/tenant\/business-hours$/.test(url) && init?.method === 'PUT') {
        return { ok: false, json: async () => ({ error: 'nope' }) } as any;
      }
      if (/\/api\/tenant\/business-hours$/.test(url)) return { ok: true, json: async () => [] } as any;
      if (url.includes('/api/tenant/quiet-hours') && init?.method === 'PUT') {
      return { ok: true, json: async () => ({ success: true }) } as any;
    }
    if (url.includes('/api/tenant/subscription')) {
        return {
          ok: true,
          json: async () => ({
            subscription: { status: 'trial', trialEndsAt: Date.now() + 86_400_000 },
            plan: { name: 'pro', maxStaff: 10, customDomainAllowed: true },
            staffUsage: 1,
          }),
        } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });

    const user = userEvent.setup();
    renderSettings();
    const saveBtn = await waitFor(() => screen.getByRole('button', { name: /Save Business Hours/ }));
    await user.click(saveBtn);
    await new Promise((r) => setTimeout(r, 50));
    expect(confirmHoursCalls()).toBe(0);
  });
});

function confirmHoursCalls(): number {
  return authFetchMock.mock.calls.filter((c: any[]) =>
    String(c[0]).includes('/provision/confirm-hours')).length;
}


describe('Quiet-hours discount toggle (P5.6 G1)', () => {
  beforeEach(() => {
    installFetchMock();
  });

  function quietCalls() {
    return authFetchMock.mock.calls.filter((c: any[]) =>
      String(c[0]).includes('/api/tenant/quiet-hours') && c[1]?.method === 'PUT');
  }

  it('pre-populates from existing settings and PUTs the exact body on save', async () => {
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => expect(screen.getByTestId('quiet-save-btn')).toBeTruthy());
    // The section renders before the settings fetch resolves — wait for the
    // PRE-POPULATED state (enabled, 13:00–15:00, 20%) to land.
    await waitFor(() =>
      expect((screen.getByTestId('quiet-enabled-toggle') as HTMLInputElement).checked).toBe(true));
    expect((screen.getByTestId('quiet-percent') as HTMLInputElement).value).toBe('20');

    await user.click(screen.getByTestId('quiet-save-btn'));
    await waitFor(() => expect(quietCalls()).toHaveLength(1));
    expect(JSON.parse(quietCalls()[0][1].body)).toEqual({
      enabled: true, startMinute: 780, endMinute: 900, percent: 20,
    });
  });

  it('toggling OFF sends enabled:false', async () => {
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => expect(screen.getByTestId('quiet-enabled-toggle')).toBeTruthy());

    await user.click(screen.getByTestId('quiet-enabled-toggle')); // off
    await user.click(screen.getByTestId('quiet-save-btn'));
    await waitFor(() => expect(quietCalls()).toHaveLength(1));
    const body = JSON.parse(quietCalls()[0][1].body);
    expect(body.enabled).toBe(false);
  });

  it('server validation errors show inline without saving', async () => {
    // Start from the full working harness, then make ONLY the quiet PUT fail.
    installFetchMock();
    const base = authFetchMock.getMockImplementation()!;
    authFetchMock.mockImplementation(async (url: string, init?: any) => {
      if (url.includes('/api/tenant/quiet-hours') && init?.method === 'PUT') {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: 'percent must be an integer between 1 and 90' }),
        } as any;
      }
      return base(url, init);
    });

    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => expect(screen.getByTestId('quiet-save-btn')).toBeTruthy());

    await user.click(screen.getByTestId('quiet-save-btn'));
    await waitFor(() => expect(screen.getByTestId('quiet-error')).toBeTruthy());
    expect(screen.getByTestId('quiet-error').textContent).toContain('percent must be an integer');
  });
});
