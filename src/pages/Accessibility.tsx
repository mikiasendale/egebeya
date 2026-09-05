/**
 * Accessibility statement (Wayfinder #15/#20 — EAA Art. 13(2) Annex B/C shape,
 * published voluntarily while egebeya operates under the Art. 4(5)
 * microenterprise exemption — see docs/EAA-EXEMPTION.md).
 *
 * Amharic-first, i18n-driven, am/en parity enforced by server/tests/i18n.test.ts
 * via the shared locale keys — the same pattern as Privacy.tsx (P3.7).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function Accessibility() {
  const { t } = useTranslation();
  const sections = t('accessibility.sections', { returnObjects: true }) as Array<{
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
          ← {t('accessibility.back')}
        </Link>
        <h1
          className="mt-8 mb-4"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', letterSpacing: '-0.02em' }}
        >
          {t('accessibility.title')}
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-ink-soft)', fontFamily: 'var(--font-mono)' }}>
          {t('accessibility.updated')} · {t('accessibility.basis')}
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
            <h2 className="text-xl font-semibold mt-6 mb-2">{t('accessibility.contactHeading')}</h2>
            <p>
              {t('accessibility.contactBody')}{' '}
              <a href="mailto:support@egebeya.et" className="underline">support@egebeya.et</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
