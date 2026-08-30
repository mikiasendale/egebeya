/**
 * ReceiptTicket (P4.4) — the booking confirmation as a stamped till slip.
 *
 * Craft contract:
 *  - Cream card, ink border, receipt-rule-top; 2px corners everywhere.
 *  - ONE authored moment: the green "✓ ተመዝግቧል" stamp pressing in
 *    (.receipt-stamp-in — opacity/transform, ≤250ms per the motion law).
 *  - Dual calendar: Ge'ez date primary (Amharic months), Gregorian subtitle.
 *  - Same-day bookings print their live queue position in a take-a-number
 *    square (Mono-For-Data rule) with a link to /q/:token.
 *  - Haptic on mount where Vibration API exists — the stamp lands in the hand.
 *  - THE single CTA: "ማስታወሻ በ Telegram" deep link (P3.2). Everything else
 *    is quiet text links below the fold of attention.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { gregorianToEthiopian, ETHIOPIAN_MONTHS_AM } from '../lib/ethiopianCalendar';

export interface ReceiptTicketProps {
  confirmed: boolean;
  heading: string;
  sub: string;
  /** Booking date — drives the dual calendar. */
  bookingDate: Date | null;
  timeLabel: string;
  addisLabel: string;
  receiptText: string;
  paymentStatus?: string | null;
  /** Same-day queue snapshot from the booking response. */
  queueInfo?: { position: number | null; etaMinutes: number } | null;
  telegramDeepLink?: string | null;
  bookingId?: string | null;
}

export function ReceiptTicket({
  confirmed,
  heading,
  sub,
  bookingDate,
  timeLabel,
  addisLabel,
  receiptText,
  paymentStatus,
  queueInfo,
  telegramDeepLink,
  bookingId,
}: ReceiptTicketProps) {
  const { t } = useTranslation();

  // Haptic: fire once when the ticket prints. Unsupported browsers ignore it.
  React.useEffect(() => {
    try { navigator.vibrate?.([18, 40, 26]); } catch { /* silent */ }
  }, []);

  const day = bookingDate ?? new Date();
  const eth = gregorianToEthiopian(day);
  const gregorianLabel = `${day.getDate()}/${day.getMonth() + 1}/${day.getFullYear()}`;

  return (
    <div
      className="receipt-rule-top"
      style={{
        backgroundColor: 'var(--color-paper-bleached)',
        border: '1px solid var(--color-ink-rule)',
        borderRadius: 'var(--rd-card)',
      }}
      data-testid="receipt-ticket"
    >
      <div className="p-6 sm:p-8">
        {confirmed && (
          <div className="flex justify-end -mt-1 mb-1">
            <span
              className="receipt-stamp-in stamp positive"
              style={{ fontSize: '0.95rem', color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
              data-testid="receipt-stamp"
            >
              ✓ {t('booking.stampConfirmed')}
            </span>
          </div>
        )}

        <div className="pt-2 pb-3 border-b border-[var(--color-ink-rule)]">
          <div className="uppercase text-xs" style={{ fontFamily: 'var(--font-receipt)', letterSpacing: '0.08em', color: 'var(--color-telebirr-deep)' }}>
            {t('booking.receipt')}
          </div>
          <div className="mt-2" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '2rem', color: 'var(--color-ink)' }}>
            {heading}
          </div>

          <div className="mt-2" data-testid="receipt-dual-date">
            <span style={{ fontFamily: 'var(--font-serif-ethiopic)', fontWeight: 700, fontSize: '0.98rem', color: 'var(--color-ink)', lineHeight: 1.65 }}>
              {eth.day} {ETHIOPIAN_MONTHS_AM[eth.month - 1] ?? ''} {eth.year} ዓ.ም
            </span>
            <span className="ml-2 text-xs text-ink-soft" style={{ fontFamily: 'var(--font-receipt)' }}>
              {gregorianLabel} · {timeLabel} {addisLabel}
            </span>
          </div>

          {queueInfo && (
            <div className="mt-4 flex items-center gap-3" data-testid="receipt-queue">
              <span
                className="take-a-number shrink-0"
                style={{ width: '2.25rem', height: '2.25rem', fontSize: '1rem' }}
                aria-label={t('queue.positionLabel', { position: queueInfo.position ?? '—' })}
              >
                {queueInfo.position ?? '—'}
              </span>
              <div>
                <div className="text-xs uppercase tracking-[0.08em] text-ink-soft" style={{ fontFamily: 'var(--font-receipt)' }}>
                  {t('queueStatus.yourTicket')}
                </div>
                <div className="text-sm" style={{ fontFamily: 'var(--font-receipt)', color: 'var(--color-ink)' }}>
                  {queueInfo.etaMinutes > 0 ? `~${queueInfo.etaMinutes} ${t('queue.minUnit')}` : t('queueStatus.almostThere')}
                  {' · '}
                  {bookingId && (
                    <a href={`/q/${bookingId}`} className="underline underline-offset-2" style={{ color: 'var(--color-link)' }} data-testid="receipt-track-link">
                      {t('queueStatus.trackLink')}
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          <pre className="receipt-print-in mt-4 whitespace-pre-wrap" style={{ fontFamily: 'var(--font-receipt)', margin: 0 }}>
            {receiptText}
          </pre>
        </div>

        <p className="mt-4 text-base" style={{ color: 'var(--color-ink-soft)' }}>{sub}</p>
        {paymentStatus && (
          <div className="mt-3 text-xs" style={{ fontFamily: 'var(--font-receipt)', color: 'var(--color-ink-soft)', letterSpacing: '0.08em' }}>
            {t('booking.payment')}: <span style={{ color: 'var(--color-ink)' }}>{paymentStatus}</span>
          </div>
        )}

        {confirmed && telegramDeepLink && (
          <a
            href={telegramDeepLink}
            target="_blank"
            rel="noreferrer"
            data-testid="receipt-telegram-cta"
            onClick={() => { try { navigator.vibrate?.(18); } catch { /* silent */ } }}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-4 font-bold transition-opacity duration-200 hover:opacity-90 rounded-rd"
            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-paper-bleached)', fontFamily: 'var(--font-display)', borderRadius: 'var(--rd-card)' }}
          >
            {t('receipt.telegramCta')}
          </a>
        )}
        <div className="mt-4 flex items-center gap-4">
          {/* F2: the track link lives ONLY next to the same-day take-a-number
              chip above (queueInfo-gated) — a future-dated booking has no live
              queue, so no broken /q/ link. */}
          <button
            onClick={() => { window.location.href = '/'; }}
            className="text-xs text-ink-soft underline underline-offset-2"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
            data-testid="receipt-home-link"
          >
            {t('booking.backToDirectory')}
          </button>
        </div>
      </div>
    </div>
  );
}
