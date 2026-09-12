// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockAuthFetch = vi.fn();
vi.mock('../../lib/api', () => ({
  authFetch: (...args: any[]) => mockAuthFetch(...args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockCustomers = [
  { phone: '+251911111111', name: 'Abebe Bikila', visitCount: 5, totalSpend: 250000, lastVisit: Date.now() - 40 * 86400000, lastCancelledAt: null },
  { phone: '+251922222222', name: 'Haile Gebrselassie', visitCount: 12, totalSpend: 600000, lastVisit: Date.now() - 60 * 86400000, lastCancelledAt: null },
  { phone: '+251933333333', name: null, visitCount: 1, totalSpend: 50000, lastVisit: null, lastCancelledAt: null },
];

import { WinBackWidget } from '../../components/dashboard/WinBackWidget';

describe('WinBackWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('tenantSlug', 'test-salon');
  });

  it('renders inactive customers after loading', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCustomers),
    });

    render(<WinBackWidget businessName="Test Salon" />);

    await waitFor(() => {
      expect(screen.getAllByText('Abebe Bikila').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Haile Gebrselassie').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+251933333333').length).toBeGreaterThan(0);
  });

  it('shows days inactive correctly', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCustomers),
    });

    render(<WinBackWidget businessName="Test Salon" />);

    await waitFor(() => {
      expect(screen.getAllByText(/40d ago/).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/60d ago/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Never visited/).length).toBeGreaterThan(0);
  });

  it('renders Send Win-Back buttons for each customer', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCustomers),
    });

    render(<WinBackWidget businessName="Test Salon" />);

    await waitFor(() => {
      const buttons = screen.getAllByText('Send Win-Back');
      expect(buttons.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('opens Telegram only AFTER minting a real single-use WIN10-XXXX code, carrying that code', async () => {
    const seq: string[] = [];
    mockAuthFetch.mockImplementation(async (url: string, init?: any) => {
      if (String(url).includes('/api/tenant/promo-codes')) {
        seq.push('promo-post');
        return { ok: true, json: () => Promise.resolve({ id: 'p1' }) } as any;
      }
      return { ok: true, json: () => Promise.resolve([mockCustomers[0]]) } as any;
    });

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {
      seq.push('open');
      return null;
    });

    render(<WinBackWidget businessName="Test Salon" />);

    await waitFor(() => {
      expect(screen.getAllByText('Abebe Bikila').length).toBeGreaterThan(0);
    });

    const sendBtns = screen.getAllByText('Send Win-Back');
    fireEvent.click(sendBtns[0]);

    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1));

    // The chat opens only after a real promo row exists.
    expect(seq).toEqual(['promo-post', 'open']);

    const post = mockAuthFetch.mock.calls.find((c) => String(c[0]).includes('/api/tenant/promo-codes'));
    expect(post).toBeTruthy();
    const body = JSON.parse(post![1].body);
    expect(body.code).toMatch(/^WIN10-[A-Z0-9]{4}$/);
    expect(body.discountType).toBe('percent');
    expect(body.discountValue).toBe(10);
    expect(body.maxUses).toBe(1);

    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toContain('https://t.me/share/url');
    expect(url).toContain('https://test-salon.egebeya.et');
    // The share text carries the MINTED code — never the old literal WIN10.
    expect(url).toContain(encodeURIComponent(`Use code ${body.code} for 10% off your next visit.`));
    expect(url).not.toContain(encodeURIComponent('Use code WIN10 for'));

    openSpy.mockRestore();
  });

  it('marks customer as Sent after clicking Send Win-Back', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([mockCustomers[0]]),
    });

    vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<WinBackWidget businessName="Test Salon" />);

    await waitFor(() => {
      expect(screen.getAllByText('Send Win-Back').length).toBeGreaterThan(0);
    });

    const sendBtns = screen.getAllByText('Send Win-Back');
    fireEvent.click(sendBtns[0]);

    await waitFor(() => {
      expect(screen.getAllByText('Sent').length).toBeGreaterThan(0);
    });

    vi.restoreAllMocks();
  });

  it('shows error state on fetch failure', async () => {
    mockAuthFetch.mockResolvedValue({ ok: false });

    render(<WinBackWidget businessName="Test Salon" />);

    await waitFor(() => {
      expect(screen.getAllByText('Could not load inactive customers').length).toBeGreaterThan(0);
    });
  });

  it('shows empty state when no inactive customers', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<WinBackWidget businessName="Test Salon" />);

    await waitFor(() => {
      expect(screen.getAllByText(/No inactive customers/).length).toBeGreaterThan(0);
    });
  });
});
