/**
 * @vitest-environment jsdom
 *
 * P5.2 — punch-card ring: reflects the ledger sum, consumer JWT only.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

import '../../i18n';

const authFetchMock = vi.fn();
vi.mock('../../lib/api', () => ({ authFetch: (...args: any[]) => authFetchMock(...args) }));

import { ConsumerBookings, PunchRing } from '../ConsumerBookings';

beforeEach(() => {
  authFetchMock.mockReset();
  localStorage.clear();
});

afterEach(cleanup);

describe('PunchRing (P5.2)', () => {
  it('stroke-dashoffset reflects the ledger sum (3 of 5)', () => {
    const C = 2 * Math.PI * 54;
    render(
      <MemoryRouter>
        <PunchRing punches={3} target={5} />
      </MemoryRouter>,
    );
    const progress = screen.getByTestId('punch-ring-progress');
    expect(progress.getAttribute('stroke-dasharray')).toBe(String(C));
    // dashoffset = C × (1 − 3/5)
    expect(Number(progress.getAttribute('stroke-dashoffset'))).toBeCloseTo(C * 0.4, 5);
    expect(screen.getByTestId('punch-ring').textContent).toContain('3');
  });

  it('full card clamps the ring to complete', () => {
    const C = 2 * Math.PI * 54;
    render(
      <MemoryRouter>
        <PunchRing punches={7} target={5} />
      </MemoryRouter>,
    );
    expect(Number(screen.getByTestId('punch-ring-progress').getAttribute('stroke-dashoffset'))).toBeCloseTo(0, 5);
  });
});

describe('ConsumerBookings page (P5.2)', () => {
  it('renders the ring from the loyalty endpoint using the consumer JWT', async () => {
    localStorage.setItem('consumerToken', 'consumer-jwt-1');
    localStorage.setItem('tenantId', 'tenant-1');
    authFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        punches: 3, target: 5, rewardReady: false,
        rewardConfig: { type: 'percent', value: 10 }, gateOpen: true,
      }),
    });

    render(
      <MemoryRouter>
        <ConsumerBookings />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('punch-ring')).toBeTruthy());
    expect(authFetchMock).toHaveBeenCalledWith('/api/consumer/loyalty/tenant-1');
    expect(screen.getByTestId('punch-ring').textContent).toContain('3');
  });

  it('shows the sign-in prompt without a consumer token — no data fetch', async () => {
    render(
      <MemoryRouter>
        <ConsumerBookings />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(/No consumer session yet/)).toBeTruthy());
    expect(authFetchMock).not.toHaveBeenCalled();
  });
});
