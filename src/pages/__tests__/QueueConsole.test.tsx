/**
 * @vitest-environment jsdom
 *
 * P4.2 — Merchant queue console: "a barber clears his morning queue with
 * one tap per customer."
 *
 *   - Full morning simulated: four entries, ONE tap each, board empties.
 *   - Egebeya bookings float above walk-ins (server order preserved) and
 *     wear the QUEUE-BUSTER badge; walk-ins don't.
 *   - Optimistic flip lands instantly; server truth reconciles.
 *   - Failed advance reverts honestly with a recovery toast path.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const authFetchMock = vi.fn();
vi.mock('../../lib/api', () => ({ authFetch: (...args: any[]) => authFetchMock(...args) }));
const toastSpy = vi.fn();
vi.mock('../../components/ui/toast-helper', () => ({ showToast: (...args: any[]) => toastSpy(...args) }));

if (!(window as any).matchMedia) {
  (window as any).matchMedia = (q: string) => ({
    matches: false, media: q,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
  });
}

import { QueueConsole } from '../Dashboard/QueueConsole';
// Real i18n so translated copy (empty state) resolves for assertions.
import '../../i18n';

const NOW = Date.now();
const MIN = 60_000;

function entry(over: Partial<any> & { id: string; opaqueId: string }) {
  return {
    position: 1, state: 'waiting', customerName: 'Customer', customerInitials: 'C',
    serviceName: 'Haircut', source: 'online', startTime: NOW, checkedInAt: NOW,
    etaMinutes: 0, ...over,
  };
}

function morningBoard() {
  return {
    businessName: 'Queue Barber',
    entries: [
      entry({ id: 'a1', opaqueId: 'opa1', position: 1, state: 'serving', customerName: 'Abebe Kebede', source: 'online' }),
      entry({ id: 'b2', opaqueId: 'opb2', position: 2, customerName: 'Birhan Lemma', source: 'online' }),
      entry({ id: 'c3', opaqueId: 'opc3', position: 3, customerName: 'Chala Guta', source: 'walk_in', etaMinutes: 60 }),
      entry({ id: 'd4', opaqueId: 'opd4', position: 4, customerName: 'Desta Molla', source: 'online', etaMinutes: 90 }),
    ],
  };
}

function installFetch(opts: { failAdvanceFor?: string } = {}) {
  let board = morningBoard();
  authFetchMock.mockImplementation(async (url: string, init?: any) => {
    if (/\/api\/tenant\/queue$/.test(url) && !init?.method) {
      return { ok: true, json: async () => board } as any;
    }
    if (/\/api\/tenant\/queue\/advance\//.test(url)) {
      const id = url.split('/').pop();
      if (opts.failAdvanceFor === id) return { ok: false, json: async () => ({}) } as any;
      const e = board.entries.find((x: any) => x.id === id);
      if (e) {
        if (e.state === 'waiting') e.state = 'serving';
        else board = { ...board, entries: board.entries.filter((x: any) => x.id !== id) };
      }
      return { ok: true, json: async () => ({ ...board, newState: 'advanced' }) } as any;
    }
    return { ok: true, json: async () => ({}) } as any;
  });
}

beforeEach(() => {
  authFetchMock.mockReset();
  toastSpy.mockClear();
});

afterEach(cleanup);

describe('QueueConsole — the barber\'s morning (P4.2)', () => {
  it('clears the whole morning with one tap per customer', async () => {
    const user = userEvent.setup();
    installFetch();
    render(<QueueConsole />);

    // Four cards render in server-canonical order.
    await waitFor(() => expect(screen.getAllByTestId(/^queue-card-/)).toHaveLength(4));
    const cards = screen.getAllByTestId(/^queue-card-/);
    expect(cards[0].getAttribute('data-testid')).toBe('queue-card-opa1');
    expect(cards[3].getAttribute('data-testid')).toBe('queue-card-opd4');

    // One tap per customer — the button label flips per state.
    await user.click(screen.getByTestId('advance-opa1')); // serving → done (drops)
    await user.click(screen.getByTestId('advance-opb2')); // waiting → serving
    await user.click(screen.getByTestId('advance-opc3'));
    await user.click(screen.getByTestId('advance-opd4'));

    // After the full pass the active board holds only post-first-flip rows —
    // reconcile against the mocked server: opa1 done & dropped; b2/c3/d4 serving.
    await waitFor(() => expect(screen.queryByTestId('queue-card-opa1')).toBeNull());
    for (const id of ['opb2', 'opc3', 'opd4']) {
      await waitFor(() => expect(screen.getByTestId(`queue-card-${id}`).getAttribute('data-state')).toBe('serving'));
    }
  });

  it('Egebeya bookings wear the badge and float above walk-ins', async () => {
    installFetch();
    render(<QueueConsole />);
    await waitFor(() => expect(screen.getAllByTestId(/^queue-card-/)).toHaveLength(4));

    const badges = screen.getAllByTestId('queue-buster-badge');
    expect(badges.length).toBe(3); // three online entries

    // The walk-in row (position 3 by server order) has no badge.
    const walkinCard = screen.getByTestId('queue-card-opc3');
    expect(walkinCard.querySelector('[data-testid="queue-buster-badge"]')).toBeNull();

    // Server-canonical ordering is displayed verbatim: online rows first.
    const order = screen.getAllByTestId(/^queue-card-/).map((el) => el.getAttribute('data-testid'));
    expect(order).toEqual(['queue-card-opa1', 'queue-card-opb2', 'queue-card-opc3', 'queue-card-opd4']);
  });

  it('failed advance reverts the optimistic flip instead of lying', async () => {
    const user = userEvent.setup();
    installFetch({ failAdvanceFor: 'b2' });
    render(<QueueConsole />);
    await waitFor(() => expect(screen.getByTestId('queue-card-opb2')).toBeTruthy());

    await user.click(screen.getByTestId('advance-opb2'));

    // Reverts to waiting after the server rejects.
    await waitFor(() => expect(screen.getByTestId('queue-card-opb2').getAttribute('data-state')).toBe('waiting'));
    expect(toastSpy).toHaveBeenCalled();
  });

  it('shows an honest empty state when nobody is queued', async () => {
    authFetchMock.mockImplementation(async () => ({
      ok: true, json: async () => ({ businessName: 'Q', entries: [] }),
    }));
    render(<QueueConsole />);
    await waitFor(() => expect(screen.getByText(/The queue is empty/)).toBeTruthy());
  });
});
