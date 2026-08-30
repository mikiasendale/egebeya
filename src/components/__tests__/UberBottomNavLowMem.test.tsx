/**
 * @vitest-environment jsdom
 *
 * P5.5 acceptance: UberBottomNav's glass blur is DISABLED on a low-mem
 * profile (jsdom-simulated) and replaced by solid paper.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

import '../../i18n';

function setNavProp(prop: string, value: unknown): () => void {
  Object.defineProperty(navigator, prop, { configurable: true, value });
  return () => { delete (navigator as any)[prop]; };
}
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }),
});

import { UberBottomNav } from '../UberBottomNav';

afterEach(cleanup);

describe('UberBottomNav low-mem profile (P5.5)', () => {
  it('low deviceMemory → NO backdrop-filter; solid paper instead', () => {
    const restore = setNavProp('deviceMemory', 1);
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <UberBottomNav role="owner" />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Primary' }) as HTMLElement;
    const style = nav.getAttribute('style') ?? '';
    expect(style).not.toContain('backdrop-filter');
    expect(style).toContain('rgba(247, 241, 227');
    restore();
  });

  it('capable device keeps the glass treatment', () => {
    const restore = setNavProp('deviceMemory', 8);
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 8 });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <UberBottomNav role="owner" />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Primary' }) as HTMLElement;
    expect(nav.getAttribute('style')).toContain('blur(12px)');
    restore();
  });
});
