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
    localStorage.setItem('tenantName', 'Test Salon');
  });

  it('renders inactive customers after loading', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCustomers),
    });

    render(<WinBackWidget />);

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

    render(<WinBackWidget />);

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

    render(<WinBackWidget />);

    await waitFor(() => {
      const buttons = screen.getAllByText('Send Win-Back');
      expect(buttons.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('opens Telegram link with correct URL-encoded text', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([mockCustomers[0]]),
    });

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<WinBackWidget />);

    await waitFor(() => {
      expect(screen.getAllByText('Abebe Bikila').length).toBeGreaterThan(0);
    });

    const sendBtns = screen.getAllByText('Send Win-Back');
    fireEvent.click(sendBtns[0]);

    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toContain('https://t.me/share/url');
    expect(url).toContain('https://test-salon.egebeya.et');
    expect(url).toContain(encodeURIComponent('Hi Abebe Bikila, we miss you at Test Salon! Use code WIN10 for 10% off your next visit.'));

    openSpy.mockRestore();
  });

  it('marks customer as Sent after clicking Send Win-Back', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([mockCustomers[0]]),
    });

    vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<WinBackWidget />);

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

    render(<WinBackWidget />);

    await waitFor(() => {
      expect(screen.getAllByText('Could not load inactive customers').length).toBeGreaterThan(0);
    });
  });

  it('shows empty state when no inactive customers', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<WinBackWidget />);

    await waitFor(() => {
      expect(screen.getAllByText(/No inactive customers/).length).toBeGreaterThan(0);
    });
  });
});
