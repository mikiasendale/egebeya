/**
 * Motion/perf guard (P5.5) — the runtime half of the motion law.
 *
 * `prefersReducedMotionOrLowMem()` answers one question: should this device
 * get the honest, static version? True when the user prefers reduced motion
 * OR the device is genuinely low-end (deviceMemory < 2 or ≤4 cores). On a
 * true answer, surfaces must swap backdrop-blur for solid paper — blur on a
 * 3G Tecno is jank, not polish.
 *
 * The static half lives in scripts/motion-law.mjs (npm run lint:motion):
 * animation durations >250ms outside the whitelist fail lint.
 */

export interface MotionProfile {
  reducedMotion: boolean;
  lowMem: boolean;
}

export function readMotionProfile(nav: Navigator = navigator): MotionProfile {
  let reducedMotion = false;
  try {
    reducedMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  } catch { /* jsdom without matchMedia */ }

  const anyNav = nav as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
  const mem = typeof anyNav.deviceMemory === 'number' ? anyNav.deviceMemory : 8;
  const cores = typeof anyNav.hardwareConcurrency === 'number' ? anyNav.hardwareConcurrency : 8;
  return { reducedMotion, lowMem: mem < 2 || cores <= 4 };
}

export function prefersReducedMotionOrLowMem(nav: Navigator = navigator): boolean {
  const profile = readMotionProfile(nav);
  return profile.reducedMotion || profile.lowMem;
}

/** The solid-paper background that replaces glass when the guard trips. */
export const SOLID_PAPER_BACKGROUND = 'rgba(247, 241, 227, 0.98)';
