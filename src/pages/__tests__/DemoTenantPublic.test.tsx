/**
 * @vitest-environment jsdom
 *
 * P2.5 reopen (C3d) — the demo tenant's public site renders CLEAN:
 * no owner-only chrome anywhere on a public render — no DARK banner,
 * no empire checklist, no staff controls, no dashboard shell markers.
 * The dashboard gate components are dashboard-shell-only; this test pins
 * that contract at the public surface so a future refactor can't leak
 * owner UI onto tenant sites (demo or otherwise).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Puck Render is browser-heavy — stub to a passive block; the unit under
// test is the page's chrome surface, not Puck itself.
vi.mock('@measured/puck', () => ({
  // eslint-disable-next-line react/display-name
  Render: ({ data }: any) => <div data-testid="puck-render">{data?.content?.length ?? 0} blocks</div>,
}));
vi.mock('../../lib/puck.config', () => ({ config: {} }));

const DEMO_TENANT_SLUG = 'demo';

const demoPagePayload = {
  tenant: {
    id: 'demo-id',
    name: 'ብርሃን ሳሎን · Berhan Salon',
    slug: DEMO_TENANT_SLUG,
    category: 'Salon',
    settings: { onboarding: { confirmedHours: true }, onboarding_completed: true },
  },
  page: {
    content: {
      content: [
        { type: 'Hero', props: { title: 'Berhan Salon', backgroundImage: null }, data: {} },
        { type: 'services', props: {}, data: {} },
      ],
    },
  },
};

const fetchMock = vi.fn(async (url: any) => {
  if (String(url).includes('/api/public/page')) {
    return { ok: true, json: async () => demoPagePayload } as any;
  }
  return { ok: true, json: async () => ({}) } as any;
});
vi.stubGlobal('fetch', fetchMock);

import { PublicTenantSite } from '../PublicTenantSite';

beforeEach(() => {
  fetchMock.mockClear();
});

afterEach(cleanup);

describe('demo tenant public render is chrome-free (P2.5 C3)', () => {
  it('renders the site content and zero owner-only chrome', async () => {
    localStorage.setItem('role', 'owner'); // worst case: the OWNER visits the demo URL
    render(
      <MemoryRouter>
        <PublicTenantSite hostname={`${DEMO_TENANT_SLUG}.egebeya.et`} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('puck-render')).toBeTruthy());
    expect(screen.getByTestId('puck-render').textContent).toContain('2 blocks');

    // Owner-only chrome must be absent from the public surface entirely.
    expect(screen.queryByTestId('setup-banner')).toBeNull();
    expect(screen.queryByTestId('dark-stamp')).toBeNull();
    expect(screen.queryByTestId('empire-checklist')).toBeNull();
    expect(screen.queryByTestId('dashboard-root')).toBeNull();
    // No staff-management controls leak onto public pages.
    const html = document.body.innerHTML;
    expect(html).not.toContain('Staff');
    void screen;
  });

  it('requests the page under the demo subdomain slug', async () => {
    // Re-render and inspect the request headers directly.
    render(
      <MemoryRouter>
        <PublicTenantSite hostname={`${DEMO_TENANT_SLUG}.egebeya.et`} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as any[];
    expect(init?.headers?.['X-Tenant-Slug']).toBe(DEMO_TENANT_SLUG);
  });
});
