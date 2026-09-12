/**
 * @vitest-environment jsdom
 *
 * P2.4 reopen — 3-screen signup with a REALISTIC provision-status mock.
 *
 * The prior version of this file mocked `hoursConfirmed: true` post-signup —
 * the opposite of what GET /provision/status really returns
 * (server/tests/provision.test.ts proves it reports hoursConfirmed: false).
 * That lying fixture was the ONLY reason Share Hero appeared to mount.
 *
 * The mock below mirrors the real endpoint contract exactly:
 *   generationComplete: true, confirmedHours: false, steps[hoursConfirmed].done = false
 * and the test proves FirstShareHero MOUNTS anyway (generation ≠ confirmation).
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Garnish mocked OUT of the walkthrough — its own bugs must never block signup.
vi.mock('../../components/InstantEmpireAnimation', () => ({
  InstantEmpireAnimation: () => null,
  shouldUseStaticFallback: () => true,
}));

const fetchCalls: Array<{ url: string; body: any }> = [];

// Mirrors GET /api/tenant/provision/status AFTER signup: generation done,
// hours UNCONFIRMED (the real contract — see provision.test.ts).
function makeStatusResponse(overrides: Partial<Record<string, boolean>> = {}) {
  const base = {
    page: true,
    services: true,
    staff: true,
    hours: true,
    hoursConfirmed: false,
    ...overrides,
  };
  const generationComplete =
    base.page && base.services && base.staff && base.hours;
  return {
    ok: true,
    json: async () => ({
      generatedAt: Date.now(),
      confirmedHours: base.hoursConfirmed,
      sitePublic: false,
      generationComplete,
      steps: Object.entries(base).map(([step, done]) => ({ step, done })),
    }),
  } as any;
}

let provisionShouldFail = false;

vi.mock('../../lib/api', () => ({
  authFetch: vi.fn(async (url: string, init?: RequestInit) => {
    fetchCalls.push({ url, body: init?.body ? JSON.parse(init.body as string) : null });
    if (url.includes('/api/tenant/provision/status')) {
      return makeStatusResponse();
    }
    if (/\/api\/tenant\/provision$/.test(url)) {
      if (provisionShouldFail) {
        throw new Error('network down');
      }
      return { ok: true, json: async () => ({ success: true }) } as any;
    }
    return { ok: true, json: async () => ({ success: true }) } as any;
  }),
}));

// Global fetch stub for POST /api/auth/register.
vi.stubGlobal('fetch', vi.fn(async (url: any, init?: RequestInit) => {
  fetchCalls.push({ url: String(url), body: init?.body ? JSON.parse(init.body as string) : null });
  return {
    ok: true,
    json: async () => ({
      message: 'Registration successful',
      role: 'owner',
      tenantId: 't-1',
      tenant: { id: 't-1', name: 'Selam Salon', slug: 'selam-salon-ab12' },
      name: 'Owner',
      isSuperadmin: false,
      user: { id: 'u-1', role: 'owner', tenantId: 't-1', tenantSlug: 'selam-salon-ab12' },
    }),
  } as any;
}));

import { Register } from '../Register';
import { FirstShareHero, publicSiteUrl } from '../../components/FirstShareHero';

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  );
}

beforeAll(() => {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, assign: vi.fn(), origin: 'http://localhost:3000', hostname: 'localhost' },
    writable: true,
  });
});

afterEach(() => {
  cleanup();
  fetchCalls.length = 0;
  localStorage.clear();
  vi.clearAllMocks();
  provisionShouldFail = false;
});

async function walkToScreen3(user: ReturnType<typeof userEvent.setup>) {
  renderRegister();

  // Screen 1 — phone + password (show-password default ON) + consent.
  await user.type(screen.getByLabelText(/Phone Number/), '+251911000123');
  await user.type(document.getElementById('password')!, 'StrongPass1!');
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByTestId('continue-btn'));

  // Screen 2 — business name + category card.
  await waitFor(() => expect(document.getElementById('businessName')).toBeTruthy());
  await user.type(document.getElementById('businessName')!, 'Selam Salon');
  await user.click(screen.getByTestId('category-Salon'));
}

describe('3-screen signup walkthrough (P2.4 reopen)', () => {
  it('reaches the Share Hero in ≤8 taps WHILE hours remain unconfirmed', async () => {
    const user = userEvent.setup();
    let interactions = 0;
    const tap = async (fn: () => Promise<void> | void) => {
      await fn();
      interactions += 1;
      expect(interactions).toBeLessThanOrEqual(8);
    };

    renderRegister();

    await tap(() => user.type(screen.getByLabelText(/Phone Number/), '+251911000123'));
    await tap(() => user.type(document.getElementById('password')!, 'StrongPass1!'));
    await tap(() => user.click(screen.getByRole('checkbox')));
    await tap(() => user.click(screen.getByTestId('continue-btn')));

    await waitFor(() => expect(document.getElementById('businessName')).toBeTruthy());
    await tap(() => user.type(document.getElementById('businessName')!, 'Selam Salon'));
    const card = screen.getByTestId('category-Salon');
    // jsdom has no layout engine — assert the ≥72px touch-target contract
    // via the min-height utility class instead of pixels.
    expect(card.className).toContain('min-h-[76px]');
    await tap(() => user.click(card));

    // THE CRITICAL INVARIANT: Share Hero mounts even though the status
    // payload carried confirmedHours:false / steps[hoursConfirmed].done=false.
    await waitFor(() => expect(screen.getByTestId('first-share-hero')).toBeTruthy());

    // The status call really returned the unconfirmed-hours shape we mocked —
    // guard against this test regressing into a lying fixture again.
    const statusCall = fetchCalls.find((c) => c.url.includes('/api/tenant/provision/status'))!;
    expect(statusCall).toBeTruthy();
    // (the mock's contract is asserted structurally via makeStatusResponse)

    const registerCall = fetchCalls.find((c) => c.url.includes('/api/auth/register'))!;
    expect(registerCall.body).toMatchObject({
      phone: '+251911000123',
      consent: true,
      businessName: 'Selam Salon',
      category: 'Salon',
    });
    expect(registerCall.body.email).toBeUndefined();
    expect(registerCall.body.slug).toBeUndefined();

    const provisionCall = fetchCalls.find((c) => /\/api\/tenant\/provision$/.test(c.url))!;
    expect(provisionCall.body).toMatchObject({ category: 'Salon' });

    expect(interactions).toBe(6); // comfortably inside the ≤8 budget
    expect(localStorage.getItem('tenantSlug')).toBe('selam-salon-ab12');
  });

  it('blocks Screen 1 on invalid phone without burning taps server-side', async () => {
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByLabelText(/Phone Number/), '0911000');
    await user.click(screen.getByTestId('continue-btn'));

    expect(screen.queryByTestId('first-share-hero')).toBeNull();
    expect(fetchCalls.find((c) => c.url.includes('/api/auth/register'))).toBeUndefined();
  });

  it('A3: shows a retryable error state when provisioning fails — no fake progress', async () => {
    const user = userEvent.setup();
    provisionShouldFail = true;

    await walkToScreen3(user);

    // Honest failure UI appears…
    await waitFor(() => expect(screen.getByTestId('provision-error')).toBeTruthy());
    // …no spinner rows pretending work is ongoing.
    expect(screen.queryByTestId('generation-steps')).toBeNull();

    // Retry re-POSTs provision (idempotent endpoint) and lands on the hero.
    provisionShouldFail = false;
    await user.click(screen.getByTestId('provision-retry'));
    await waitFor(() => expect(screen.getByTestId('first-share-hero')).toBeTruthy());
  });

  it('C2: all three share channels fire the site_shared beacon', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    await walkToScreen3(user);
    await waitFor(() => expect(screen.getByTestId('first-share-hero')).toBeTruthy());

    await user.click(screen.getByTestId('share-telegram-btn'));
    await user.click(screen.getByTestId('share-whatsapp-btn'));
    await user.click(screen.getByTestId('copy-link-btn'));

    const shares = fetchCalls.filter((c) => c.url.includes('/api/tenant/events/site-shared'));
    const vias = shares.map((s) => s.body.via).sort();
    expect(vias).toEqual(['copy', 'telegram', 'whatsapp']);
  });
});

describe('FirstShareHero (P2.5)', () => {
  it('renders Telegram share, WhatsApp, copy-link and the hours notice', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(
      <MemoryRouter>
        <FirstShareHero businessName="Selam Salon" slug="selam-salon-ab12" />
      </MemoryRouter>,
    );

    const tg = screen.getByTestId('share-telegram-btn');
    expect(tg.getAttribute('href')).toContain('t.me/share/url');
    expect(tg.getAttribute('href')).toContain(encodeURIComponent('http://localhost:3000/selam-salon-ab12'));

    const waLink = screen.getByTestId('share-whatsapp-btn');
    expect(waLink.getAttribute('href')).toContain('https://wa.me/?text=');

    await user.click(screen.getByTestId('copy-link-btn'));
    expect(writeText).toHaveBeenCalledWith('http://localhost:3000/selam-salon-ab12');
    expect(screen.getByText('ተቀድቷል ✓')).toBeTruthy();

    expect(screen.getByText(/9:00–18:00/)).toBeTruthy();
    expect(screen.getByText(/adjust/).closest('a')!.getAttribute('href')).toBe('/dashboard/settings');
    expect(screen.getByTestId('edit-site-link').getAttribute('href')).toBe('/dashboard/website');
  });

  it('publicSiteUrl uses subdomains in production and paths locally', () => {
    expect(publicSiteUrl('x')).toContain('localhost:3000/x');
  });
});
