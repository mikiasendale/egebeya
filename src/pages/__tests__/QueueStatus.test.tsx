/**
 * @vitest-environment jsdom
 *
 * P4.3 — Consumer queue board: exactly three states, dual calendar,
 * privacy, and polling discipline.
 *
 *   - "#4 · ~25 min" → "It's your turn" (pulsing) → done — transitions in
 *     the harness as the payload changes.
 *   - Polling pauses on hidden tabs and refreshes on return.
 *   - No customer names anywhere in the DOM.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

// Real i18n so the three state headlines resolve.
import '../../i18n';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function payload(over: Partial<any> = {}) {
  return {
    state: 'waiting',
    position: 4,
    etaMinutes: 25,
    initials: 'ZH',
    startTimeIso: new Date('2026-08-26T09:30:00+03:00').toISOString(),
    timeLabel: '09:30',
    dateEthiopian: { day: 20, monthIndex: 11, year: 2018 },
    ...over,
  };
}

let hidden = false;
Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });

import { QueueStatus } from '../QueueStatus';

function renderBoard(token = 'opaq-token-1') {
  return render(
    <MemoryRouter initialEntries={[`/q/${token}`]}>
      {/* useParams requires a matching Route context for :token */}
      <Routes>
        <Route path="/q/:token" element={<QueueStatus />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  hidden = false;
});

afterEach(cleanup);

describe('QueueStatus — the take-a-number ticket, alive (P4.3)', () => {
  it('state 1: renders "#4 · ~25 min" large with Ge\'ez-primary dual date', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload() });
    renderBoard();

    await waitFor(() => expect(screen.getByTestId('state-waiting')).toBeTruthy());
    expect(screen.getByTestId('position-chip').textContent).toBe('4');
    expect(screen.getByTestId('state-waiting').textContent).toContain('~25');
    // Ge'ez primary (Amharic month ነሐሴ = index 11), Gregorian subtitle.
    const dual = screen.getByTestId('dual-date').textContent!;
    expect(dual).toContain('ነሐሴ');
    expect(dual).toMatch(/\d{4}/);
  });

  it("state 2 → 3: it's-your-turn pulses, then done settles quietly", async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockResolvedValue({ ok: true, json: async () => payload() });
      renderBoard();
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(screen.getByTestId('state-waiting')).toBeTruthy();

      // The barber advances: serving = YOUR TURN. Next poll picks it up.
      fetchMock.mockResolvedValue({ ok: true, json: async () => payload({ state: 'serving', position: null, etaMinutes: null }) });
      await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
      expect(screen.getByTestId('state-turn')).toBeTruthy();
      // The pulse is the whitelisted looping animation.
      expect(screen.getByTestId('turn-pulse')).toBeTruthy();

      // Done lands quiet.
      fetchMock.mockResolvedValue({ ok: true, json: async () => payload({ state: 'done', position: null }) });
      await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
      expect(screen.getByTestId('state-done')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('polls every ≤15s and STOPS on a hidden tab, refreshing on return', async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockResolvedValue({ ok: true, json: async () => payload() });
      renderBoard();
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Tab hides — polls must stop entirely.
      hidden = true;
      act(() => { document.dispatchEvent(new Event('visibilitychange')); });
      await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
      expect(fetchMock).toHaveBeenCalledTimes(2); // zero extra calls while hidden

      // Tab returns — one immediate refresh, then rhythm resumes.
      hidden = false;
      act(() => { document.dispatchEvent(new Event('visibilitychange')); });
      await act(async () => { await vi.advanceTimersByTimeAsync(10); });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
      cleanup();
    }
  });

  it('leaks no names: initials only (payload contract + DOM)', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload({ initials: 'ZH' }) });
    renderBoard();
    await waitFor(() => expect(screen.getByTestId('state-waiting')).toBeTruthy());
    const html = document.body.innerHTML;
    expect(html).not.toContain('Zeyneb');
    expect(html).toContain('ZH');
  });

  it('unknown token → honest expired notice, never fake progress', async () => {
    fetchMock.mockResolvedValue({ status: 404, ok: false, json: async () => ({ error: 'Not found' }) });
    renderBoard('gone-token');
    await waitFor(() => expect(screen.getByText(/Ticket not found|ተራዎ አልተገኘም/)).toBeTruthy());
  });
});
