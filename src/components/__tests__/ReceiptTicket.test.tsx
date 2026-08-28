/**
 * @vitest-environment jsdom
 *
 * P4.4 — Stamped receipt ticket: the confirmation as a till slip.
 *
 *   - Green stamp "✓ ተመዝግቧል" present, animated by .receipt-stamp-in
 *     (opacity/transform, ≤250ms per the motion law).
 *   - Dual calendar: Ge'ez primary (Amharic month), Gregorian subtitle.
 *   - Same-day queue position in a take-a-number square + /q/ link.
 *   - Haptic fires where Vibration API exists.
 *   - THE single primary CTA is the Telegram deep link; everything else is
 *     quiet text links — no second button competing with it.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';

import '../../i18n';
import { ReceiptTicket } from '../ReceiptTicket';

const vibrateSpy = vi.fn();
beforeAll(() => {
  Object.defineProperty(navigator, 'vibrate', {
    configurable: true,
    writable: true,
    value: vibrateSpy,
  });
});

function baseProps(over: Partial<any> = {}) {
  return {
    confirmed: true,
    heading: 'Booking Confirmed',
    sub: 'See you soon.',
    bookingDate: new Date(2026, 7, 26), // Aug 26 2026 → Ethiot ነሐሴ 20, 2018
    timeLabel: '09:30',
    addisLabel: 'Addis',
    receiptText: '✅ Registered\nBusiness: Queue Barber\n…',
    ...over,
  };
}

afterEach(cleanup);

describe('ReceiptTicket (P4.4)', () => {
  it('stamps ✓ ተመዝግቧል inside the ≤250ms motion budget', async () => {
    render(<ReceiptTicket {...baseProps()} />);
    const stamp = screen.getByTestId('receipt-stamp');
    expect(stamp.textContent).toContain('ተመዝግቧል');
    // The animation class is the ≤250ms variant, not the 380ms banner slam.
    expect(stamp.className).toContain('receipt-stamp-in');
    expect(stamp.className).not.toContain('stamp-slam-in');
    // And the stylesheet really pins it at 220ms (motion-law proof, from source).
    const fs = await import('fs');
    const css = fs.readFileSync('src/index.css', 'utf8');
    expect(css).toMatch(/\.receipt-stamp-in\s*{[^}]*220ms/);
  });

  it('prints dual dates — Ge\'ez primary with Amharic month, Gregorian subtitle', () => {
    render(<ReceiptTicket {...baseProps()} />);
    const dual = screen.getByTestId('receipt-dual-date').textContent!;
    expect(dual).toContain('ነሐሴ');       // Amharic month for late August
    expect(dual).toContain('ዓ.ም');        // Ge'ez era marker
    expect(dual).toContain('26/8/2026'); // Gregorian subtitle
  });

  it('same-day bookings print their take-a-number position and /q link', () => {
    render(<ReceiptTicket {...baseProps({ queueInfo: { position: 3, etaMinutes: 45 }, bookingId: 'opaque123' })} />);
    const q = screen.getByTestId('receipt-queue');
    expect(q.querySelector('.take-a-number')?.textContent).toBe('3');
    expect(screen.getByTestId('receipt-track-link').getAttribute('href')).toBe('/q/opaque123');
  });

  it('no queue chip when the booking is not same-day', () => {
    render(<ReceiptTicket {...baseProps({ queueInfo: null, bookingId: 'future123' })} />);
    expect(screen.queryByTestId('receipt-queue')).toBeNull();
    // F2: a future-dated booking gets NO broken track link.
    expect(screen.queryByTestId('receipt-track-link')).toBeNull();
    expect(screen.queryAllByText(/Track your spot|ተራዎን ይከታተሉ/)).toHaveLength(0);
  });

  it('F2: same-day bookings keep exactly one track link, next to the queue chip', () => {
    render(<ReceiptTicket {...baseProps({ queueInfo: { position: 2, etaMinutes: 30 }, bookingId: 'sameday1' })} />);
    // The card-level link exists and points at the live board.
    expect(screen.getByTestId('receipt-track-link').getAttribute('href')).toBe('/q/sameday1');
    // And only ONE exists (the old duplicate bottom link is gone).
    expect(screen.queryAllByTestId('receipt-track-link')).toHaveLength(1);
  });

  it('fires haptics on mount and again on CTA tap', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    render(<ReceiptTicket {...baseProps({ telegramDeepLink: 'https://t.me/egebeya_test_bot?start=abc', bookingId: 'opq' })} />);
    expect(vibrateSpy).toHaveBeenCalledWith([18, 40, 26]); // stamp lands in the hand

    const cta = screen.getByTestId('receipt-telegram-cta');
    expect(cta.getAttribute('href')).toBe('https://t.me/egebeya_test_bot?start=abc');
    vibrateSpy.mockClear();
    await user.click(cta);
    expect(vibrateSpy).toHaveBeenCalledWith(18);
  });

  it('CTA is THE single button; secondary exits are quiet links', () => {
    render(<ReceiptTicket {...baseProps({ telegramDeepLink: 'https://t.me/x?start=abc', bookingId: 'opq' })} />);
    const buttons = document.querySelectorAll('button');
    // Only the quiet home exit remains a <button>; no competing styled buttons.
    expect(buttons.length).toBe(1);
    expect(buttons[0].getAttribute('data-testid')).toBe('receipt-home-link');

    const cta = screen.getByTestId('receipt-telegram-cta');
    expect(cta.tagName).toBe('A');
  });

  it('pending (unpaid) receipts skip stamp and CTA honestly', () => {
    render(<ReceiptTicket {...baseProps({ confirmed: false, telegramDeepLink: 'https://t.me/x' })} />);
    expect(screen.queryByTestId('receipt-stamp')).toBeNull();
    expect(screen.queryByTestId('receipt-telegram-cta')).toBeNull();
  });
});
