import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { PublicBooking } from './PublicBooking';

/**
 * Standalone public booking page (/:slug/book on the main domain).
 * Renders the Telebirr-on-a-counter world for a tenant reachable without
 * subdomain DNS. Reuses the same PublicBooking component the subdomain site
 * uses at /book; only the masthead above changes.
 */
export function PublicBookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) {
      setError('Missing tenant slug');
      setLoading(false);
      return;
    }
    fetch('/api/public/page', { headers: { 'X-Tenant-Slug': slug } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Not found'))))
      .then((data) => {
        setTenant(data.tenant);
        setLoading(false);
      })
      .catch(() => {
        setError('Business not found');
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-paper)' }} className="flex items-center justify-center">
        <span style={{ fontFamily: 'var(--font-receipt)', color: 'var(--color-ink-soft)', letterSpacing: '0.1em' }}>
          āዝና&hairsp;ያውቁ…
        </span>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-paper)' }} className="flex flex-col items-center justify-center text-center px-5">
        <div style={{ fontFamily: 'var(--font-serif-ethiopic)', fontWeight: 700, fontSize: '2.5rem', color: 'var(--color-ink)' }}>
          ኢ-ገበያ
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '2.25rem', marginTop: '1rem', color: 'var(--color-ink)' }}>
          {error || 'Business not found'}
        </h1>
        <Link to="/" style={{ color: 'var(--color-telebirr-deep)', fontFamily: 'var(--font-receipt)', letterSpacing: '0.08em', marginTop: '1rem' }}>
          ← back to Egebeya directory
        </Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-paper)' }}>
      <Helmet>
        <title>{tenant.name} · Book online — the deposit confirms it</title>
      </Helmet>
      <header
        className="px-5 sm:px-8 lg:px-12 py-5 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--color-ink-rule)' }}
      >
        <Link to="/" className="no-underline" aria-label="Egebeya directory">
          <span className="inline-flex flex-col leading-none">
            <span style={{ fontFamily: 'var(--font-serif-ethiopic)', fontWeight: 700, color: 'var(--color-ink)', fontSize: '1.4rem' }}>
              ኢ-ገበያ
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-ink-soft)', fontSize: '0.8rem', letterSpacing: '-0.02em', marginTop: '0.1rem' }}>
              Egebeya
            </span>
          </span>
        </Link>
        <span
          className="text-xs uppercase"
          style={{ fontFamily: 'var(--font-receipt)', letterSpacing: '0.12em', color: 'var(--color-ink-soft)' }}
        >
          {tenant.name} · {slug}
        </span>
      </header>

      <div style={{ fontFamily: 'var(--font-body)' }}>
        <PublicBooking tenant={tenant} subdomain={slug!} />
      </div>
    </div>
  );
}
