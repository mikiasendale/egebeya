/**
 * ConsumerBookings (P5.2) — "My bookings" for phone-keyed customers.
 *
 * The amber progress ring is THE surface: punches accrue automatically from
 * completed visits (zero merchant action), and this ticket shows how close
 * the next reward is. Receipt-world craft: take-a-number square in the
 * center, amber stroke on cream paper, JetBrains Mono numerals.
 *
 * Motion law: the ring animates via stroke-dashoffset transition
 * (transform/opacity family, ≤250ms); no other movement here.
 *
 * Auth: consumer JWT only (localStorage 'consumerToken', minted by
 * POST /api/consumer/verify). The server re-verifies the audience on every
 * call — this page is a viewer, not a trust boundary.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authFetch } from '../lib/api';
import { showToast } from '../components/ui/toast-helper';
import { ReportBlockLinks } from '../components/ReportBlockLinks';

interface LoyaltyCard {
  punches: number;
  target: number;
  rewardReady: boolean;
  rewardConfig?: { type: 'percent' | 'fixed_etb_cents'; value: number };
  gateOpen?: boolean;
}

const RING_RADIUS = 54;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function PunchRing({ punches, target, size = 160 }: { punches: number; target: number; size?: number }) {
  const safeTarget = Math.max(1, target);
  const progress = Math.max(0, Math.min(1, punches / safeTarget));
  const offset = RING_CIRCUMFERENCE * (1 - progress);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} data-testid="punch-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={RING_RADIUS}
          fill="none" stroke="var(--color-ink-rule)" strokeWidth="8"
        />
        {/* Progress — amber, animated via dashoffset only */}
        <circle
          cx={size / 2} cy={size / 2} r={RING_RADIUS}
          fill="none"
          stroke="var(--color-accent-secondary)"
          strokeWidth="8"
          strokeLinecap="butt"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 250ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          data-testid="punch-ring-progress"
        />
      </svg>
      <span
        className="take-a-number absolute"
        style={{ width: '3rem', height: '3rem', fontSize: '1.25rem' }}
        aria-label={`${punches} / ${target}`}
      >
        {punches}
      </span>
    </div>
  );
}

export function ConsumerBookings() {
  const { t } = useTranslation();
  const [card, setCard] = useState<LoyaltyCard | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  // null = availability unknown — default to showing the normal sign-in block.
  const [telegramEnabled, setTelegramEnabled] = useState<boolean | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('consumerToken');
    const tenantId = localStorage.getItem('tenantId') || new URLSearchParams(window.location.search).get('tenant') || '';
    if (!token || !tenantId) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    authFetch(`/api/consumer/loyalty/${tenantId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then(setCard)
      .catch(() => setCard(null));
  }, []);

  useEffect(() => {
    fetch('/api/public/telegram-config')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((data) => setTelegramEnabled(Boolean(data?.enabled)))
      .catch(() => setTelegramEnabled(null));
  }, []);

  // Wayfinder #12/#17 — self-serve immediate consumer deletion. One confirm,
  // one POST; the server does the rest in a single transaction. On success
  // the token is dead and the local shell is cleared.
  const handleDeleteAccount = async (): Promise<void> => {
    if (deleting) return;
    if (!window.confirm(t('consumerBookings.deleteConfirm'))) return;
    setDeleting(true);
    try {
      const r = await authFetch('/api/consumer/account/deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      if (!r.ok) throw new Error('failed');
      try { localStorage.removeItem('consumerToken'); localStorage.removeItem('tenantId'); } catch { /* never throws */ }
      setAuthed(false);
      setCard(null);
      showToast(t('consumerBookings.deleteDone'), '', 'destructive');
    } catch {
      showToast(t('consumerBookings.deleteFailed'), '', 'destructive');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="min-h-screen px-5 py-12" style={{ backgroundColor: 'var(--color-paper)' }} data-testid="consumer-bookings">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-bold text-ink mb-6">{t('consumerBookings.title')}</h1>

        {authed === false ? (
          telegramEnabled === false ? (
            // Telegram unprovisioned — say so instead of offering a dead end.
            <div className="bg-paper-bleached border border-ink-rule rounded-rd p-6" data-testid="consumer-login-unavailable">
              <p className="text-sm text-ink-soft">
                {t('consumerBookings.unavailablePrompt')}
              </p>
            </div>
          ) : (
            <div className="bg-paper-bleached border border-ink-rule rounded-rd p-6">
              <p className="text-sm text-ink-soft">
                {t('consumerBookings.signInPrompt')}
              </p>
              <Link to="/login" className="mt-3 inline-block text-sm underline underline-offset-2" style={{ color: 'var(--color-link)' }}>
                {t('consumerBookings.signInLink')}
              </Link>
            </div>
          )
        ) : !card ? (
          <p className="text-sm text-ink-soft font-receipt">{t('common.loading')}…</p>
        ) : (
          <section className="bg-paper-bleached border border-ink-rule rounded-rd p-6 receipt-rule-top">
            <div className="uppercase text-xs font-receipt tracking-[0.08em]" style={{ color: 'var(--color-telebirr-deep)' }}>
              {t('consumerBookings.punchCard')}
            </div>
            <div className="mt-4 flex items-center gap-6">
              <PunchRing punches={card.punches} target={card.target} />
              <div>
                <div className="font-receipt text-sm" style={{ color: 'var(--color-ink)' }}>
                  {card.punches} / {card.target} {t('consumerBookings.visits')}
                </div>
                {card.rewardReady ? (
                  <p className="mt-2 text-sm" style={{ color: 'var(--color-primary-deep)' }} data-testid="reward-ready">
                    {t('consumerBookings.rewardReady')}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-ink-soft" style={{ lineHeight: 1.65 }}>
                    {t('consumerBookings.rewardHint', { remaining: Math.max(0, card.target - card.punches) })}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {authed === true && (
          <div className="mt-8 text-center" data-testid="consumer-delete-account">
            <button
              type="button"
              onClick={() => void handleDeleteAccount()}
              disabled={deleting}
              className="text-xs underline underline-offset-2 disabled:opacity-50"
              style={{ color: 'var(--color-ink-soft)' }}
            >
              {deleting ? t('consumerBookings.deleting') : t('consumerBookings.deleteAccount')}
            </button>
          </div>
        )}

        {/* Wayfinder #19 — report/block footer for the tenant context */}
        {(() => {
          const ctxTenant = localStorage.getItem('tenantId');
          return ctxTenant ? (
            <div className="mt-6 text-center">
              <ReportBlockLinks tenantId={ctxTenant} />
            </div>
          ) : null;
        })()}
      </div>
    </main>
  );
}
