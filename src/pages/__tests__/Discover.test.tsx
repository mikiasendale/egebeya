// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://egebeya.et/discover"}
/**
 * #66 — Search submits (it used to erase the query), card links are https,
 * and the header strings come from i18n (mocked here as their keys — the
 * parity of en/am is enforced by the locale files themselves, not this file).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../components/Navbar', () => ({ Navbar: () => null }));
vi.mock('../../components/Footer', () => ({ Footer: () => null }));
vi.mock('../../components/ReportBlockLinks', () => ({ ReportBlockLinks: () => null }));

import { Discover } from '../Discover';

const BUSINESS = {
  id: 'b1', name: 'Selam Salon', slug: 'selam-salon',
  category: 'Salon', city: 'Addis Ababa', heroImage: null, isNew: false,
};

let fetchCalls: string[];

beforeEach(() => {
  fetchCalls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: any) => {
    fetchCalls.push(String(url));
    return {
      ok: true,
      headers: { get: () => '1' },
      json: async () => [BUSINESS],
    } as any;
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Discover (#66)', () => {
  it('Search button submits the query instead of erasing it, and refetches', async () => {
    render(<Discover />);
    await waitFor(() => expect(fetchCalls.length).toBeGreaterThan(0));

    const input = screen.getByLabelText('discover.searchPlaceholder');
    fireEvent.change(input, { target: { value: 'barber' } });
    fireEvent.click(screen.getByText('discover.search'));

    await waitFor(() => {
      expect(fetchCalls.some((u) => u.includes('q=barber'))).toBe(true);
    });
    // The query survives the click.
    expect((input as HTMLInputElement).value).toBe('barber');

    // Clicking Search again with unchanged text still refetches (nonce).
    const before = fetchCalls.length;
    fireEvent.click(screen.getByText('discover.search'));
    await waitFor(() => expect(fetchCalls.length).toBeGreaterThan(before));
  });

  it('a separate ✕ control clears the query', async () => {
    render(<Discover />);
    const input = screen.getByLabelText('discover.searchPlaceholder');
    expect(screen.queryByTestId('discover-clear-search')).toBeNull();

    fireEvent.change(input, { target: { value: 'nails' } });
    const clear = await screen.findByTestId('discover-clear-search');
    fireEvent.click(clear);
    expect((input as HTMLInputElement).value).toBe('');

    await waitFor(() => {
      const last = fetchCalls[fetchCalls.length - 1];
      expect(last).not.toContain('q=nails');
    });
  });

  it('renders https tenant links only', async () => {
    const { container } = render(<Discover />);
    await waitFor(() => expect(screen.getByText('Selam Salon')).toBeTruthy());
    const link = container.querySelector('a[href]');
    expect(link!.getAttribute('href')).toBe('https://selam-salon.egebeya.et');
    expect(container.innerHTML).not.toContain('http://');
  });

  it('header strings resolve through i18n', async () => {
    render(<Discover />);
    expect(await screen.findByText('discover.title')).toBeTruthy();
    expect(screen.getByText('discover.subtitle')).toBeTruthy();
    expect(screen.getByText('discover.search')).toBeTruthy();
  });
});
