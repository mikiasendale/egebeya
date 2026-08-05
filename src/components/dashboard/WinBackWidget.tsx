import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authFetch } from '../../lib/api';

interface InactiveCustomer {
  phone: string;
  name: string | null;
  visitCount: number;
  totalSpend: number;
  lastVisit: number | null;
  lastCancelledAt: number | null;
}

function daysSince(ts: number | null): number {
  if (!ts) return 999;
  return Math.max(0, Math.floor((Date.now() - ts) / 86400000));
}

function customerDisplayName(c: InactiveCustomer): string {
  return c.name?.trim() || c.phone;
}

export function WinBackWidget() {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState<InactiveCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/tenant/customers?inactive_days=30');
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        if (!cancelled) {
          setCustomers(Array.isArray(data) ? data.slice(0, 10) : []);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError('Could not load inactive customers');
          setCustomers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const tenantSlug = localStorage.getItem('tenantSlug') || '';
  const businessName = localStorage.getItem('tenantName') || 'our business';

  function sendWinBack(c: InactiveCustomer) {
    const name = customerDisplayName(c);
    const msg = `Hi ${name}, we miss you at ${businessName}! Use code WIN10 for 10% off your next visit.`;
    const url = `https://t.me/share/url?url=https://${tenantSlug}.egebeya.et&text=${encodeURIComponent(msg)}`;
    setSentIds((prev) => new Set(prev).add(c.phone));
    window.open(url, '_blank');
  }

  return (
    <section className="bg-paper-bleached rounded-[var(--rd-card)] border border-[var(--color-ink-rule)] overflow-hidden">
      <header className="px-5 py-4 border-b border-[var(--color-ink-rule)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}>
              Customers Missing You
            </h2>
            <p className="text-xs mt-0.5" style={{ fontFamily: 'var(--font-receipt)', color: 'var(--color-ink-soft)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Inactive 30+ days
            </p>
          </div>
          {customers.length > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[2rem] h-8 px-3"
              style={{
                fontFamily: 'var(--font-receipt)',
                fontWeight: 700,
                fontSize: '0.85rem',
                backgroundColor: 'var(--color-signal)',
                color: 'var(--color-paper-bleached)',
                borderRadius: 'var(--rd-card)',
              }}
            >
              {customers.length}
            </span>
          )}
        </div>
      </header>

      <div className="p-5">
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="skeleton-wave" style={{ height: '4rem', borderRadius: 'var(--rd-card)' }} />
            ))}
          </div>
        )}

        {!loading && error && (
          <p className="text-sm" style={{ color: 'var(--color-signal)' }}>{error}</p>
        )}

        {!loading && !error && customers.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--color-ink-soft)' }}>
            No inactive customers — everyone visited in the last 30 days.
          </p>
        )}

        {!loading && !error && customers.length > 0 && (
          <ul className="space-y-2" role="list">
            {customers.map((c, i) => {
              const days = daysSince(c.lastVisit);
              const displayName = customerDisplayName(c);
              const alreadySent = sentIds.has(c.phone);
              return (
                <li
                  key={c.phone}
                  className="flex items-center gap-3 p-3 border border-[var(--color-ink-rule)] rounded-[var(--rd-card)]"
                  style={{
                    backgroundColor: 'var(--color-surface-raised)',
                    animation: `fade-in 200ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 60}ms both`,
                  }}
                >
                  <span
                    className="flex-shrink-0 inline-flex items-center justify-center"
                    style={{
                      width: '2.5rem',
                      height: '2.5rem',
                      fontFamily: 'var(--font-receipt)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      backgroundColor: 'var(--color-ink)',
                      color: 'var(--color-paper-bleached)',
                      borderRadius: 'var(--rd-card)',
                    }}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-medium truncate"
                      style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)', fontSize: '0.95rem' }}
                    >
                      {displayName}
                    </div>
                    <div className="text-xs" style={{ fontFamily: 'var(--font-receipt)', color: 'var(--color-ink-soft)', letterSpacing: '0.06em' }}>
                      {days === 999 ? 'Never visited' : `${days}d ago`}
                      {c.visitCount > 0 && (
                        <span style={{ color: 'var(--color-ink-rule)' }}> · {c.visitCount} visits</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => sendWinBack(c)}
                    disabled={alreadySent}
                    className="flex-shrink-0 inline-flex items-center justify-center px-4 min-h-[44px] text-sm font-bold rounded-[var(--rd-card)] transition-colors"
                    style={{
                      fontFamily: 'var(--font-display)',
                      backgroundColor: alreadySent ? 'var(--color-ink-rule)' : 'var(--color-telebirr)',
                      color: alreadySent ? 'var(--color-ink-soft)' : 'var(--color-paper-bleached)',
                      cursor: alreadySent ? 'default' : 'pointer',
                    }}
                  >
                    {alreadySent ? 'Sent' : 'Send Win-Back'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
