import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CreditCard } from 'lucide-react';

interface GracePeriodOverlayProps {
  subscriptionStatus: string | null;
}

export function GracePeriodOverlay({ subscriptionStatus }: GracePeriodOverlayProps) {
  const { t } = useTranslation();

  if (subscriptionStatus !== 'grace') return null;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-40"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--color-paper) 80%, transparent)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        borderRadius: 'var(--rd-card)',
      }}
    >
      <div
        className="mx-4 max-w-sm w-full text-center p-6"
        style={{
          backgroundColor: 'var(--color-paper-bleached)',
          border: '1px solid var(--color-ink-rule)',
          borderRadius: 'var(--rd-card)',
        }}
      >
        <div
          className="inline-flex items-center justify-center w-12 h-12 mb-4"
          style={{
            backgroundColor: 'var(--color-signal)',
            borderRadius: 'var(--rd-card)',
          }}
        >
          <CreditCard className="h-6 w-6" style={{ color: 'var(--color-paper-bleached)' }} />
        </div>
        <h3
          className="text-lg font-bold mb-2"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}
        >
          {t('grace.title', 'Your Pro Access expires soon')}
        </h3>
        <p
          className="text-sm mb-5"
          style={{ fontFamily: 'var(--font-body)', color: 'var(--color-ink-soft)' }}
        >
          {t('grace.message', "Don't lose your custom site and AI tools.")}
        </p>
        <Link
          to="/dashboard/billing"
          className="inline-flex items-center justify-center px-6 py-3 w-full"
          style={{
            backgroundColor: 'var(--color-telebirr)',
            color: 'var(--color-paper-bleached)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            borderRadius: 'var(--rd-card)',
          }}
        >
          {t('grace.renew', 'Renew via Chapa')}
        </Link>
      </div>
    </div>
  );
}
