/**
 * @vitest-environment jsdom
 *
 * P2.4 reopen — the InstantEmpireAnimation contract that had NO test:
 *
 *   1. GARNISH, never a gate: the skip affordance appears after 800ms
 *      (SKIP_AVAILABLE_AFTER_MS) and clicking it fires onComplete.
 *   2. Static fallback engages when navigator.deviceMemory < 2 OR
 *      hardwareConcurrency <= 4 — no skip button, honest ~400ms pause,
 *      then onComplete.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import React from 'react';

import {
  InstantEmpireAnimation,
  shouldUseStaticFallback,
} from '../../components/InstantEmpireAnimation';

function stubMatchMedia(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      onchange: null,
      dispatchEvent: () => false,
    }),
  });
}

function setNavProp(prop: string, value: unknown): () => void {
  const original = Object.getOwnPropertyDescriptor(Navigator.prototype, prop)
    ?? Object.getOwnPropertyDescriptor(navigator, prop);
  Object.defineProperty(navigator, prop, { configurable: true, value });
  return () => {
    if (original) Object.defineProperty(navigator, prop, original);
    else delete (navigator as any)[prop];
  };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('InstantEmpireAnimation contract (P2.4)', () => {
  it('predicate: capable device → animation mode', () => {
    const restoreMem = setNavProp('deviceMemory', 8);
    const restoreCores = setNavProp('hardwareConcurrency', 8);
    stubMatchMedia(false);
    try {
      expect(shouldUseStaticFallback()).toBe(false);
    } finally {
      restoreMem();
      restoreCores();
    }
  });

  it('predicate: deviceMemory < 2 engages the static fallback', () => {
    const restoreMem = setNavProp('deviceMemory', 1);
    const restoreCores = setNavProp('hardwareConcurrency', 8);
    stubMatchMedia(false);
    try {
      expect(shouldUseStaticFallback()).toBe(true);
    } finally {
      restoreMem();
      restoreCores();
    }
  });

  it('predicate: hardwareConcurrency <= 4 engages the static fallback', () => {
    const restoreMem = setNavProp('deviceMemory', 8);
    const restoreCores = setNavProp('hardwareConcurrency', 4);
    stubMatchMedia(false);
    try {
      expect(shouldUseStaticFallback()).toBe(true);
    } finally {
      restoreMem();
      restoreCores();
    }
  });

  it('skip affordance appears after 800ms and completes on tap', async () => {
    vi.useFakeTimers();
    const restoreMem = setNavProp('deviceMemory', 8);
    const restoreCores = setNavProp('hardwareConcurrency', 8);
    stubMatchMedia(false);

    const onComplete = vi.fn();
    render(<InstantEmpireAnimation businessName="Selam" onComplete={onComplete} />);

    // Not skippable before 800ms…
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.queryByTestId('empire-skip-btn')).toBeNull();

    // …skippable at/after 800ms.
    act(() => { vi.advanceTimersByTime(400); }); // total 900ms
    const skip = screen.getByTestId('empire-skip-btn');
    expect(onComplete).not.toHaveBeenCalled();

    // Tapping the garnish dismisses it immediately — it never gates progress.
    act(() => { skip.click(); });
    expect(onComplete).toHaveBeenCalledTimes(1);

    restoreMem();
    restoreCores();
  });

  it('static fallback: completes honestly (~400ms) with no skip affordance', () => {
    vi.useFakeTimers();
    const restoreMem = setNavProp('deviceMemory', 1); // low-mem device
    const restoreCores = setNavProp('hardwareConcurrency', 2);

    const onComplete = vi.fn();
    render(<InstantEmpireAnimation businessName="Selam" onComplete={onComplete} />);

    // No skip button exists in static mode — nothing to animate past.
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.queryByTestId('empire-skip-btn')).toBeNull();

    // Static card finishes after its brief honest pause.
    expect(onComplete).toHaveBeenCalledTimes(1);

    restoreMem();
    restoreCores();
  });
});
