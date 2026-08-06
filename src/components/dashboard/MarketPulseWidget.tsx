/**
 * Market Pulse — Pro-tier demand-intent widget.
 *
 * Reads recent buying-intent alerts (from /discover aggregation) and renders a
 * pulsing card when demand is hot. The owner can broadcast a flash-sale link
 * over Telegram in one tap. Renders nothing for non-Pro tenants.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Flame } from 'lucide-react';
import { authFetch } from '../../lib/api';
import { isProActive, type SubscriptionSummary } from '../../lib/subscription';

interface ProAlert {
  id: string;
  category: string;
  city: string;
  actionCount: number;
  message: string;
  createdAt: number;
}

export function MarketPulseWidget() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<SubscriptionSummary | null>(null);
  const [proGateLoading, setProGateLoading] = useState(true);
  const [alerts, setAlerts] = useState<ProAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const cancelledRef = useRef(false);

  const isPro = isProActive(summary);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/tenant/subscription');
        if (cancelled) return;
        const data = res.ok ? await res.json().catch(() => null) : null;
        setSummary(data);
      } catch {
        if (!cancelled) setSummary(null);
      } finally {
        if (!cancelled) setProGateLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isPro) {
      setLoading(false);
      return;
    }
    cancelledRef.current = false;
    (async () => {
      try {
        const res = await authFetch('/api/tenant/alerts');
        if (cancelledRef.current) return;
        const data = await res.json();
        setAlerts(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelledRef.current) setAlerts([]);
      } finally {
        if (!cancelledRef.current) setLoading(false);
      }
    })();
    return () => { cancelledRef.current = true; };
  }, [isPro]);

  // Non-Pro tenants never see the widget.
  if (!proGateLoading && !isPro) {
    return null;
  }

  if (proGateLoading) {
    return (
      <div className="bg-paper-bleached rounded-xl border border-ink-rule p-5">
        <div className="skeleton-wave" style={{ height: '4.5rem', borderRadius: 'var(--rd-card)' }} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-paper-bleached rounded-xl border border-ink-rule p-5">
        <div className="skeleton-wave" style={{ height: '4.5rem', borderRadius: 'var(--rd-card)' }} />
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-paper-bleached rounded-xl border border-ink-rule p-5">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center justify-center"
            style={{
              width: '2.5rem',
              height: '2.5rem',
              borderRadius: 'var(--rd-card)',
              backgroundColor: 'var(--color-ink-rule)',
              color: 'var(--color-ink-soft)',
            }}
          >
            <TrendingUp className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
              {t('dashboard.marketPulse', 'Market Pulse')}
            </h3>
            <p className="text-sm text-ink-soft">
              {t('dashboard.noDemand', 'No hot demand right now. We\'ll alert you when customers are searching.')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const tenantSlug = localStorage.getItem('tenantSlug') || '';
  const businessName = localStorage.getItem('tenantName') || 'our business';

  const latest = alerts[0];

  function broadcastFlashSale() {
    const msg = `🔥 Flash Sale at ${businessName}! Limited-time 15% off all services. Book now: https://${tenantSlug}.egebeya.et`;
    const url = `https://t.me/share/url?url=https://${tenantSlug}.egebeya.et&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  return (
    <div
      className="bg-paper-bleached rounded-xl border-2 border-telebirr/40 p-5 animate-pulse"
      style={{ animationIterationCount: 3, animationDuration: '2s' }}
    >
      <div className="flex items-start gap-3">
        <span
          className="inline-flex items-center justify-center shrink-0"
          style={{
            width: '2.5rem',
            height: '2.5rem',
            borderRadius: 'var(--rd-card)',
            backgroundColor: 'var(--color-telebirr)',
            color: 'var(--color-paper-bleached)',
          }}
        >
          <Flame className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-ink flex items-center gap-1.5" style={{ fontFamily: 'var(--font-display)' }}>
            🔥 {t('dashboard.highDemand', 'High Demand')}
          </h3>
          <p className="text-sm text-ink-soft mt-0.5">
            {latest.actionCount} {t('dashboard.demandPeople', 'people in')} {latest.city}{' '}
            {t('dashboard.demandSearched', 'searched for')} {latest.category}s{' '}
            {t('dashboard.demandRecently', 'recently.')}.
          </p>
        </div>
      </div>
      <div className="mt-3">
        <button
          type="button"
          onClick={broadcastFlashSale}
          className="w-full inline-flex items-center justify-center gap-2 px-4 min-h-[44px] text-sm font-bold rounded-[var(--rd-card)] transition-colors"
          style={{
            fontFamily: 'var(--font-display)',
            backgroundColor: 'var(--color-telebirr)',
            color: 'var(--color-paper-bleached)',
          }}
        >
          <TrendingUp className="h-4 w-4" />
          {t('dashboard.broadcastFlashSale', 'Broadcast Flash Sale')}
        </button>
      </div>
    </div>
  );
}
