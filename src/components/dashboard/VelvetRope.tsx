/**
 * Velvet rope (P5.4) — locked-but-labeled, never hidden (council ruling).
 *
 * A gated feature keeps its place in the UI and wears a lock chip with a
 * one-line Amharic-first value prop. Tapping it opens the VALUE-ANCHORED
 * pricing sheet: "You took N bookings this month" sits above the price when
 * the data exists — the merchant sees what the tool earned before what it
 * costs. No feature hiding anywhere; labels only.
 */
import React, { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authFetch } from '../../lib/api';

export interface PlanGateInfo {
  planName: string;
  isPro: boolean;
  /** Confirmed bookings this month — the value-scene number. */
  monthlyBookings: number | null;
}

/** One shared read of the plan state + value metric. */
export function usePlanGate(): { info: PlanGateInfo | null; loading: boolean } {
  const [info, setInfo] = useState<PlanGateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    authFetch('/api/tenant/subscription')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((data: any) => {
        setInfo({
          planName: String(data?.plan?.name ?? 'free'),
          isPro: String(data?.plan?.name ?? 'free').toLowerCase() === 'pro',
          monthlyBookings: typeof data?.billing?.monthlyBookings === 'number'
            ? data.billing.monthlyBookings
            : null,
        });
      })
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, []);
  return { info, loading };
}

/**
 * The lock chip itself — inline, next to the feature label. Never hides or
 * disables navigation to the feature; the feature page still renders its own
 * free-tier experience where one exists.
 */
export function LockChip({ label }: { label?: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-[2px] px-1.5 py-0.5 align-middle"
      style={{ border: '1px solid var(--color-accent-secondary)', color: 'var(--color-accent-secondary-deep)' }}
      data-testid="velvet-lock-chip"
    >
      <Lock className="h-3 w-3" aria-hidden />
      <span className="font-receipt text-[0.625rem] uppercase tracking-[0.08em]">
        {label ?? 'Pro'}
      </span>
    </span>
  );
}

/**
 * Value-anchored pricing sheet. Anchored on the scene, not the fee: the
 * owner's own booking count appears above the price whenever we have it.
 */
export function ValuePricingSheet({ open, onClose, info }: {
  open: boolean;
  onClose: () => void;
  info: PlanGateInfo | null;
}) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(26,20,17,0.45)', transition: 'opacity 200ms cubic-bezier(0.22,1,0.36,1)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      data-testid="value-pricing-sheet"
    >
      <div
        className="w-full max-w-md bg-paper-bleached border border-ink-rule rounded-rd receipt-rule-top p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* THE value scene — the merchant's own number leads. */}
        {info?.monthlyBookings != null && info.monthlyBookings > 0 && (
          <p
            className="text-lg font-bold text-ink mb-1"
            data-testid="value-scene"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('velvet.valueScene', { count: info.monthlyBookings })}
          </p>
        )}
        <h2 className="text-base font-bold text-ink">{t('velvet.sheetTitle')}</h2>
        <ul className="mt-3 space-y-2" role="list">
          <li className="flex items-start gap-2 text-sm text-ink">
            <span className="take-a-number shrink-0" style={{ width: '1.4rem', height: '1.4rem', fontSize: '0.65rem' }}>✓</span>
            {t('velvet.perkCustomDomain')}
          </li>
          <li className="flex items-start gap-2 text-sm text-ink">
            <span className="take-a-number shrink-0" style={{ width: '1.4rem', height: '1.4rem', fontSize: '0.65rem' }}>✓</span>
            {t('velvet.perkCodeMode')}
          </li>
          <li className="flex items-start gap-2 text-sm text-ink">
            <span className="take-a-number shrink-0" style={{ width: '1.4rem', height: '1.4rem', fontSize: '0.65rem' }}>✓</span>
            {t('velvet.perkStaff')}
          </li>
        </ul>

        <div className="mt-4 pt-3 border-t border-ink-rule flex items-baseline justify-between">
          <span className="font-receipt text-xs uppercase tracking-[0.08em] text-ink-soft">
            {t('velvet.priceLabel')}
          </span>
          <span className="font-receipt font-bold text-xl text-ink" data-testid="velvet-price">
            {t('velvet.priceValue')}
          </span>
        </div>

        <a
          href="/dashboard/billing"
          data-testid="velvet-upgrade-cta"
          className="mt-5 w-full inline-flex items-center justify-center px-6 py-3.5 rounded-rd font-display font-bold transition-opacity duration-200 hover:opacity-90"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-paper-bleached)' }}
        >
          {t('velvet.upgradeCta')}
        </a>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full py-2 text-xs text-ink-soft underline underline-offset-2"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          {t('common.back', 'Back')}
        </button>
      </div>
    </div>
  );
}
