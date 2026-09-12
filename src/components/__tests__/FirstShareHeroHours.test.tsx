/**
 * @vitest-environment jsdom
 *
 * #62 — the share hero must print the tenant's REAL window and never a
 * fabricated 9:00–18:00. Unknown (loading, malformed, closed-day-without-
 * window) renders no numbers at all — null, not zero.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const authFetchMock = vi.fn();
vi.mock('../../lib/api', () => ({
  authFetch: (...args: any[]) => authFetchMock(...args),
}));

import {
  FirstShareHero,
  summarizeDayHours,
  addisWeekday,
  type DayHours,
} from '../FirstShareHero';

describe('summarizeDayHours', () => {
  it('returns null for unknown or malformed payloads', () => {
    expect(summarizeDayHours(null, 3)).toBeNull();
    expect(summarizeDayHours(undefined as unknown as DayHours[] | null, 3)).toBeNull();
    expect(summarizeDayHours([], 3)).toBeNull();
    expect(
      summarizeDayHours([{ dayOfWeek: 1, openTime: '09:00', closeTime: '17:00', isClosed: false }], 3),
    ).toBeNull();
    expect(
      summarizeDayHours([{ dayOfWeek: 3, openTime: null, closeTime: null, isClosed: false }], 3),
    ).toBeNull();
  });

  it('renders closed days and the real window', () => {
    expect(
      summarizeDayHours([{ dayOfWeek: 0, openTime: null, closeTime: null, isClosed: true }], 0),
    ).toBe('ዝግ · Closed');
    expect(
      summarizeDayHours([{ dayOfWeek: 2, openTime: '08:30', closeTime: '19:45', isClosed: false }], 2),
    ).toBe('08:30–19:45');
  });
});

describe('addisWeekday', () => {
  it('stays inside 0-6', () => {
    const d = addisWeekday();
    expect(Number.isInteger(d)).toBe(true);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(6);
  });
});

describe('FirstShareHero hours notice', () => {
  afterEach(() => {
    cleanup();
    authFetchMock.mockReset();
  });

  it('renders the tenant hours from the payload, not the old literals', async () => {
    const wd = addisWeekday();
    authFetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/api/tenant/business-hours')) {
        return {
          ok: true,
          json: async () => [
            { dayOfWeek: wd, openTime: '11:15', closeTime: '20:30', isClosed: false },
          ],
        } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });

    render(
      <MemoryRouter>
        <FirstShareHero businessName="Selam Salon" slug="selam-salon" />
      </MemoryRouter>,
    );

    expect(await screen.findByText('11:15–20:30')).toBeTruthy();
    expect(screen.queryByText(/9:00–18:00/)).toBeNull();
    expect(screen.getByText(/adjust/).closest('a')!.getAttribute('href')).toBe('/dashboard/settings');
  });

  it('prints no fake numbers while hours are still loading', () => {
    authFetchMock.mockImplementation(() => new Promise(() => {}));
    render(
      <MemoryRouter>
        <FirstShareHero businessName="Selam Salon" slug="selam-salon" />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/\d{1,2}:\d{2}/)).toBeNull();
    expect(screen.getByText(/adjust/)).toBeTruthy();
  });
});
