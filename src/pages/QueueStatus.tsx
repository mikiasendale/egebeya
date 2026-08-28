/**
 * QueueStatus (P4.3) — the consumer's take-a-number ticket, alive.
 *
 * Public, no login: /q/:opaqueToken (the booking's opaque id). Exactly three
 * states, rendered LARGE enough to read from across a salon:
 *
 *     #4 · ~25 min   →   #2   →   It's your turn (pulsing green)
 *
 * Craft contract:
 *  - Take-a-number square carries the position in receipt-mono.
 *  - Dual calendar: Ge'ez date primary (Amharic month names), Gregorian
 *    subtitle — Ethiopia-default, not localization garnish.
 *  - Polling every ≤15s AND pauses entirely on hidden tabs; the moment the
 *    tab returns it refreshes once before resuming the rhythm.
 *  - PRIVACY (PRODUCT.md principle 5): initials + service only; this page's
 *    payload never contains customer names.
 *  - Motion law: opacity/transform; the "your turn" pulse is the one
 *    whitelisted looping animation on this surface.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { gregorianToEthiopian, ETHIOPIAN_MONTHS_AM as AMHARIC_MONTHS } from '../lib/ethiopianCalendar';

interface QueueStatusPayload {
  state: 'waiting' | 'serving' | 'done';
  position: number | null;
  etaMinutes: number | null;
  initials: string;
  startTimeIso: string;
  timeLabel: string;
  dateEthiopian: { day: number; monthIndex: number; year: number };
}

const GREGORIAN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function QueueStatus() {
  const { token } = useParams<{ token: string }>();
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<QueueStatusPayload | null>(null);
  const [missing, setMissing] = useState(false);
  const hiddenRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/public/queue-status/${encodeURIComponent(token!)}`);
        if (!cancelled) {
          if (res.status === 404) {
            setMissing(true);
          } else if (res.ok) {
            setData(await res.json());
            setMissing(false);
          }
          // Other errors: keep the last honest board; never fake progress.
        }
      } catch {
        // Offline on 3G — hold the last known truth.
      }
    }

    void poll();
    const interval = setInterval(() => { if (!hiddenRef.current) void poll(); }, 15000);

    const onVisibility = () => {
      hiddenRef.current = document.hidden;
      if (!document.hidden) void poll(); // refresh immediately on return
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [token]);

  if (missing) {
    return (
      <main className="min-h-screen flex items-center justify-center px-5" style={{ backgroundColor: 'var(--color-paper)' }}>
        <div className="text-center">
          <span className="stamp">{t('queueStatus.expired')}</span>
          <p className="mt-4 text-sm text-ink-soft max-w-xs mx-auto">{t('queueStatus.expiredBody')}</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-paper)' }}>
        <span className="stamp">{t('publicTenant.loading')}</span>
      </main>
    );
  }

  const start = new Date(data.startTimeIso);
  const eth = gregorianToEthiopian(start);
  const amharicMonth = AMHARIC_MONTHS[eth.month - 1] ?? '';
  const gregorian = `${GREGORIAN_MONTHS[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`;
  const isAm = i18n.language?.startsWith('am');

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-5 py-12"
      style={{ backgroundColor: 'var(--color-paper)' }}
      data-testid="queue-status"
      aria-live="polite"
    >
      {/* Ticket header — the receipt roll */}
      <div className="w-full max-w-sm text-center">
        <div className="font-receipt text-xs uppercase tracking-[0.08em] text-ink-stamp">
          {t('queueStatus.yourTicket')}
        </div>

        {/* Dual calendar — Ge'ez primary, Gregorian subtitle */}
        <div className="mt-2" data-testid="dual-date">
          <div style={{ fontFamily: 'var(--font-serif-ethiopic)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-ink)', lineHeight: 1.65 }}>
            {isAm
              ? `${amharicMonth} ${eth.day}, ${eth.year} ዓ.ም`
              : `${AMHARIC_MONTHS[eth.month - 1]} · ${eth.day} ${eth.year} EC`}
          </div>
          <div className="font-receipt text-xs text-ink-soft mt-0.5">
            {gregorian} · {data.timeLabel}
          </div>
        </div>

        {/* THE THREE STATES */}
        {data.state === 'serving' ? (
          <TurnCard key="turn" />
        ) : data.state === 'done' ? (
          <DoneCard />
        ) : (
          <WaitingBoard position={data.position} etaMinutes={data.etaMinutes} initials={data.initials} />
        )}

        <p className="mt-10 font-receipt text-[0.7rem] uppercase tracking-[0.08em] text-ink-stamp">
          {t('queueStatus.footer')}
        </p>
      </div>
    </main>
  );
}

/** "#N · ~X min" — big mono numeral, honest wait estimate. */
function WaitingBoard({ position, etaMinutes, initials }: { position: number | null; etaMinutes: number | null; initials: string }) {
  const { t } = useTranslation();
  return (
    <div
      className="mt-8 rounded-rd border border-ink-rule bg-paper-bleached px-8 py-10"
      data-testid="state-waiting"
      style={{ transition: 'opacity 250ms cubic-bezier(0.22,1,0.36,1), transform 250ms cubic-bezier(0.22,1,0.36,1)' }}
    >
      <span
        className="take-a-number mx-auto"
        style={{ width: '5rem', height: '5rem', fontSize: '2.25rem', fontFamily: 'var(--font-receipt)' }}
        data-testid="position-chip"
      >
        {position ?? '—'}
      </span>
      <div className="mt-6 font-receipt font-medium" style={{ fontSize: '1.75rem', color: 'var(--color-ink)' }}>
        {etaMinutes != null && etaMinutes > 0 ? `~${etaMinutes} ${t('queue.minUnit')}` : t('queueStatus.almostThere')}
      </div>
      <div className="mt-2 inline-flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-[2px] bg-ink/10 font-receipt text-xs text-ink">
          {initials}
        </span>
        <span className="font-receipt text-xs uppercase tracking-[0.08em] text-ink-soft">
          {t('queueStatus.inLine')}
        </span>
      </div>
    </div>
  );
}

/** "It's your turn" — the one pulsing-green moment the product saves its energy for. */
function TurnCard() {
  const { t } = useTranslation();
  return (
    <div className="mt-8" data-testid="state-turn">
      <div
        data-testid="turn-pulse"
        className="mx-auto inline-flex items-center justify-center rounded-rd border-2 px-10 py-8"
        style={{
          borderColor: 'var(--color-primary)',
          backgroundColor: 'rgba(15,169,88,0.08)',
          animation: 'turn-pulse 1.6s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        }}
      >
        <div>
          <div
            style={{ fontFamily: 'var(--font-serif-ethiopic)', fontWeight: 700, fontSize: 'clamp(1.9rem, 7vw, 2.6rem)', color: 'var(--color-primary-deep)', lineHeight: 1.15 }}
          >
            {t('queueStatus.yourTurn')}
          </div>
          <div className="font-display font-bold mt-1" style={{ color: 'var(--color-primary-deep)', fontSize: '1rem' }}>
            {t('queueStatus.yourTurnEn')}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Quiet close — the moment is over; certainty, not celebration. */
function DoneCard() {
  const { t } = useTranslation();
  return (
    <div className="mt-8" data-testid="state-done">
      <span className="stamp positive stamp-slam-in" style={{ fontSize: '1.1rem' }}>
        ✓ {t('queueStatus.done')}
      </span>
      <p className="mt-4 text-sm text-ink-soft">{t('queueStatus.doneBody')}</p>
    </div>
  );
}
