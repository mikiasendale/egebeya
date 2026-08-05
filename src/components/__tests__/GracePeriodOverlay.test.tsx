// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const map: Record<string, string> = {
        'grace.title': 'Your Pro Access expires soon',
        'grace.message': "Don't lose your custom site and AI tools.",
        'grace.renew': 'Renew via Chapa',
      };
      return map[key] || fallback || key;
    },
  }),
}));

import { GracePeriodOverlay } from '../GracePeriodOverlay';

function renderOverlay(status: string | null) {
  return render(
    <MemoryRouter>
      <div className="relative" style={{ position: 'relative', width: '400px', height: '400px' }}>
        <GracePeriodOverlay subscriptionStatus={status} />
      </div>
    </MemoryRouter>,
  );
}

describe('GracePeriodOverlay', () => {
  it('renders nothing when status is not grace', () => {
    renderOverlay('active');
    expect(screen.queryByText('Your Pro Access expires soon')).not.toBeInTheDocument();
  });

  it('renders nothing when status is null', () => {
    renderOverlay(null);
    expect(screen.queryByText('Your Pro Access expires soon')).not.toBeInTheDocument();
  });

  it('renders overlay when status is grace', () => {
    renderOverlay('grace');
    expect(screen.getByText('Your Pro Access expires soon')).toBeInTheDocument();
  });

  it('shows the message about losing access', () => {
    renderOverlay('grace');
    expect(screen.getAllByText("Don't lose your custom site and AI tools.").length).toBeGreaterThanOrEqual(1);
  });

  it('contains a link to billing page', () => {
    renderOverlay('grace');
    const links = screen.getAllByRole('link', { name: /Renew via Chapa/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0]).toHaveAttribute('href', '/dashboard/billing');
  });

  it('has backdrop blur styling', () => {
    renderOverlay('grace');
    const allDivs = document.querySelectorAll('[style*="backdrop-filter"]');
    expect(allDivs.length).toBeGreaterThanOrEqual(1);
  });
});
