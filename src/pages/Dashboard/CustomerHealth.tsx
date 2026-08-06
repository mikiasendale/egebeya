/**
 * Customer Health Center — Pro-tier CRM surface.
 *
 * Renders the tenant's customers grouped by health tag (computed server-side
 * from visit / no-show history) with one-tap retention actions:
 *   - vip_loyal        → generate a 15% holiday voucher + share over Telegram
 *   - at_risk_churn    → generate a 10% comeback discount + share over Telegram
 *   - high_no_show_risk → flag the phone to require upfront Telebirr deposit
 *
 * Operate register: mobile-first, scanable, fits the existing bottom-nav shell.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, AlertTriangle, Lock, Users } from 'lucide-react';
import { authFetch } from '../../lib/api';
import { showToast } from '../../components/ui/toast-helper';
import { isProActive, type SubscriptionSummary } from '../../lib/subscription';
import { HEALTH_TAGS, type HealthTag } from '../../lib/customer-health';
import { StaffRedirect } from './StaffRedirect';

interface Customer {
  phone: string;
  name: string | null;
  marketingOptIn: boolean;
  visitCount: number;
  noShowCount: number;
  totalSpend: number;
  lastVisit: number | null;
  lastCancelledAt: number | null;
  healthTag: HealthTag;
}

const GROUP_ORDER: HealthTag[] = ['vip_loyal', 'at_risk_churn', 'high_no_show_risk', 'healthy'];

function daysSince(ts: number | null): number {
  if (!ts) return 999;
  return Math.max(0, Math.floor((Date.now() - ts) / 86400000));
}

function displayName(c: Customer): string {
  return c.name?.trim() || c.phone;
}

function generateCode(prefix: string): string {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${suffix}`;
}

export function CustomerHealth() {
  const [summary, setSummary] = useState<SubscriptionSummary | null>(null);
  const [proGateLoading, setProGateLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [upfrontPhones, setUpfrontPhones] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyPhone, setBusyPhone] = useState<string | null>(null);

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

  // Guard stale closures across the async boundary without re-creating the
  // effect every render.
  const cancelledGuard = React.useRef(false);
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [custRes, phonesRes] = await Promise.all([
        authFetch('/api/tenant/customers'),
        authFetch('/api/tenant/settings/upfront-phones'),
      ]);
      if (!custRes.ok) throw new Error('Failed to load customers');
      const data = await custRes.json();
      const phoneData = phonesRes.ok ? await phonesRes.json().catch(() => ({})) : {};
      if (!cancelledGuard.current) {
        setCustomers(Array.isArray(data) ? data : []);
        const list: string[] = Array.isArray(phoneData?.require_upfront_phones)
          ? phoneData.require_upfront_phones
          : [];
        setUpfrontPhones(new Set(list));
      }
    } catch {
      if (!cancelledGuard.current) {
        setError('Could not load customer health data');
        setCustomers([]);
      }
    } finally {
      if (!cancelledGuard.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    cancelledGuard.current = false;
    if (isPro) loadData();
    return () => { cancelledGuard.current = true; };
  }, [isPro, loadData]);

  const tenantSlug = localStorage.getItem('tenantSlug') || '';
  const businessName = localStorage.getItem('tenantName') || 'our business';

  const grouped = useMemo(() => {
    const map = new Map<HealthTag, Customer[]>();
    for (const tag of GROUP_ORDER) map.set(tag, []);
    for (const c of customers) {
      const list = map.get(c.healthTag) || [];
      list.push(c);
      map.set(c.healthTag, list);
    }
    return map;
  }, [customers]);

  const createPromo = useCallback(async (percent: number, prefix: string) => {
    const code = generateCode(prefix);
    const res = await authFetch('/api/tenant/promo-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        discountType: 'percent',
        discountValue: percent,
        maxUses: 1,
      }),
    });
    if (!res.ok) throw new Error('Promo creation failed');
    return code;
  }, []);

  const sendVoucher = useCallback(async (c: Customer) => {
    setBusyPhone(c.phone);
    try {
      const code = await createPromo(15, 'HOLIDAY');
      const name = displayName(c);
      const msg = `Hi ${name}, thank you for being a loyal customer at ${businessName}! Here's a 15% holiday gift voucher: ${code}. We appreciate you!`;
      const url = `https://t.me/share/url?url=https://${tenantSlug}.egebeya.et&text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
      showToast('Voucher ready', `15% code ${code} created. Share it with ${name}.`, 'default');
    } catch {
      showToast('Could not create voucher', 'Please try again.', 'destructive');
    } finally {
      setBusyPhone(null);
    }
  }, [createPromo, tenantSlug, businessName]);

  const sendComeback = useCallback(async (c: Customer) => {
    setBusyPhone(c.phone);
    try {
      const code = await createPromo(10, 'COMEBACK');
      const name = displayName(c);
      const msg = `Hi ${name}, we miss you at ${businessName}! Come back with 10% off your next visit using code ${code}. We'd love to see you again!`;
      const url = `https://t.me/share/url?url=https://${tenantSlug}.egebeya.et&text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
      showToast('Comeback discount ready', `10% code ${code} created. Share it with ${name}.`, 'default');
    } catch {
      showToast('Could not create discount', 'Please try again.', 'destructive');
    } finally {
      setBusyPhone(null);
    }
  }, [createPromo, tenantSlug, businessName]);

  const toggleUpfront = useCallback(async (c: Customer) => {
    const currentlyRequired = upfrontPhones.has(c.phone);
    setBusyPhone(c.phone);
    try {
      const res = await authFetch(`/api/tenant/customers/${encodeURIComponent(c.phone)}/require-upfront`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ require: !currentlyRequired }),
      });
      if (!res.ok) throw new Error('Toggle failed');
      const body = await res.json().catch(() => ({}));
      setUpfrontPhones((prev) => {
        const next = new Set(prev);
        if (body.require_upfront === true) next.add(c.phone);
        else next.delete(c.phone);
        return next;
      });
      showToast(
        body.require_upfront ? 'Upfront Telebirr required' : 'Upfront Telebirr lifted',
        body.require_upfront
          ? `${displayName(c)} must now pay a deposit to book.`
          : `${displayName(c)} can book without an upfront deposit.`,
        'default',
      );
    } catch {
      showToast('Could not update setting', 'Please try again.', 'destructive');
    } finally {
      setBusyPhone(null);
    }
  }, [upfrontPhones]);

  if (proGateLoading) {
    return (
      <StaffRedirect>
        <div className="flex items-center gap-2 py-10 text-sm text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </StaffRedirect>
    );
  }

  if (!isPro) {
    return (
      <StaffRedirect>
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
            Customer Health
          </h1>
          <div className="bg-paper-bleached rounded-xl border border-ink-rule p-6">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-ink-stamp shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold text-ink mb-1">Pro feature</h2>
                <p className="text-sm text-ink-soft">
                  Customer Health & Risk Scoring is available on the Pro plan. Upgrade to tag
                  loyal customers, catch churn risks early, and require deposits from no-shows.
                </p>
              </div>
            </div>
          </div>
        </div>
      </StaffRedirect>
    );
  }

  return (
    <StaffRedirect>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
            Customer Health
          </h1>
          <p className="text-xs mt-0.5 text-ink-soft" style={{ fontFamily: 'var(--font-receipt)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {customers.length} customers · scored from visit &amp; no-show history
          </p>
        </div>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="skeleton-wave" style={{ height: '4.5rem', borderRadius: 'var(--rd-card)' }} />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-accent/40 bg-accent/10">
            <AlertTriangle className="h-5 w-5 text-accent shrink-0" />
            <p className="text-sm text-ink">{error}</p>
          </div>
        )}

        {!loading && !error && customers.length === 0 && (
          <div className="bg-paper-bleached rounded-xl border border-ink-rule p-8 text-center">
            <div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--color-ink-rule)', color: 'var(--color-ink-soft)' }}
            >
              <Users className="h-8 w-8" />
            </div>
            <p className="font-bold text-ink mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              No customers yet.
            </p>
            <p className="text-sm text-ink-soft max-w-xs mx-auto">
              Once you get your first booking, your CRM will populate here automatically.
            </p>
          </div>
        )}

        {!loading && !error && GROUP_ORDER.map((tag) => {
          const group = grouped.get(tag) || [];
          if (group.length === 0) return null;
          const meta = HEALTH_TAGS[tag];
          return (
            <section
              key={tag}
              className="bg-paper-bleached rounded-xl border border-ink-rule overflow-hidden"
            >
              <header className="px-5 py-4 border-b border-ink-rule flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span aria-hidden className="text-lg leading-none">{meta.emoji}</span>
                  <h2 className="text-base font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
                    {meta.label}
                  </h2>
                </div>
                <span
                  className="inline-flex items-center justify-center min-w-[2rem] h-8 px-3"
                  style={{
                    fontFamily: 'var(--font-receipt)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    backgroundColor: 'var(--color-ink)',
                    color: 'var(--color-paper-bleached)',
                    borderRadius: 'var(--rd-card)',
                  }}
                >
                  {group.length}
                </span>
              </header>

              <ul role="list" className="divide-y divide-ink-rule">
                {group.map((c) => {
                  const days = daysSince(c.lastVisit);
                  const name = displayName(c);
                  const isBusy = busyPhone === c.phone;
                  const requiresUpfront = upfrontPhones.has(c.phone);
                  return (
                    <li key={c.phone} className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <span
                          className="flex-shrink-0 inline-flex items-center justify-center mt-0.5"
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
                          {name.charAt(0).toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div
                            className="font-medium truncate text-ink"
                            style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem' }}
                          >
                            {name}
                          </div>
                          <div
                            className="text-xs text-ink-soft"
                            style={{ fontFamily: 'var(--font-receipt)', letterSpacing: '0.04em' }}
                          >
                            {c.visitCount} visit{c.visitCount === 1 ? '' : 's'}
                            {c.noShowCount > 0 && (
                              <span style={{ color: 'var(--color-accent)' }}> · {c.noShowCount} no-show{c.noShowCount === 1 ? '' : 's'}</span>
                            )}
                            <span style={{ color: 'var(--color-ink-rule)' }}>
                              {' · '}{days === 999 ? 'never' : `${days}d ago`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3">
                        {tag === 'vip_loyal' && (
                          <button
                            type="button"
                            onClick={() => sendVoucher(c)}
                            disabled={isBusy}
                            className="w-full inline-flex items-center justify-center px-4 min-h-[44px] text-sm font-bold rounded-[var(--rd-card)] transition-colors disabled:opacity-60"
                            style={{
                              fontFamily: 'var(--font-display)',
                              backgroundColor: 'var(--color-telebirr)',
                              color: 'var(--color-paper-bleached)',
                            }}
                          >
                            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Holiday Gift Voucher · 15%'}
                          </button>
                        )}
                        {tag === 'at_risk_churn' && (
                          <button
                            type="button"
                            onClick={() => sendComeback(c)}
                            disabled={isBusy}
                            className="w-full inline-flex items-center justify-center px-4 min-h-[44px] text-sm font-bold rounded-[var(--rd-card)] transition-colors disabled:opacity-60"
                            style={{
                              fontFamily: 'var(--font-display)',
                              backgroundColor: 'var(--color-telebirr)',
                              color: 'var(--color-paper-bleached)',
                            }}
                          >
                            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Comeback Discount · 10%'}
                          </button>
                        )}
                        {tag === 'high_no_show_risk' && (
                          <button
                            type="button"
                            onClick={() => toggleUpfront(c)}
                            disabled={isBusy}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 min-h-[44px] text-sm font-bold rounded-[var(--rd-card)] border transition-colors disabled:opacity-60"
                            style={{
                              fontFamily: 'var(--font-display)',
                              borderColor: requiresUpfront ? 'var(--color-telebirr)' : 'var(--color-ink-rule)',
                              backgroundColor: requiresUpfront ? 'var(--color-telebirr)' : 'transparent',
                              color: requiresUpfront ? 'var(--color-paper-bleached)' : 'var(--color-ink)',
                            }}
                          >
                            {isBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>Require Upfront Telebirr{requiresUpfront ? ' · ON' : ''}</>
                            )}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </StaffRedirect>
  );
}
