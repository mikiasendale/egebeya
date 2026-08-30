/**
 * Privacy Policy (P3.7 refresh) — Amharic-first, i18n-driven, am/en parity
 * enforced by server/tests/i18n.test.ts via the shared locale keys.
 *
 * Covers what PDPL 1321/2024 makes explicit now that consumer identity is
 * live: phone-keyed profiles, Telegram messaging consent, loyalty tracking,
 * and the data-deletion path (POST /api/consumer/data-deletion).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function Privacy() {
  const { t } = useTranslation();
  const sections = t('privacy.sections', { returnObjects: true }) as Array<{
    heading: string;
    body: string;
  }>;

  return (
    <div
      className="min-h-screen px-5 sm:px-8 lg:px-12 py-20"
      style={{ backgroundColor: 'var(--color-paper)', color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }}
    >
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="no-underline text-sm"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink-stamp)', letterSpacing: '0.06em' }}
        >
          ← {t('privacy.back')}
        </Link>
        <h1
          className="mt-8 mb-4"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', letterSpacing: '-0.02em' }}
        >
          {t('privacy.title')}
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-ink-soft)', fontFamily: 'var(--font-mono)' }}>
          {t('privacy.updated')} · {t('privacy.law')}
        </p>
        <div
          className="mt-8 space-y-6"
          style={{ color: 'var(--color-ink)', lineHeight: 1.7, fontSize: '0.95rem' }}
        >
          {Array.isArray(sections) && sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-xl font-semibold mt-6 mb-2">{s.heading}</h2>
              <p>{s.body}</p>
            </section>
          ))}
          <section>
            <h2 className="text-xl font-semibold mt-6 mb-2">{t('privacy.contactHeading')}</h2>
            <p>
              {t('privacy.contactBody')}{' '}
              <a href="mailto:support@egebeya.et" className="underline">support@egebeya.et</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
