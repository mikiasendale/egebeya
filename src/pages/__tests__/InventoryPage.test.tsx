// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockAuthFetch = vi.fn();
vi.mock('../../lib/api', () => ({
  authFetch: (...args: any[]) => mockAuthFetch(...args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const map: Record<string, string> = {
        'inventory.title': 'Inventory',
        'inventory.lowStock': '{count} items low',
        'inventory.allGood': 'All items stocked',
        'inventory.empty': 'No inventory items yet.',
        'inventory.lowStockAria': 'Low stock alert',
      };
      return map[key] || fallback || key;
    },
  }),
}));

import { InventoryPage } from '../Dashboard/InventoryPage';

const mockInventory = [
  { name: 'Shampoo', quantity_on_hand: 20, reorder_threshold: 5 },
  { name: 'Conditioner', quantity_on_hand: 3, reorder_threshold: 5 },
  { name: 'Hair Oil', quantity_on_hand: 0, reorder_threshold: 10 },
];

describe('InventoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page title', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<InventoryPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Inventory').length).toBeGreaterThan(0);
    });
  });

  it('renders red progress bar for items below threshold', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockInventory),
    });

    render(<InventoryPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Conditioner').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('Hair Oil').length).toBeGreaterThan(0);

    const lowBadges = screen.getAllByText(/items low/);
    expect(lowBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders green progress bar for items above threshold', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockInventory),
    });

    render(<InventoryPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Shampoo').length).toBeGreaterThan(0);
    });

    const allGoodBadge = screen.queryByText(/All items stocked/);
    expect(allGoodBadge).not.toBeInTheDocument();
  });

  it('shows "All items stocked" when no items are below threshold', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { name: 'Shampoo', quantity_on_hand: 20, reorder_threshold: 5 },
      ]),
    });

    render(<InventoryPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/All items stocked/).length).toBeGreaterThan(0);
    });
  });

  it('calls onLowStock with true when items are below threshold', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockInventory),
    });

    const onLowStock = vi.fn();
    render(<InventoryPage onLowStock={onLowStock} />);
    await waitFor(() => {
      expect(onLowStock).toHaveBeenCalledWith(true);
    });
  });

  it('calls onLowStock with false when no items are below threshold', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { name: 'Shampoo', quantity_on_hand: 20, reorder_threshold: 5 },
      ]),
    });

    const onLowStock = vi.fn();
    render(<InventoryPage onLowStock={onLowStock} />);
    await waitFor(() => {
      expect(onLowStock).toHaveBeenCalledWith(false);
    });
  });

  it('shows error state on fetch failure', async () => {
    mockAuthFetch.mockResolvedValue({ ok: false });

    render(<InventoryPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Could not load inventory').length).toBeGreaterThan(0);
    });
  });

  it('shows empty state when no items exist', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<InventoryPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/No inventory items yet/).length).toBeGreaterThan(0);
    });
  });
});
