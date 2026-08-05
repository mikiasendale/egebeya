import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PublicBooking } from './PublicBooking';

/**
 * Minimal embeddable booking route for iframe widgets.
 *
 * Loaded at GET /embed/booking?bid=SLUG — the `bid` query param is the
 * tenant's slug. Renders the same PublicBooking component the subdomain and
 * /book/:slug routes use, but with only the booking form (no masthead, no
 * directory chrome, no global nav) so it fits cleanly inside a 600px iframe.
 *
 * Security / availability checks (isListed, isSuspended) are inherited from
 * the underlying public API endpoints the booking flow calls — no tenant
 * lookup is done client-side; each request carries X-Tenant-Slug headers.
 */
export function EmbedBooking() {
  const [searchParams] = useSearchParams();
  const bid = searchParams.get('bid');

  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bid || bid.trim().length === 0) {
      setError('Missing business identifier (bid)');
      setLoading(false);
      return;
    }

    fetch('/api/public/page', { headers: { 'X-Tenant-Slug': bid.trim() } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Not found'))))
      .then((data) => {
        setTenant(data.tenant);
        setLoading(false);
      })
      .catch(() => {
        setError('Business not found');
        setLoading(false);
      });
  }, [bid]);

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center" style={{ backgroundColor: 'var(--color-paper)' }}>
        <span style={{ fontFamily: 'var(--font-receipt)', color: 'var(--color-ink-soft)', letterSpacing: '0.1em', fontSize: '0.8rem' }}>
          Loading…
        </span>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center text-center px-5" style={{ backgroundColor: 'var(--color-paper)' }}>
        <div style={{ fontFamily: 'var(--font-serif-ethiopic)', fontWeight: 700, fontSize: '1.5rem', color: 'var(--color-ink)' }}>
          ኢ-ገበያ
        </div>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-ink-soft)' }}>
          {error || 'Business not found'}
        </p>
      </div>
    );
  }

  // Render the booking form, no masthead/header, no directory chrome.
  return (
    <div className="min-h-[400px]" style={{ backgroundColor: 'var(--color-paper)' }}>
      <PublicBooking tenant={tenant} subdomain={bid!} />
    </div>
  );
}