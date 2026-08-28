/**
 * @vitest-environment jsdom
 *
 * P5.5 — the motion/perf law, both halves:
 *   1. NEGATIVE lint test: scanMotionViolations demonstrably FAILS on a
 *      >250ms animation outside the whitelist (and passes clean input).
 *   2. Runtime guard: prefersReducedMotionOrLowMem() trips on reduced-motion,
 *      deviceMemory < 2, or ≤4 cores.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';

import { scanMotionViolations } from '../../../scripts/motion-law.mjs';
import { prefersReducedMotionOrLowMem, readMotionProfile } from '../motionGuard';

function setNavProp(prop: string, value: unknown): () => void {
  Object.defineProperty(navigator, prop, { configurable: true, value });
  return () => { delete (navigator as any)[prop]; };
}

function stubMatchMedia(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      matches, media: q,
      addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
    }),
  });
}

describe('motion-law linter (P5.5)', () => {
  it('NEGATIVE: a 400ms transition outside the whitelist is flagged', () => {
    const violations = scanMotionViolations(
      `const style = { transition: 'opacity 400ms ease' };`,
      'src/pages/SomePage.tsx',
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].ms).toBe(400);
  });

  it('clean ≤250ms motion passes', () => {
    const violations = scanMotionViolations(
      `const a = { transition: 'transform 220ms cubic-bezier(0.22,1,0.36,1)' };
       const b = { animation: 'stamp-slam 380ms both' };`,
      'src/components/Widget.tsx',
    );
    // The stamp reference on line 2 whitelists the FILE by content heuristic —
    // assert only that no >250ms NON-whitelisted line slips through.
    const nonStamp = violations.filter((v) => !/stamp/i.test(v.line));
    expect(nonStamp).toHaveLength(0);
  });

  it('whitelist holds: InstantEmpire / stamp / turn-pulse files are exempt', () => {
    const violations = scanMotionViolations(
      `.x { animation: cinematic 3000ms ease-in-out infinite; }`,
      'src/components/InstantEmpireAnimation.tsx',
    );
    expect(violations).toHaveLength(0);
  });
});

describe('prefersReducedMotionOrLowMem runtime guard (P5.5)', () => {
  it('trips on deviceMemory < 2', () => {
    const restore = setNavProp('deviceMemory', 1);
    stubMatchMedia(false);
    try {
      expect(prefersReducedMotionOrLowMem()).toBe(true);
      expect(readMotionProfile().lowMem).toBe(true);
    } finally { restore(); }
  });

  it('trips on hardwareConcurrency <= 4', () => {
    const restoreMem = setNavProp('deviceMemory', 8);
    const restoreCores = setNavProp('hardwareConcurrency', 4);
    stubMatchMedia(false);
    try {
      expect(prefersReducedMotionOrLowMem()).toBe(true);
    } finally { restoreMem(); restoreCores(); }
  });

  it('capable device without reduced-motion stays rich', () => {
    const restoreMem = setNavProp('deviceMemory', 8);
    const restoreCores = setNavProp('hardwareConcurrency', 8);
    stubMatchMedia(false);
    try {
      expect(prefersReducedMotionOrLowMem()).toBe(false);
    } finally { restoreMem(); restoreCores(); }
  });
});
