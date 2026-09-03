/**
 * @vitest-environment jsdom
 *
 * T4.2 — merchant loyalty card issuance UI.
 *
 *   - Gate dark → the form is replaced by an honest explainer; nothing can be
 *     issued into a dead feature.
 *   - Gate open → phone input + "Issue punch card" → POST /cards → success
 *     toast, and the input clears.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import React from 'react';

const authFetchMock = vi.fn();
vi.mock('../../lib/api', () => ({ authFetch: (...args: any[]) => authFetchMock(...args) }));
const toastSpy = vi.fn();
vi.mock('../../components/ui/toast-helper', () => ({ showToast: (...args: any[]) => toastSpy(...args) }));
// Deterministic `t` — avoids i18n singleton timing when a file runs alone.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { LoyaltyCardIssuer } from '../dashboard/LoyaltyCardIssuer';

function mockGate(open: boolean) {
  authFetchMock.mockImplementation(async (url: string) => {
    if (url === '/api/tenant/loyalty/gate-status') {
      return { ok: true, json: async () => ({ gateOpen: open, enabledFlag: open }) } as any;
    }
    return { ok: true, json: async () => ({}) } as any;
  });
}

beforeEach(() => {
  authFetchMock.mockReset();
  toastSpy.mockClear();
});

afterEach(cleanup);

describe('LoyaltyCardIssuer (T4.2)', () => {
  it('gate dark → explainer, no form, and the card can never be issued', async () => {
    mockGate(false);
    render(<LoyaltyCardIssuer />);

    await waitFor(() => expect(screen.getByTestId('loyalty-gate-state').textContent).toBe('loyaltyStaff.gate.off'));
    // The explainer replaces the form — a dead feature must not gather cards.
    expect(screen.getByText('loyaltyStaff.explainer.title')).toBeTruthy();
    expect(screen.queryByPlaceholderText('loyaltyStaff.phonePlaceholder')).toBeNull();
  });

  it('gate open → issue a card for a real phone number', async () => {
    authFetchMock.mockImplementation(async (url: string, init?: any) => {
      if (url === '/api/tenant/loyalty/gate-status') {
        return { ok: true, json: async () => ({ gateOpen: true, enabledFlag: true }) } as any;
      }
      if (url === '/api/tenant/loyalty/cards' && init?.method === 'POST') {
        return {
          ok: true,
          status: 201,
          json: async () => ({ gateOpen: true, issued: true, card: { punches: 0, target: 5 } }),
        } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });

    const user = userEvent.setup();
    render(<LoyaltyCardIssuer />);

    await waitFor(() => expect(screen.getByTestId('loyalty-gate-state').textContent).toBe('loyaltyStaff.gate.on'));
    await user.type(screen.getByPlaceholderText('loyaltyStaff.phonePlaceholder'), '+251955112233');
    await user.click(screen.getByText('loyaltyStaff.issueButton'));

    await waitFor(() => expect(authFetchMock).toHaveBeenCalledWith(
      '/api/tenant/loyalty/cards',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ phone: '+251955112233' }),
      }),
    ));
    expect(toastSpy).toHaveBeenCalled();
    // Successful issuance clears the input.
    await waitFor(() => expect(screen.getByPlaceholderText('loyaltyStaff.phonePlaceholder')).toHaveValue(''));
  });

  it('an invalid phone is rejected client-side without a network call', async () => {
    mockGate(true);
    const user = userEvent.setup();
    render(<LoyaltyCardIssuer />);

    await waitFor(() => expect(screen.getByTestId('loyalty-gate-state').textContent).toBe('loyaltyStaff.gate.on'));
    await user.type(screen.getByPlaceholderText('loyaltyStaff.phonePlaceholder'), 'not-a-phone');
    await user.click(screen.getByText('loyaltyStaff.issueButton'));

    expect(toastSpy).toHaveBeenCalled();
    expect(authFetchMock).not.toHaveBeenCalledWith(
      '/api/tenant/loyalty/cards',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
