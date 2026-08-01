import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PublicBooking } from './PublicBooking';
import { Render } from '@measured/puck';
import { config } from '../lib/puck.config';
import '@measured/puck/dist/index.css';

export function PublicTenantSite({ hostname }: { hostname: string }) {
  const [tenant, setTenant] = useState<any>(null);
  const [pageData, setPageData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { t } = useTranslation();

  const subdomain = hostname.split('.')[0];

  useEffect(() => {
    fetch(`/api/public/page`, {
      headers: { 'X-Tenant-Slug': subdomain }
    })
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then(data => {
        setTenant(data.tenant);
        setPageData(data.page?.content || null);
        setLoading(false);
      })
      .catch(err => {
        setError('Business not found');
        setLoading(false);
      });
  }, [subdomain]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-paper)' }}
      >
        <span className="stamp">{t('publicTenant.loading')} · {t('publicTenant.loadingAm')}</span>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center text-center px-5"
        style={{ backgroundColor: 'var(--color-paper)' }}
      >
        <span
          style={{
            fontFamily: 'var(--font-serif-ethiopic)',
            fontWeight: 700,
            fontSize: '2.25rem',
            color: 'var(--color-ink)',
            lineHeight: 1,
          }}
        >
          ኢ-ገበያ
        </span>
        <h1
          className="m-0 mt-3"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: '2rem',
            letterSpacing: '-0.02em',
            color: 'var(--color-ink)',
          }}
        >
          Business Not Found · {t('publicTenant.notFoundAm')}
        </h1>
        <p className="mt-3 text-base" style={{ color: 'var(--color-ink-soft)' }}>
          {t('publicTenant.notFoundDesc')}
        </p>
        <a
          href="https://egebeya.et"
          className="mt-6 no-underline"
          style={{
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.06em',
            color: 'var(--color-ink)',
            textTransform: 'uppercase',
            fontSize: '0.85rem',
          }}
        >
          {t('publicTenant.visitDirectory')}
        </a>
      </div>
    );
  }

  const hasHeroBlock = Array.isArray(pageData?.content?.blocks) &&
    pageData.content.blocks.some((b: any) => b?.type === 'Hero');

  const showDefaultHeader = !pageData || !hasHeroBlock;

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--color-paper)', fontFamily: 'var(--font-body)' }}
    >
      <Helmet>
        <title>{tenant.name} | {t('publicTenant.bookOnline')}</title>
        {tenant.description && (
          <meta name="description" content={tenant.description} />
        )}
      </Helmet>

      {showDefaultHeader && (
        <header
          className="flex justify-between items-center px-5 sm:px-8 lg:px-12 py-5"
          style={{ borderBottom: '1px solid var(--color-ink)' }}
        >
          <h1
            className="m-0 cursor-pointer text-xl sm:text-2xl"
            onClick={() => navigate('/')}
            style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--color-ink)', letterSpacing: '-0.015em' }}
          >
            {tenant.name}
          </h1>
          <button
            onClick={() => navigate('/book')}
            className="font-semibold"
            style={{
              backgroundColor: 'var(--color-ink)',
              color: 'var(--color-paper)',
              fontFamily: 'var(--font-display)',
              borderRadius: 'var(--rd-card)',
              padding: '0.625rem 1.5rem',
              border: 'none',
              cursor: 'pointer',
              letterSpacing: '0.01em',
              fontSize: '0.85rem',
            }}
          >
            Book Now · {t('publicTenant.bookNowAm')}
          </button>
        </header>
      )}

      {pageData && hasHeroBlock && (
        <button
          onClick={() => navigate('/book')}
          className="fixed bottom-6 right-6 z-50"
          style={{
            backgroundColor: 'var(--color-ink)',
            color: 'var(--color-paper)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            borderRadius: 'var(--rd-card)',
            padding: '0.75rem 1.25rem',
            border: 'none',
            cursor: 'pointer',
            letterSpacing: '0.01em',
            fontSize: '0.9rem',
          }}
        >
          Book Now · {t('publicTenant.bookNowAm')}
        </button>
      )}

      <Routes>
        <Route path="/" element={
          pageData ? (
            <Render config={config} data={pageData} />
          ) : (
            <main className="max-w-4xl mx-auto py-16 px-4 text-center">
              <span className="stamp" aria-hidden>{t('publicTenant.newTenant')}</span>
              <h2
                className="mt-4 mb-3 m-0"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
                  color: 'var(--color-ink)',
                  letterSpacing: '-0.025em',
                }}
              >
                {t('publicTenant.welcomeTo')} {tenant.name}
              </h2>
              <p className="text-lg" style={{ color: 'var(--color-ink-soft)' }}>
                {t('publicTenant.notPublished')}
              </p>
              <button
                onClick={() => navigate('/book')}
                className="mt-6"
                style={{
                  backgroundColor: 'var(--color-ink)',
                  color: 'var(--color-paper)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  borderRadius: 'var(--rd-card)',
                  padding: '0.75rem 1.75rem',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Book Now · {t('publicTenant.bookNowAm')}
              </button>
            </main>
          )
        } />
        <Route path="/book" element={<PublicBooking tenant={tenant} subdomain={subdomain} />} />
      </Routes>
    </div>
  );
}
