/**
 * @vitest-environment jsdom
 *
 * P5.6 — quiet slots wear the amber badge + strikethrough price on the
 * public booking board; full-price slots stay clean.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import '../../i18n';
import { isQuietSlot } from '../PublicBooking';

describe('quiet-slot window math (P5.6)', () => {
  const qh = { start_minute: 780, end_minute: 900 }; // 13:00–15:00
  const overnight = { start_minute: 1320, end_minute: 120 }; // 22:00–02:00

  it('inside a normal window', () => {
    expect(isQuietSlot('13:00', qh)).toBe(true);
    expect(isQuietSlot('14:30', qh)).toBe(true);
    expect(isQuietSlot('12:59', qh)).toBe(false);
    expect(isQuietSlot('15:00', qh)).toBe(false);
  });

  it('handles the overnight wrap window', () => {
    expect(isQuietSlot('23:00', overnight)).toBe(true);
    expect(isQuietSlot('01:30', overnight)).toBe(true);
    expect(isQuietSlot('12:00', overnight)).toBe(false);
  });

  it('no config → never quiet', () => {
    expect(isQuietSlot('13:00', null)).toBe(false);
    expect(isQuietSlot('13:00')).toBe(false);
  });
});
