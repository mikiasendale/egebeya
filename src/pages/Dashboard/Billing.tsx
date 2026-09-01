/**
 * /dashboard/billing — current plan, renewals, and the Pro price ladder.
 *
 * P1.3: everything on this page is driven by GET /api/tenant/subscription's
 * `billing` object (state machine: idle → redirecting → pending → active /
 * grace / expired). Founding members see "የመስራች ዋጋ ተይዟል" + renewal date;
 * new tenants see list price; a value frame ("bookings this month") sits
 * ABOVE any price so the plan is framed by value, never by a naked delta
 * (CPO ruling).
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { CreditCard, Loader2, Zap, AlertTriangle, Check, CheckCircle2, ExternalLink, Clock } from 'lucide-react';
import { showToast } from '../../components/ui/toast-helper';
import { authFetch } from '../../lib/api';
import { fetchSubscription, billingState, type BillingState } from '../../lib/subscription';
import type { SubscriptionSummary } from '../../lib/subscription';
import { StaffRedirect } from './StaffRedirect';

type CycleDays = 30 | 90 | 365;

// Button state machine (P1.3): idle → redirecting → (Chapa) → pending → active.
type CheckoutPhase = 'idle' | 'redirecting' | 'pending';

const CYCLES: Array<{ days: CycleDays; labelKey: string }> = [
  { days: 30, labelKey: 'dashboard.billing.cycleMonthly' },
  { days: 90, labelKey: 'dashboard.billing.cycleQuarterly' },
  { days: 365, labelKey: 'dashboard.billing.cycleAnnual' },
];

// T4.3 anti-surprise window: surface a persistent countdown when a paid Pro
// subscription has ≤ 7 days left. No stored cards on telebirr rails, so this
// is a fresh prepay checkout — but an ANNOUNCED expiry never gets blamed on
// the merchant the way a *surprised* downgrade does (ROADMAP 7.1).
const RENEWAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function Billing() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<SubscriptionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<CheckoutPhase>('idle');
  const [cycleDays, setCycleDays] = useState<CycleDays>(30);

  useEffect(() => {
    fetchSubscription()
      .then((data) => {
        setSummary(data);
        // P3.5 pricing-funnel: the owner saw the price ladder.
        const b = (data as any)?.billing ?? {};
        authFetch('/api/tenant/events/price-seen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isFoundingRate: b.isFoundingRate ?? null,
            amountEtb: typeof b.priceEtbPerMonth === 'string' ? Number(b.priceEtbPerMonth) : null,
          }),
        }).catch(() => {});
      })
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  const billing = (summary as any)?.billing ?? {};
  // Server is the source of truth; client math is a fallback for old payloads.
  const state: BillingState = billing.state ?? billingState(summary);
  const planName: string = summary?.plan?.name || 'free';
  const isPro = planName.toLowerCase() === 'pro';
  const staffUsage: number = summary?.staffUsage ?? 0;
  const maxStaff: number = summary?.plan?.maxStaff ?? 0;
  const endsAt: number | null = summary?.subscription?.endsAt ?? null;
  const trialEndsAt: number | null = summary?.subscription?.trialEndsAt ?? null;
  const graceEndsAt: number | null = billing.graceEndsAt ??
    (typeof endsAt === 'number' ? endsAt + 5 * 24 * 60 * 60 * 1000 : null);

  const priceEtb: string = String(billing.priceEtbPerMonth ?? '1000');
  const isFoundingRate: boolean = billing.isFoundingRate === true;
  const monthlyBookings: number = billing.monthlyBookings ?? 0;
  const paymentPending: boolean =
    billing.pendingCheckout === true && !isProActiveState(state);

  // T4.3: days-remaining for the pre-expiry countdown banner. Only meaningful
  // when the tenant is still active (paid Pro) and squarely inside the window.
  const daysToExpiry: number | null = typeof endsAt === 'number'
    ? Math.max(0, Math.ceil((endsAt - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;
  const showRenewalCountdown: boolean =
    state === 'active' &&
    typeof endsAt === 'number' &&
    endsAt > Date.now() &&
    endsAt - Date.now() <= RENEWAL_WINDOW_MS;

  // Receipt-strip math (P1.5): mirrors server/lib/billing.ts priceForCycle.
  function cyclePriceEtb(days: CycleDays): string {
    const base = Number(priceEtb) || 0;
    const total = days === 90 ? base * 3 * 0.95 : days === 365 ? base * 10 : base;
    return `${total.toLocaleString()} ETB`;
  }
  function cycleTotalEtb(days: CycleDays): string {
    return cyclePriceEtb(days);
  }

  function isProActiveState(s: BillingState): boolean {
    return s === 'active' || s === 'grace';
  }

  async function startCheckout() {
    setPhase('redirecting');
    try {
      // authFetch carries the CSRF header + silent-refresh semantics.
      const res = await authFetch('/api/tenant/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle: cycleDays }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.checkoutUrl) {
        window.location.assign(body.checkoutUrl);
        return; // navigation away — phase stays 'redirecting'
      }
      setPhase('idle');
      showToast('Checkout failed to start', body.error || 'Please try again.', 'destructive');
    } catch {
      setPhase('idle');
      showToast('Checkout failed to start', 'Network error.', 'destructive');
    }
  }

  if (loading) {
    return (
      <StaffRedirect>
        <div className="flex items-center gap-2 py-10 text-sm text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading billing…
        </div>
      </StaffRedirect>
    );
  }

  if (!summary) {
    return (
      <StaffRedirect>
        <div className="bg-paper-bleached rounded-xl border border-ink-rule p-6">
          <h2 className="text-lg font-bold text-ink mb-2">{t('dashboard.billing.title')}</h2>
          <p className="text-sm text-ink-soft">Unable to load your subscription. Please try again.</p>
        </div>
      </StaffRedirect>
    );
  }

  const busy = phase === 'redirecting';

  return (
    <StaffRedirect>
      <div className="space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-ink">{t('dashboard.billing.title')}</h1>
          {isFoundingRate && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-telebirr/15 text-telebirr-deep">
              <CheckCircle2 className="h-3 w-3" /> {t('dashboard.billing.foundingLocked')}
            </span>
          )}
          {state === 'grace' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-accent-secondary/15 text-accent-secondary-deep">
              <AlertTriangle className="h-3 w-3" /> Grace period
            </span>
          )}
        </div>

        {/* Pending checkout: Chapa hasn't confirmed yet (P1.3 state machine). */}
        {paymentPending && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-accent-secondary/40 bg-accent-secondary/10">
            <Clock className="h-5 w-5 text-accent-secondary-deep shrink-0 mt-0.5" />
            <p className="text-sm text-ink flex-1">{t('dashboard.billing.paymentPending')}</p>
          </div>
        )}

        {/* T4.3 anti-surprise countdown: ≤ 7 days to expiry, still active. An
            announced expiry is a prepay, not a downgrade surprise. */}
        {showRenewalCountdown && (
          <div
            className="flex items-start gap-3 p-4 rounded-xl border border-accent-secondary/40 bg-accent-secondary/10"
            data-testid="renewal-countdown-banner"
          >
            <AlertTriangle className="h-5 w-5 text-accent-secondary-deep shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">{t('dashboard.billing.countdownTitle')}</p>
              <p className="text-sm text-ink-soft mt-0.5">
                {t('dashboard.billing.countdownBody', { days: daysToExpiry ?? 0 })}
              </p>
            </div>
            <button
              onClick={startCheckout}
              disabled={busy}
              data-testid="renewal-countdown-btn"
              className="shrink-0 inline-flex items-center gap-1 rounded-md bg-telebirr text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('dashboard.billing.countdownAction')}
            </button>
          </div>
        )}

        {state === 'grace' && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-accent-secondary/40 bg-accent-secondary/10">
            <AlertTriangle className="h-5 w-5 text-accent-secondary-deep shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">Your Pro plan has expired.</p>
              <p className="text-sm text-ink-soft mt-0.5">
                Renew to keep Pro features. Access ends permanently after the grace period.
              </p>
            </div>
            <button
              onClick={startCheckout}
              disabled={busy}
              data-testid="renew-banner-btn"
              className="shrink-0 inline-flex items-center gap-1 rounded-md bg-ink text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Renew'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-paper-bleached p-6 rounded-xl border border-ink-rule relative overflow-hidden">
            <Zap className="absolute top-4 right-4 text-ink-stamp" size={64} />
            <h3 className="text-lg font-bold text-ink mb-1 capitalize">{planName} Plan</h3>
            <p className="text-sm text-ink-soft mb-4">
              {state === 'trial'
                ? `Pro trial active${trialEndsAt ? ` · ends ${format(new Date(trialEndsAt), 'MMM d, yyyy')}` : ''}`
                : state === 'grace'
                  ? 'Pro access during grace period'
                  : isPro
                    ? `Active until ${endsAt ? format(new Date(endsAt), 'MMM d, yyyy') : '—'}`
                    : 'Free forever — no card required'}
            </p>

            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-ink">Staff Limit</span>
                <span className="font-bold text-ink">{staffUsage} / {maxStaff}</span>
              </div>
              <div className="w-full bg-ink-rule rounded-full h-2">
                <div className="bg-ink h-2 rounded-full" style={{ width: `${maxStaff ? Math.min(100, (staffUsage / maxStaff) * 100) : 0}%` }} />
              </div>
            </div>

            {/* Value frame ABOVE any price — never a naked price delta (CPO ruling). */}
            {!isPro && monthlyBookings > 0 && (
              <p className="mb-3 text-sm font-medium text-telebirr-deep" data-testid="value-frame">
                {monthlyBookings === 1
                  ? t('dashboard.billing.valueFrameOne')
                  : t('dashboard.billing.valueFrame', { count: monthlyBookings })}
              </p>
            )}

            {/* Cycle selector (P1.5) — a receipt strip: picking a cycle PRINTS
                its ledger line and slams the discount stamp (overdrive A). */}
            {!isPro && (
              <div className="mb-3" role="radiogroup" aria-label="Billing cycle">
                <div className="rounded-lg border border-ink-rule bg-paper-raised overflow-hidden">
                  {CYCLES.map((c, i) => {
                    const selected = cycleDays === c.days;
                    return (
                      <button
                        key={c.days}
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setCycleDays(c.days)}
                        disabled={busy}
                        data-testid={`cycle-${c.days}`}
                        className={`till-print w-full flex items-center justify-between gap-2 px-3 py-3 min-h-[52px] text-left transition-colors duration-200 ${
                          i > 0 ? 'border-t border-dashed border-ink-rule' : ''
                        } ${selected ? 'bg-paper-bleached' : 'hover:bg-paper-bleached/60'}`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            aria-hidden
                            className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                              selected ? 'border-primary bg-primary' : 'border-ink-rule'
                            }`}
                          >
                            {selected && <Check className="h-3 w-3 text-white" />}
                          </span>
                          <span className={`text-sm truncate ${selected ? 'font-semibold text-ink' : 'text-ink-soft'}`}>
                            {t(c.labelKey)}
                          </span>
                        </span>
                        <span
                          className="text-xs shrink-0"
                          style={{ fontFamily: 'var(--font-receipt)', color: selected ? 'var(--color-primary-deep)' : 'var(--color-ink-stamp)' }}
                        >
                          {cyclePriceEtb(c.days)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* The printed total line + discount stamp slam in on change. */}
                <div key={cycleDays} className="till-print mt-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-ink">
                    {t('dashboard.billing.totalToday', { defaultValue: 'ዛሬ ክፍል · Total today' })}
                  </span>
                  <span className="flex items-center gap-2">
                    {cycleDays !== 30 && (
                      <span
                        className="stamp stamp-slam-in"
                        style={{ color: 'var(--color-primary-deep)', borderColor: 'var(--color-primary-deep)' }}
                        data-testid="cycle-discount-stamp"
                      >
                        {cycleDays === 90 ? '5% OFF' : '10 ለ 12'}
                      </span>
                    )}
                    <span className="text-base font-bold" style={{ fontFamily: 'var(--font-receipt)', color: 'var(--color-ink)' }}>
                      {cycleTotalEtb(cycleDays)}
                    </span>
                  </span>
                </div>
              </div>
            )}

            {!isPro && (
              <>
                <button
                  onClick={startCheckout}
                  disabled={busy}
                  data-testid="upgrade-btn"
                  className="w-full bg-telebirr text-white px-4 py-2.5 rounded-md font-medium text-sm hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>
                      {t('dashboard.billing.upgrade', { price: priceEtb })}
                      <ExternalLink className="h-4 w-4" />
                    </>
                  )}
                </button>
                <p className="mt-2 text-xs text-ink-soft">
                  {t('dashboard.billing.cycleNote')}
                </p>
              </>
            )}

            {isFoundingRate && (
              <p className="mt-3 text-xs text-telebirr-deep" data-testid="founding-hint">
                {t('dashboard.billing.foundingLockedHint', {
                  date: typeof billing.foundingRateLockedUntil === 'number'
                    ? format(new Date(billing.foundingRateLockedUntil), 'MMM d, yyyy')
                    : '—',
                })}
              </p>
            )}

            {isPro && state !== 'grace' && (
              <button
                onClick={startCheckout}
                disabled={busy}
                data-testid="renew-btn"
                className="w-full bg-ink text-white px-4 py-2.5 rounded-md font-medium text-sm hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('dashboard.billing.renew', { price: priceEtb })}
              </button>
            )}

            {state === 'expired' && isPro && (
              <div className="p-3 rounded-lg border border-ink-rule bg-paper-raised text-sm text-ink-soft">
                This subscription has expired. Renew to restore Pro features.
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="p-4 border border-ink-rule rounded-lg bg-paper-raised">
              <h4 className="font-semibold text-ink text-sm mb-1">What's included in Pro</h4>
              <ul className="text-sm text-ink space-y-1.5">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-telebirr-deep" /> Code-mode website builder</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-telebirr-deep" /> AI marketing snippet generator</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-telebirr-deep" /> Up to {maxStaff} staff members</li>
              </ul>
            </div>

            <div className="p-4 border border-ink-rule rounded-lg bg-paper-raised">
              <h4 className="font-semibold text-ink text-sm mb-1">Billing Cycle</h4>
              <p className="text-ink">
                {state === 'trial' && trialEndsAt
                  ? `Trial ends ${format(new Date(trialEndsAt), 'MMM d, yyyy')}`
                  : state === 'grace' && graceEndsAt
                    ? `Renew by ${format(new Date(graceEndsAt), 'MMM d, yyyy')} to avoid losing Pro`
                    : isPro
                      ? `Next renewal ${endsAt ? format(new Date(endsAt), 'MMM d, yyyy') : '—'}`
                      : 'Monthly (Free plan has no billing cycle)'}
              </p>
            </div>

            <div className="p-4 border border-ink-rule rounded-lg bg-paper-raised">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="h-4 w-4 text-ink-stamp" />
                <h4 className="font-semibold text-ink text-sm">Payments</h4>
              </div>
              <p className="text-xs text-ink-soft">
                Payments are processed securely by Chapa (Telebirr / card). You'll be redirected to
                Chapa to complete payment after clicking upgrade.
              </p>
            </div>
          </div>
        </div>
      </div>
    </StaffRedirect>
  );
}
